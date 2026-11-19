// Shared limits keep each chunk below Vercel's request-body limit.
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const CHUNK_BYTES = 2 * 1024 * 1024;
export type Attachment = {
  name: string;
  size: number;
  mimeType: string;
  token: string;
  expiresAt: number;
  note?: string;
};
const media: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  wmv: "video/x-ms-wmv",
  "3gp": "video/3gpp",
  flv: "video/x-flv",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  m4a: "audio/mp4",
};
export function mediaType(name: string) {
  return media[name.split(".").pop()?.toLowerCase() || ""];
}
export function sizeLabel(size: number) {
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
export const allowedUploadTypes = new Set([
  ...Object.values(media),
  "text/plain",
]);
