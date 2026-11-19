import { NextRequest, NextResponse } from "next/server";
import { isAdmin, serviceClient } from "@/lib/server";
import { z } from "zod";
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req)))
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  const db = serviceClient()!;
  const [
    { data: users, error: userError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: 100 }),
    db
      .from("app_settings")
      .select("ai_enabled, daily_limit")
      .eq("id", 1)
      .single(),
  ]);
  if (userError || settingsError)
    return NextResponse.json(
      { error: "Admin data is unavailable. Check the database setup." },
      { status: 503 },
    );
  return NextResponse.json({
    users: users.users.map((u) => ({
      id: u.id,
      email: u.email,
      created: u.created_at,
      verified: !!u.email_confirmed_at,
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    })),
    settings,
    providerConnected: !!process.env.GEMINI_API_KEY,
    webSearch: process.env.ENABLE_WEB_SEARCH === "true",
  });
}
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("settings"),
    ai_enabled: z.boolean(),
    daily_limit: z.number().int().min(1).max(1000),
  }),
  z.object({ action: z.literal("user"), id: z.uuid(), banned: z.boolean() }),
]);
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req)))
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  let body;
  try {
    body = schema.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body.success)
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  const db = serviceClient()!;
  const result =
    body.data.action === "settings"
      ? await db
          .from("app_settings")
          .update({
            ai_enabled: body.data.ai_enabled,
            daily_limit: body.data.daily_limit,
          })
          .eq("id", 1)
          .select()
          .single()
      : await db.auth.admin.updateUserById(body.data.id, {
          ban_duration: body.data.banned ? "876000h" : "none",
        });
  return result.error
    ? NextResponse.json(
        { error: "The change could not be saved." },
        { status: 500 },
      )
    : NextResponse.json({ ok: true });
}
