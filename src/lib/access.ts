import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { identify, serviceClient } from "./server";
export class AccessError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function actor(req: NextRequest) {
  const user = await identify(req);
  if (user) return user.id;
  if (process.env.ALLOW_GUEST_AI !== "true")
    throw new AccessError(
      "Please sign in to use live AI. Guest preview is available before the AI provider is connected.",
      401,
    );
  const ip = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (!ip)
    throw new AccessError(
      "Guest AI is available only through the configured hosting gateway. Please sign in.",
      401,
    );
  return `guest:${createHash("sha256").update(ip).digest("hex")}`;
}
export async function quota(owner: string) {
  const db = serviceClient();
  if (!db)
    throw new AccessError(
      "The owner needs to finish the secure quota setup before live AI is available.",
      503,
    );
  const { data: settings, error } = await db
    .from("app_settings")
    .select("ai_enabled, daily_limit")
    .eq("id", 1)
    .single();
  if (error)
    throw new AccessError(
      "The owner needs to run the database setup before live AI is available.",
      503,
    );
  if (!settings.ai_enabled)
    throw new AccessError(
      "XAMO is taking a short break. Please try again later.",
      503,
    );
  if (settings.daily_limit === null) return;
  if (
    !Number.isInteger(settings.daily_limit) ||
    settings.daily_limit < 1 ||
    settings.daily_limit > 1000
  )
    throw new AccessError("Invalid daily limit configuration.", 503);
  const { data: allowed, error: quotaError } = await db.rpc(
    "consume_chat_quota",
    { subject: owner, daily_max: settings.daily_limit },
  );
  if (quotaError || !allowed)
    throw new AccessError(
      quotaError
        ? "Could not check usage. Please try again."
        : "You’ve reached today’s message limit. Come back tomorrow.",
      quotaError ? 503 : 429,
    );
}
