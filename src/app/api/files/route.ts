import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { actor, quota, AccessError } from "@/lib/access";
import { CHUNK_BYTES, MAX_FILE_BYTES, allowedUploadTypes } from "@/lib/files";
import { openFile, sealFile, type FileTicket } from "@/lib/file-tokens";
export const maxDuration = 60;
const base = "https://generativelanguage.googleapis.com";
const startSchema = z.object({
  action: z.literal("start"),
  name: z.string().min(1).max(240),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
  mimeType: z.string().refine((value) => allowedUploadTypes.has(value)),
});
function fail(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "File upload failed. Try again.",
    },
    { status: error instanceof AccessError ? error.status : 400 },
  );
}
async function upstream(
  url: string,
  init: RequestInit,
  allowIncomplete = false,
) {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(50000)])
      : AbortSignal.timeout(50000),
  });
  const incomplete =
    allowIncomplete &&
    response.status === 308 &&
    response.headers.get("x-goog-upload-status") === "active";
  if (!response.ok && !incomplete)
    throw new AccessError(
      response.status === 429
        ? "File processing is busy or its quota is exhausted. Try again later."
        : `The file provider could not process this upload (HTTP ${response.status}). Try a smaller file or a different format.`,
      response.status === 429 ? 429 : 502,
    );
  return response;
}
function fileResult(
  file: { name: string; state: string; expirationTime?: string },
  ticket: FileTicket,
) {
  if (!/^files\/[a-zA-Z0-9_-]+$/.test(file.name))
    throw new Error("Invalid file response.");
  if (file.state === "FAILED")
    throw new AccessError(
      "The provider could not read this file. Try another encoding or format.",
      422,
    );
  const expiresAt = Math.min(
    Date.parse(file.expirationTime || "") || Date.now() + 47 * 3600000,
    Date.now() + 47 * 3600000,
  );
  return NextResponse.json(
    {
      state: file.state === "ACTIVE" ? "ready" : "processing",
      attachment: {
        name: ticket.name,
        size: ticket.size,
        mimeType: ticket.mimeType,
        expiresAt,
        token: sealFile({
          ...ticket,
          kind: "file",
          target: file.name,
          expiresAt,
          offset: undefined,
        }),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY)
      throw new AccessError(
        "File analysis needs a connected AI provider. You can still try text chat in preview mode.",
        503,
      );
    const owner = await actor(req);
    if (Number(req.headers.get("content-length")) > 10000)
      throw new Error("Invalid upload request.");
    const raw = await req.text();
    if (raw.length > 10000) throw new Error("Invalid upload request.");
    const data = JSON.parse(raw);
    if (data.action === "complete") {
      const { token } = z.object({ token: z.string().max(6000) }).parse(data);
      const ticket = openFile(token, owner, "upload");
      if (
        !ticket.direct ||
        !ticket.fileName ||
        !/^files\/xamo-[a-f0-9]{24}$/.test(ticket.fileName)
      )
        throw new Error("Invalid direct upload session.");
      const response = await upstream(`${base}/v1beta/${ticket.fileName}`, {
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
        signal: req.signal,
      });
      const file = await response.json();
      if (
        file.name !== ticket.fileName ||
        Number(file.sizeBytes) !== ticket.size ||
        file.mimeType !== ticket.mimeType
      )
        throw new Error(
          "Uploaded file does not match this session. Please attach it again.",
        );
      return fileResult(file, ticket);
    }
    if (data.action === "status") {
      const { token } = z.object({ token: z.string().max(6000) }).parse(data);
      const ticket = openFile(token, owner, "file");
      if (!/^files\/[a-zA-Z0-9_-]+$/.test(ticket.target))
        throw new Error("Invalid file reference.");
      const response = await upstream(`${base}/v1beta/${ticket.target}`, {
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
        signal: req.signal,
      });
      return fileResult(await response.json(), ticket);
    }
    const parsed = startSchema.safeParse(data);
    if (!parsed.success)
      throw new Error(
        "Choose a non-empty supported file up to 100 MB (PDF up to 50 MB).",
      );
    const { name, size, mimeType } = parsed.data;
    if (mimeType === "application/pdf" && size > 50 * 1024 * 1024)
      throw new Error("PDF files must be 50 MB or smaller.");
    await quota(owner);
    const fileName = `files/xamo-${randomBytes(12).toString("hex")}`;
    const response = await upstream(`${base}/upload/v1beta/files`, {
      method: "POST",
      signal: req.signal,
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(size),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { name: fileName, display_name: name } }),
    });
    const target = response.headers.get("x-goog-upload-url");
    if (
      !target ||
      new URL(target).origin !== base ||
      !new URL(target).pathname.startsWith("/upload/")
    )
      throw new Error("Invalid upload destination.");
    const chunkGranularity =
      Number(response.headers.get("x-goog-upload-chunk-granularity")) || 262144;
    const direct = size > CHUNK_BYTES && chunkGranularity > CHUNK_BYTES;
    // The session is limited to this randomly named file and declared byte length.
    // Expose no project credentials: only the temporary upload capability, when needed.
    if (direct && new URL(target).searchParams.has("key"))
      throw new Error("Unsafe upload destination.");
    const ticket: FileTicket = {
      kind: "upload",
      fileName,
      direct,
      owner,
      name,
      size,
      mimeType,
      target,
      offset: 0,
      expiresAt: Date.now() + 3600000,
    };
    return NextResponse.json(
      {
        token: sealFile(ticket),
        chunkGranularity,
        ...(direct ? { directUrl: target } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function PUT(req: NextRequest) {
  try {
    const owner = await actor(req);
    const ticket = openFile(
      req.headers.get("x-upload-token") || "",
      owner,
      "upload",
    );
    if (ticket.direct)
      throw new Error("This file uses a direct upload session.");
    if (Number(req.headers.get("content-length")) > CHUNK_BYTES)
      throw new AccessError("Upload chunk is too large.", 413);
    // Bound reads even when Content-Length is absent or forged.
    const reader = req.body?.getReader();
    if (!reader) throw new Error("Empty upload chunk.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > CHUNK_BYTES)
          throw new AccessError("Upload chunk is too large.", 413);
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const offset = ticket.offset || 0;
    const final = offset + length === ticket.size;
    if (
      !length ||
      offset + length > ticket.size ||
      (!final && length !== CHUNK_BYTES)
    )
      throw new Error("Invalid chunk size. Please attach the file again.");
    const response = await upstream(
      ticket.target,
      {
        method: "POST",
        signal: req.signal,
        headers: {
          "Content-Type": ticket.mimeType,
          "X-Goog-Upload-Offset": String(offset),
          "X-Goog-Upload-Command": final ? "upload, finalize" : "upload",
        },
        body: Buffer.concat(chunks),
      },
      !final,
    );
    if (final) return fileResult((await response.json()).file, ticket);
    return NextResponse.json(
      { token: sealFile({ ...ticket, offset: offset + length }) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
