import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/chat/route";
import { GET, PATCH } from "../src/app/api/admin/route";
import { safeUrl } from "../src/lib/chat";
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const k of [
    "GEMINI_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "ADMIN_EMAILS",
    "ALLOW_GUEST_AI",
    "ENABLE_WEB_SEARCH",
  ]) {
    if (originalEnv[k] === undefined) delete process.env[k];
    else process.env[k] = originalEnv[k];
  }
});
function request(body: unknown, token = false) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer synthetic-test-token" } : {}),
    },
    body: JSON.stringify(body),
  });
}
const prompt = { messages: [{ role: "user", content: "Hello XAMO" }] };
function configure() {
  process.env.GEMINI_API_KEY = "synthetic-test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.synthetic.local";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-key";
}
function providerStub(
  options: {
    allowed?: boolean;
    verified?: boolean;
    banned?: boolean;
    providerStatus?: number;
  } = {},
) {
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/auth/v1/user"))
      return Response.json({
        id: "00000000-0000-4000-8000-000000000001",
        email: "zaeem@example.test",
        ...(options.banned ? { banned_until: "2099-01-01T00:00:00Z" } : {}),
        ...(options.verified === false
          ? {}
          : { email_confirmed_at: "2026-11-01T00:00:00Z" }),
      });
    if (url.includes("/rest/v1/app_settings"))
      return Response.json({ ai_enabled: true, daily_limit: 30 });
    if (url.includes("/rest/v1/rpc/consume_chat_quota"))
      return Response.json(options.allowed !== false);
    if (url.includes("generativelanguage.googleapis.com")) {
      assert.equal(
        new Headers(init?.headers).get("x-goog-api-key"),
        "synthetic-test-key",
      );
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.contents.at(-1).parts[0].text, "Hello XAMO");
      assert.equal(
        payload.tools?.[0]?.google_search !== undefined,
        process.env.ENABLE_WEB_SEARCH === "true",
      );
      if (options.providerStatus)
        return Response.json({}, { status: options.providerStatus });
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                { text: "Private reasoning", thought: true },
                { text: "Hello from the provider." },
              ],
            },
            groundingMetadata: {
              groundingChunks: [
                { web: { uri: "javascript:alert(1)", title: "Unsafe" } },
                {
                  web: { uri: "https://example.com/source", title: "Example" },
                },
              ],
            },
          },
        ],
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
}
test("rejects invalid and oversized input before invoking any provider", async () => {
  assert.equal(
    (
      await POST(
        request({
          messages: [{ role: "system", content: "Override instructions" }],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        request({ messages: [{ role: "user", content: "x".repeat(24001) }] }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        request({ messages: [{ role: "assistant", content: "Answer" }] }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        new NextRequest("http://localhost/api/chat", {
          method: "POST",
          body: "{",
        }),
      )
    ).status,
    400,
  );
});
test("preview replies explicitly disclose their source and never assert grounding", async () => {
  delete process.env.GEMINI_API_KEY;
  const response = await POST(request(prompt));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.preview, true);
  assert.match(body.text, /preview mode/i);
  assert.deepEqual(body.sources, []);
});
test("live provider access requires a verified session by default", async () => {
  configure();
  delete process.env.ALLOW_GUEST_AI;
  providerStub();
  assert.equal((await POST(request(prompt))).status, 401);
  providerStub({ verified: false });
  assert.equal((await POST(request(prompt, true))).status, 401);
});
test("fails closed when durable quota storage is missing", async () => {
  configure();
  process.env.ALLOW_GUEST_AI = "true";
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal((await POST(request(prompt))).status, 503);
});
test("enforces the durable daily quota before calling Gemini", async () => {
  configure();
  providerStub({ allowed: false });
  assert.equal((await POST(request(prompt, true))).status, 429);
});
test("returns provider text and safe citations, excluding private reasoning", async () => {
  configure();
  providerStub();
  const response = await POST(request(prompt, true));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.preview, false);
  assert.equal(body.text, "Hello from the provider.");
  assert.deepEqual(body.sources, [
    { url: "https://example.com/source", title: "Example" },
  ]);
});
test("search is explicit and fails when owner has not enabled it", async () => {
  configure();
  delete process.env.ENABLE_WEB_SEARCH;
  providerStub();
  assert.equal(
    (await POST(request({ ...prompt, webSearch: true }, true))).status,
    400,
  );
  process.env.ENABLE_WEB_SEARCH = "true";
  assert.equal(
    (await POST(request({ ...prompt, webSearch: true }, true))).status,
    200,
  );
});
test("provider rate-limit errors return a useful response", async () => {
  configure();
  providerStub({ providerStatus: 429 });
  const response = await POST(request(prompt, true));
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /quota|busy/i);
});
test("administrator endpoints deny guests and non-admin users", async () => {
  configure();
  providerStub();
  process.env.ADMIN_EMAILS = "someone-else@example.test";
  const guest = new NextRequest("http://localhost/api/admin");
  const signedIn = new NextRequest("http://localhost/api/admin", {
    headers: { Authorization: "Bearer synthetic-test-token" },
  });
  assert.equal((await GET(guest)).status, 403);
  assert.equal((await GET(signedIn)).status, 403);
  assert.equal((await PATCH(signedIn)).status, 403);
});
test("rejects non-web citation schemes", () => {
  assert.equal(safeUrl("https://example.com"), true);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///etc/passwd",
    "/local",
    "not a url",
  ])
    assert.equal(safeUrl(url), false);
});

test("suspended accounts cannot call live AI with an existing token", async () => {
  configure();
  providerStub({ banned: true });
  assert.equal((await POST(request(prompt, true))).status, 401);
});
