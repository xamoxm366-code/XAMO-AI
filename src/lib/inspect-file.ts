import { unzipSync } from "fflate";
const MAX_TEXT = 200000;
const MAX_ENTRY = 1024 * 1024;
const MAX_EXPANDED = 2 * 1024 * 1024;
function readable(
  bytes: Uint8Array,
  partial = false,
  tail = false,
): string | null {
  try {
    const encoding =
      bytes[0] === 255 && bytes[1] === 254
        ? "utf-16le"
        : bytes[0] === 254 && bytes[1] === 255
          ? "utf-16be"
          : "utf-8";
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes, {
      stream: partial,
    });
    const controls = text.match(/[\x00-\x08\x0e-\x1f]/g)?.length || 0;
    return controls > text.length / 100 ? null : text;
  } catch {
    if (tail) {
      for (let offset = 1; offset <= 3; offset++) {
        const text = readable(bytes.subarray(offset), partial);
        if (text !== null) return text;
      }
    }
    return null;
  }
}
function strings(bytes: Uint8Array) {
  const ascii =
    new TextDecoder("latin1").decode(bytes).match(/[\x20-\x7e]{6,}/g) || [];
  const utf16 =
    new TextDecoder("utf-16le").decode(bytes).match(/[\x20-\x7e]{6,}/g) || [];
  return [...new Set([...ascii, ...utf16])].join("\n").slice(0, 20000);
}
function xmlText(text: string) {
  return text
    .replace(/<[^>]{0,10000}>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}
export async function inspectFile(
  file: File,
): Promise<{ text: string; note: string }> {
  const header = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const summary = `File: ${file.name}\nOriginal size: ${file.size} bytes\n`;
  if (header[0] === 0x50 && header[1] === 0x4b) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries: string[] = [];
    let expanded = 0,
      selected = 0,
      skipped = 0;
    const reports: string[] = [];
    try {
      const extracted = unzipSync(bytes, {
        filter(entry) {
          if (entries.length < 1000)
            entries.push(
              `${entry.name.slice(0, 200)} (${entry.originalSize} bytes)`,
            );
          else skipped++;
          const wanted =
            /\.(txt|md|csv|json|xml|html?|[cm]?[jt]sx?|py|java|kt|smali|ya?ml|properties|gradle|ini|toml|sql|sh|css|cs|cpp|h|rs|go|rb|php)$/i.test(
              entry.name,
            );
          const allow =
            wanted &&
            entry.originalSize <= MAX_ENTRY &&
            expanded + entry.originalSize <= MAX_EXPANDED &&
            selected < 60;
          if (allow) {
            expanded += entry.originalSize;
            selected++;
          }
          return allow;
        },
      });
      let remaining = MAX_TEXT;
      for (const [name, data] of Object.entries(extracted)) {
        if (!remaining) break;
        let text = readable(data);
        if (text === null && /AndroidManifest\.xml$/i.test(name))
          text = `Binary Android manifest strings (partial; not decompiled):\n${strings(data)}`;
        if (text === null) continue;
        if (
          /\.(xml|html?)$/i.test(name) &&
          !/AndroidManifest\.xml$/i.test(name)
        )
          text = xmlText(text);
        const excerpt = text.slice(0, remaining);
        remaining -= excerpt.length;
        reports.push(
          `\n--- ${name} ---\n${excerpt}${excerpt.length < text.length ? "\n[Entry truncated]" : ""}`,
        );
      }
      const note = /\.apk$/i.test(file.name)
        ? "APK static inspection: file list and manifest strings; no execution or full decompilation."
        : "Archive/document extraction: bounded text and file list; embedded images and layout are not included.";
      return {
        note,
        text: `${summary}${note}\nPartial inspection: at most 1,000 filenames, 60 text entries, 2 MB expanded, 200,000 text characters. Omitted, encrypted, or compiled content has not been analyzed. This does not establish that software is safe.\n\nEntries:\n${entries.join("\n")}\n${skipped ? `[${skipped} additional entries omitted]` : ""}\nExtracted text:${reports.join("\n") || "\nNo readable text entries were found."}`,
      };
    } catch {
      return {
        note: "Archive could not be extracted (possibly encrypted, damaged, or unsupported). Metadata only.",
        text: `${summary}Archive extraction failed. No contents were analyzed. Ask for an unencrypted ZIP or the original documents.`,
      };
    }
  }
  // Sample distant sections of very large text files without loading them all into memory.
  const head = new Uint8Array(await file.slice(0, MAX_TEXT).arrayBuffer());
  let text = readable(head, file.size > MAX_TEXT);
  if (text !== null) {
    const partial = file.size > MAX_TEXT;
    if (partial) {
      const tail = new Uint8Array(
        await file
          .slice(Math.max(MAX_TEXT, file.size - MAX_TEXT / 2))
          .arrayBuffer(),
      );
      text = `${text.slice(0, MAX_TEXT / 2)}\n\n[Middle omitted: partial beginning/end excerpts]\n\n${readable(tail, false, true) || "[End is not valid text]"}`;
    }
    return {
      text: `${summary}${partial ? "Partial text excerpts; the complete file was NOT read.\n" : "Full text:\n"}${text}`,
      note: partial
        ? "Large text: beginning/end excerpts; middle omitted."
        : "Text/code file",
    };
  }
  return {
    note: "Binary metadata and sampled strings only; this format cannot be fully decoded.",
    text: `${summary}Limited static binary inspection. Not executed or decompiled; cannot establish functionality or safety. Ask for source/exported data when deeper analysis is needed.\nHeader (hex): ${Array.from(header.slice(0, 64), (b) => b.toString(16).padStart(2, "0")).join(" ")}\nSampled printable strings from first 200 KB (may be incomplete/misleading):\n${strings(head) || "None found."}`,
  };
}
