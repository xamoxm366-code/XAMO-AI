import {
  CHUNK_BYTES,
  MAX_FILE_BYTES,
  mediaType,
  allowedUploadTypes,
  type Attachment,
} from "./files";
async function json(response: Response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Upload interrupted. Check your connection and try again.");
  }
  if (!response.ok)
    throw new Error(data.error || "This upload failed. Try again.");
  return data;
}
async function inspect(
  file: File,
  signal: AbortSignal,
): Promise<{ text: string; note: string }> {
  const worker = new Worker(
    new URL("../workers/file-inspector.ts", import.meta.url),
  );
  return new Promise((resolve, reject) => {
    const stop = () => {
      worker.terminate();
      signal.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      stop();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = ({ data }) => {
      stop();
      data.error ? reject(new Error(data.error)) : resolve(data);
    };
    worker.onerror = () => {
      stop();
      reject(
        new Error(
          "File inspection failed. Try a smaller file or an exported text/PDF version.",
        ),
      );
    };
    worker.postMessage(file);
  });
}
export async function uploadFile(
  file: File,
  headers: Record<string, string>,
  signal: AbortSignal,
  progress: (value: string) => void,
): Promise<Attachment> {
  if (!file.size) throw new Error("This file is empty.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error(
      "Choose a file up to 100 MB. Split larger files before uploading.",
    );
  if (file.name.length > 240)
    throw new Error("Please shorten the file name to 240 characters.");
  let mimeType =
      mediaType(file.name) ||
      (allowedUploadTypes.has(file.type) && file.type !== "text/plain"
        ? file.type
        : undefined),
    blob: Blob = file,
    note: string | undefined;
  if (mimeType === "application/pdf" && file.size > 50 * 1024 * 1024)
    throw new Error("PDF files must be 50 MB or smaller.");
  if (
    !mimeType &&
    (/\.(gif|bmp|avif|svg)$/i.test(file.name) ||
      /^image\/(gif|bmp|avif|svg\+xml)$/.test(file.type))
  ) {
    progress("Preparing image…");
    let bitmap: ImageBitmap | HTMLImageElement;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        bitmap = image;
      } catch {
        throw new Error(
          "This image could not be decoded. Try exporting it to PNG or JPEG.",
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    try {
      if (bitmap.width * bitmap.height > 40_000_000)
        throw new Error(
          "This image has too many pixels. Resize it and try again.",
        );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Could not convert this image.")),
          "image/png",
        ),
      );
      mimeType = "image/png";
      note = "Converted to PNG; animated images use one frame.";
    } finally {
      if ("close" in bitmap) bitmap.close();
    }
  }
  if (!mimeType) {
    progress("Inspecting file…");
    const report = await inspect(file, signal);
    blob = new Blob([report.text], { type: "text/plain" });
    mimeType = "text/plain";
    note = report.note;
  }
  progress("Starting upload…");
  let data = await json(
    await fetch("/api/files", {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        action: "start",
        name: file.name,
        size: blob.size,
        mimeType,
      }),
    }),
  );
  if (data.directUrl) {
    const destination = new URL(data.directUrl);
    if (
      destination.origin !== "https://generativelanguage.googleapis.com" ||
      !destination.pathname.startsWith("/upload/") ||
      destination.searchParams.has("key")
    )
      throw new Error("Invalid upload destination.");
    const uploadToken = data.token;
    const chunkSize = Math.max(8 * 1024 * 1024, data.chunkGranularity);
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      const final = offset + chunkSize >= blob.size;
      let response;
      try {
        response = await fetch(destination.href, {
          method: "POST",
          credentials: "omit",
          referrerPolicy: "no-referrer",
          redirect: "error",
          signal,
          headers: {
            "Content-Type": mimeType,
            "X-Goog-Upload-Offset": String(offset),
            "X-Goog-Upload-Command": final ? "upload, finalize" : "upload",
          },
          body: blob.slice(offset, offset + chunkSize),
        });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new Error(
          "The direct file upload was interrupted or blocked by your browser/network. Try again or use a smaller file.",
        );
      }
      if (!response.ok && !(response.status === 308 && !final))
        throw new Error(
          `The file provider rejected this upload (HTTP ${response.status}). Try another format or a smaller file.`,
        );
      await response.body?.cancel();
      progress(
        `Uploading ${Math.min(100, Math.round(((offset + chunkSize) / blob.size) * 100))}%`,
      );
    }
    data = await json(
      await fetch("/api/files", {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({ action: "complete", token: uploadToken }),
      }),
    );
  } else {
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      data = await json(
        await fetch("/api/files", {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/octet-stream",
            "x-upload-token": data.token,
          },
          body: blob.slice(offset, offset + CHUNK_BYTES),
          signal,
        }),
      );
      progress(
        `Uploading ${Math.min(100, Math.round(((offset + CHUNK_BYTES) / blob.size) * 100))}%`,
      );
    }
  }
  // Poll in independent requests, so large videos are not constrained by a single function's duration.
  const deadline = Date.now() + 10 * 60000;
  while (data.state !== "ready") {
    if (Date.now() > deadline)
      throw new Error(
        "This video is still processing. Try a shorter clip and upload it again.",
      );
    progress("Processing media…");
    await new Promise<void>((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", cancel);
        resolve();
      }, 2000);
      if (signal.aborted) cancel();
      else signal.addEventListener("abort", cancel, { once: true });
    });
    data = await json(
      await fetch("/api/files", {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({
          action: "status",
          token: data.attachment.token,
        }),
      }),
    );
  }
  return { ...data.attachment, name: file.name, size: file.size, note };
}
