import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}
export async function identify(req: NextRequest) {
  const client = serviceClient();
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!client || !token) return null;
  const { data, error } = await client.auth.getUser(token);
  return error ||
    !data.user?.email_confirmed_at ||
    (data.user?.banned_until && new Date(data.user.banned_until) > new Date())
    ? null
    : data.user;
}
export async function isAdmin(req: NextRequest) {
  const user = await identify(req);
  return (
    !!user?.email &&
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .includes(user.email.toLowerCase())
  );
}
