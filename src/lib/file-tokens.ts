import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
export type FileTicket = {
  kind: "upload" | "file";
  owner: string;
  name: string;
  mimeType: string;
  size: number;
  expiresAt: number;
  target: string;
  offset?: number;
  fileName?: string;
  direct?: boolean;
};
function key() {
  if (!process.env.GEMINI_API_KEY)
    throw new Error("File analysis is not connected yet.");
  return createHash("sha256")
    .update(`xamo-files-v1:${process.env.GEMINI_API_KEY}`)
    .digest();
}
export function sealFile(ticket: FileTicket) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(ticket), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function openFile(
  token: string,
  owner: string,
  kind: FileTicket["kind"],
): FileTicket {
  try {
    if (!token || token.length > 6000) throw new Error();
    const bytes = Buffer.from(token, "base64url");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(12, 28));
    const ticket: FileTicket = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString("utf8"),
    );
    if (
      ticket.kind !== kind ||
      ticket.owner !== owner ||
      ticket.expiresAt <= Date.now()
    )
      throw new Error();
    return ticket;
  } catch {
    throw new Error(
      "This file expired or belongs to another session. Please attach it again.",
    );
  }
}
export function filePart(ticket: FileTicket) {
  if (!/^files\/[a-zA-Z0-9_-]+$/.test(ticket.target))
    throw new Error("Invalid file reference.");
  return {
    fileData: {
      mimeType: ticket.mimeType,
      fileUri: `https://generativelanguage.googleapis.com/v1beta/${ticket.target}`,
    },
  };
}
