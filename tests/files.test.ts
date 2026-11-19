import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { zipSync, strToU8 } from "fflate";
import { POST as upload, PUT as chunk } from "../src/app/api/files/route";
import { POST as chat } from "../src/app/api/chat/route";
import { CHUNK_BYTES, MAX_FILE_BYTES, mediaType } from "../src/lib/files";
import { sealFile, openFile, type FileTicket } from "../src/lib/file-tokens";
import { inspectFile } from "../src/lib/inspect-file";
import { geminiEvents } from "../src/lib/stream";
const originalFetch = globalThis.fetch,
  originalEnv = { ...process.env };
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "ALLOW_GUEST_AI",
    "ENABLE_WEB_SEARCH",
  ]) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});
const owner = "00000000-0000-4000-8000-000000000001";
const ticket: FileTicket = {
  kind: "file",
  owner,
  name: "sample.pdf",
  mimeType: "application/pdf",
  size: 30,
  expiresAt: Date.now() + 60000,
  target: "files/synthetic123",
};
function request(data: unknown, authenticated = true) {
  return new NextRequest("http://localhost/api/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: "Bearer synthetic-session" } : {}),
    },
    body: JSON.stringify(data),
  });
}
function setup(allowed = true) {
  process.env.GEMINI_API_KEY = "synthetic-key";
  process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.synthetic.local";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "synthetic-service";
  delete process.env.ALLOW_GUEST_AI;
  delete process.env.ENABLE_WEB_SEARCH;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/auth/v1/user"))
      return Response.json({
        id: owner,
        email: "synthetic@example.test",
        email_confirmed_at: "2026-11-01T00:00:00Z",
      });
    if (url.includes("/rest/v1/app_settings"))
      return Response.json({ ai_enabled: true, daily_limit: 30 });
    if (url.includes("consume_chat_quota")) return Response.json(allowed);
    throw new Error(`Unexpected upstream: ${url}`);
  };
  return calls;
}
function fixture(file = { name: "files/synthetic123", state: "ACTIVE" }) {
  return { file };
}
test("encrypted file capabilities reject tampering, expiry, a different owner, and wrong purpose", () => {
  setup();
  const sealed = sealFile(ticket);
  assert.equal(openFile(sealed, owner, "file").target, ticket.target);
  assert.ok(
    !sealed.includes("sample.pdf") && !sealed.includes("synthetic-key"),
  );
  for (const run of [
    () => openFile(sealed, "other", "file"),
    () => openFile(sealed, owner, "upload"),
    () => openFile(`${sealed.slice(0, 20)}x${sealed.slice(21)}`, owner, "file"),
    () => openFile(sealFile({ ...ticket, expiresAt: 1 }), owner, "file"),
  ])
    assert.throws(run, /attach it again/);
});
test("uploads enforce authentication, durable quotas, types and size before starting provider uploads", async () => {
  let calls = setup(false);
  assert.equal(
    (
      await upload(
        request(
          {
            action: "start",
            name: "test.png",
            mimeType: "image/png",
            size: 10,
          },
          false,
        ),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await upload(
        request({
          action: "start",
          name: "test.png",
          mimeType: "image/png",
          size: 10,
        }),
      )
    ).status,
    429,
  );
  calls = setup();
  for (const value of [
    { size: MAX_FILE_BYTES + 1, mimeType: "image/png" },
    { size: 0, mimeType: "image/png" },
    { size: 10, mimeType: "application/x-executable" },
    { size: 51 * 1024 * 1024, mimeType: "application/pdf" },
  ])
    assert.equal(
      (await upload(request({ action: "start", name: "sample", ...value })))
        .status,
      400,
    );
  assert.ok(!calls.some((url) => url.includes("/upload/")));
});
test("resumable upload preserves bytes and offsets, keeps secrets server-side, and handles processing video", async () => {
  const calls = setup();
  const base = globalThis.fetch;
  const target =
    "https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=synthetic";
  let chunks = 0,
    polls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input),
      headers = new Headers(init?.headers);
    if (url.endsWith("/upload/v1beta/files")) {
      assert.equal(headers.get("x-goog-api-key"), "synthetic-key");
      assert.equal(
        headers.get("x-goog-upload-header-content-length"),
        String(CHUNK_BYTES + 3),
      );
      return new Response(null, { headers: { "x-goog-upload-url": target } });
    }
    if (url === target) {
      assert.equal(headers.get("x-goog-api-key"), null);
      assert.equal(
        headers.get("x-goog-upload-offset"),
        String(chunks * CHUNK_BYTES),
      );
      const bytes = new Uint8Array(init?.body as Uint8Array);
      assert.ok(bytes.every((b) => b === 77));
      assert.equal(bytes.length, chunks === 0 ? CHUNK_BYTES : 3);
      assert.equal(
        headers.get("x-goog-upload-command"),
        chunks === 0 ? "upload" : "upload, finalize",
      );
      chunks++;
      return chunks === 1
        ? new Response(null, {
            status: 308,
            headers: { "x-goog-upload-status": "active" },
          })
        : Response.json(
            fixture({ name: "files/synthetic123", state: "PROCESSING" }),
          );
    }
    if (url.endsWith("/v1beta/files/synthetic123")) {
      polls++;
      return Response.json({ name: "files/synthetic123", state: "ACTIVE" });
    }
    return base(input, init);
  };
  let data = await (
    await upload(
      request({
        action: "start",
        name: "clip.mp4",
        size: CHUNK_BYTES + 3,
        mimeType: "video/mp4",
      }),
    )
  ).json();
  assert.ok(data.token);
  assert.ok(!JSON.stringify(data).includes("upload_id"));
  for (const length of [CHUNK_BYTES, 3]) {
    const response = await chunk(
      new NextRequest("http://localhost/api/files", {
        method: "PUT",
        headers: {
          Authorization: "Bearer synthetic-session",
          "x-upload-token": data.token,
        },
        body: new Uint8Array(length).fill(77),
      }),
    );
    assert.equal(response.status, 200);
    data = await response.json();
  }
  assert.equal(data.state, "processing");
  const active = await (
    await upload(request({ action: "status", token: data.attachment.token }))
  ).json();
  assert.equal(active.state, "ready");
  assert.equal(polls, 1);
  assert.equal(chunks, 2);
  assert.equal(
    calls.filter((url) => url.includes("consume_chat_quota")).length,
    1,
  );
  assert.equal(
    openFile(active.attachment.token, owner, "file").mimeType,
    "video/mp4",
  );
});
test("upload chunks reject oversized bodies and cannot substitute a destination URL", async () => {
  const calls = setup();
  const token = sealFile({
    ...ticket,
    kind: "upload",
    target: "https://generativelanguage.googleapis.com/upload/v1beta/files",
    size: CHUNK_BYTES + 2,
    offset: 0,
  });
  const bad = await chunk(
    new NextRequest("http://localhost/api/files", {
      method: "PUT",
      headers: {
        Authorization: "Bearer synthetic-session",
        "x-upload-token": token,
      },
      body: new Uint8Array(CHUNK_BYTES + 1),
    }),
  );
  assert.equal(bad.status, 413);
  assert.ok(!calls.some((url) => url.includes("googleapis.com")));
  const base = globalThis.fetch;
  globalThis.fetch = async (input, init) =>
    String(input).endsWith("/upload/v1beta/files")
      ? new Response(null, {
          headers: { "x-goog-upload-url": "https://evil.invalid/steal" },
        })
      : base(input, init);
  assert.equal(
    (
      await upload(
        request({
          action: "start",
          name: "test.png",
          size: 10,
          mimeType: "image/png",
        }),
      )
    ).status,
    400,
  );
});
test("chat sends native file data, preserves later file context, and rejects forged or expired new uploads", async () => {
  const calls = setup(),
    base = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes(":generateContent")) {
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.contents[0].parts[1], {
        fileData: {
          mimeType: "application/pdf",
          fileUri:
            "https://generativelanguage.googleapis.com/v1beta/files/synthetic123",
        },
      });
      assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "LOW");
      return Response.json({
        candidates: [
          { content: { parts: [{ text: "Synthetic PDF summary" }] } },
        ],
      });
    }
    return base(input, init);
  };
  const attachment = { ...ticket, token: sealFile(ticket) };
  assert.equal(
    (
      await chat(
        request({
          messages: [
            { role: "user", content: "Summarize", attachments: [attachment] },
          ],
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await chat(
        request({
          messages: [
            {
              role: "user",
              content: "Summarize",
              attachments: [{ ...attachment, token: "forged" }],
            },
          ],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    calls.filter((url) => url.includes("consume_chat_quota")).length,
    1,
  );
  assert.equal(
    (
      await chat(
        request({
          messages: [
            {
              role: "user",
              content: "Summary?",
              attachments: [
                { ...attachment, token: sealFile({ ...ticket, expiresAt: 1 }) },
              ],
            },
          ],
        }),
      )
    ).status,
    400,
  );
});
test("streaming sends the first answer before completion, excludes thought text, and returns safe sources", async () => {
  setup();
  const base = globalThis.fetch;
  let finish!: () => void;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes(":streamGenerateContent?alt=sse")) {
      assert.equal(
        JSON.parse(String(init?.body)).generationConfig.thinkingConfig
          .thinkingLevel,
        "HIGH",
      );
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "secret", thought: true }, { text: "First answer" }] } }] })}\r\n\r\n`,
              ),
            );
            finish = () => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: " continues." }] }, finishReason: "STOP", groundingMetadata: { groundingChunks: [{ web: { uri: "javascript:bad" } }, { web: { uri: "https://example.com", title: "Source" } }] } }] })}\n\n`,
                ),
              );
              controller.close();
            };
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }
    return base(input, init);
  };
  const response = await chat(
    request({
      messages: [{ role: "user", content: "Hello" }],
      stream: true,
      speed: "thorough",
    }),
  );
  const reader = response.body!.getReader();
  const first = new TextDecoder().decode((await reader.read()).value);
  assert.match(first, /First answer/);
  assert.doesNotMatch(first, /secret|done/);
  finish();
  let rest = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    rest += new TextDecoder().decode(value);
  }
  assert.match(rest, /"done":true/);
  assert.match(rest, /https:\/\/example.com/);
  assert.doesNotMatch(rest, /javascript/);
});
test("truncated provider streams yield an explicit error instead of false success", async () => {
  setup();
  const base = globalThis.fetch;
  globalThis.fetch = async (input, init) =>
    String(input).includes(":streamGenerateContent")
      ? new Response(
          `data: {"candidates":[{"content":{"parts":[{"text":"Partial"}]}}]}\n\n`,
        )
      : base(input, init);
  const response = await chat(
    request({ messages: [{ role: "user", content: "Hello" }], stream: true }),
  );
  const text = await response.text();
  assert.match(text, /Partial/);
  assert.match(text, /ended early/);
  assert.doesNotMatch(text, /"done":true/);
});
test("SSE parser handles fragmented UTF-8, CRLF, and multiple events", async () => {
  const bytes = new TextEncoder().encode(
    'data: {"text":"اردو 🌍"}\r\n\r\ndata: {"text":"two"}\n\n',
  );
  const events = [];
  for await (const event of geminiEvents(
    new ReadableStream({
      start(c) {
        for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
        c.close();
      },
    }),
  ))
    events.push(event);
  assert.deepEqual(events, [{ text: "اردو 🌍" }, { text: "two" }]);
});
test("file inspection reads code and Office text, bounds expansion, and labels APK/binary limitations", async () => {
  assert.equal(mediaType("Photo.JPG"), "image/jpeg");
  assert.equal(mediaType("movie.mp4"), "video/mp4");
  assert.match(
    (await inspectFile(new File(["export const answer = 42;"], "sample.ts")))
      .text,
    /answer = 42/,
  );
  const office = zipSync({
    "word/document.xml": strToU8("<w:p>Hello document</w:p>"),
  });
  assert.match(
    (await inspectFile(new File([office], "test.docx"))).text,
    /Hello document/,
  );
  const apk = zipSync({
    "AndroidManifest.xml": new Uint8Array([
      3,
      0,
      8,
      0,
      ...strToU8("android.permission.CAMERA"),
    ]),
    "oversized.txt": new Uint8Array(3 * 1024 * 1024).fill(65),
  });
  const report = await inspectFile(new File([apk], "app.apk"));
  assert.match(report.note, /no execution/);
  assert.match(report.text, /android.permission.CAMERA/);
  assert.ok(report.text.length < 210000);
  const binary = await inspectFile(
    new File([new Uint8Array([0, 1, 2, 255, 0, 0])], "unknown.bin"),
  );
  assert.match(binary.text, /Not executed or decompiled/);
  const manifest = zipSync({
    "AndroidManifest.xml": strToU8(
      '<manifest package="example.app"><uses-permission android:name="android.permission.CAMERA"/></manifest>',
    ),
  });
  assert.match(
    (await inspectFile(new File([manifest], "plain.apk"))).text,
    /android.permission.CAMERA/,
  );
  const multilingual = await inspectFile(
    new File(["اردو 🌍".repeat(40000)], "large-urdu.txt"),
  );
  assert.match(multilingual.note, /Large text/);
  assert.match(multilingual.text, /اردو/);
  const large = await inspectFile(
    new File(["A".repeat(250000), "END-MARKER"], "large.py"),
  );
  assert.match(large.note, /middle omitted/);
  assert.match(large.text, /END-MARKER/);
  assert.ok(large.text.length < 210000);
});

test("expired historical files are disclosed and omitted while text follow-ups still work", async () => {
  setup();
  const base = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes(":generateContent")) {
      const payload = JSON.parse(String(init?.body));
      assert.match(payload.contents[0].parts[1].text, /no longer available/);
      assert.ok(!JSON.stringify(payload.contents).includes("fileUri"));
      return Response.json({
        candidates: [
          {
            content: { parts: [{ text: "Please reattach the earlier file." }] },
          },
        ],
      });
    }
    return base(input, init);
  };
  const expired = {
    ...ticket,
    expiresAt: 1,
    token: sealFile({ ...ticket, expiresAt: 1 }),
  };
  assert.equal(
    (
      await chat(
        request({
          messages: [
            { role: "user", content: "Earlier file", attachments: [expired] },
            { role: "assistant", content: "Earlier answer" },
            { role: "user", content: "Can we continue?" },
          ],
        }),
      )
    ).status,
    200,
  );
});
test("file processing failures and upstream quota errors remain actionable", async () => {
  setup();
  const base = globalThis.fetch;
  globalThis.fetch = async (input, init) =>
    String(input).endsWith("/v1beta/files/synthetic123")
      ? Response.json({ name: "files/synthetic123", state: "FAILED" })
      : base(input, init);
  assert.equal(
    (await upload(request({ action: "status", token: sealFile(ticket) })))
      .status,
    422,
  );
  globalThis.fetch = async (input, init) =>
    String(input).endsWith("/upload/v1beta/files")
      ? new Response(null, { status: 429 })
      : base(input, init);
  const response = await upload(
    request({
      action: "start",
      name: "test.png",
      size: 10,
      mimeType: "image/png",
    }),
  );
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /quota/);
});
