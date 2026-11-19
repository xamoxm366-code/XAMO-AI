<!-- coderabbit-ai-generated:v1 -->

# XAMO AI — Zaeem’s launch guide

XAMO AI is a responsive chat application built with Next.js, React, TypeScript, Gemini, and Supabase. Creator: **Zaeem**.

## What is ready

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:fd3f40891712c539c9a0a4c7d3aa27300ddea95c85ce78f60942088c4f72c7d1 -->

- Dark chat workspace, conversation search and deletion, local history, preferences, export, file analysis, and streamed replies with Fast/Thorough response options.

<!-- /coderabbit-ai-generated:v1 -->
- Sign-in, sign-up, Google sign-in, email verification instructions, forgot-password and password-update screens, wired to Supabase when configured.
- Server-side Gemini adapter, optional Google Search grounding with source links, request validation, and durable daily limits.
- Server-authorized admin dashboard: enable/pause AI, set daily message limits, list the first 100 accounts, suspend and restore users. Admins cannot read local conversations.
- Browser speech input and read-aloud controls. Available voices, language quality, and microphone support vary by browser and operating system. Speech services may process audio remotely.
- Language auto-detection through the model, plus explicit preferences for English, Urdu, Hindi, Arabic, Spanish, French, German, Chinese, Japanese, and Portuguese. Other languages can be requested directly in chat.

**Without provider configuration, chats return clearly labeled sample responses. They are not live AI or live web results.** Accounts and the admin dashboard require a configured Supabase project. Chat history stays on this browser and does not sync between accounts or devices. <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:e848083e380532e9e5ce8fe20c3d04013820d005621f17cbb364f735140a95d4 -->

When connected, conversation context and uploaded media or extracted file reports are sent to Gemini. Files expire within 48 hours; local history keeps file names and protected references, not the original file bytes.

<!-- /coderabbit-ai-generated:v1 -->

## A realistic zero-cost target

Aim for a useful, limited beta in 10 days. Free services can support an initial experiment within their current quotas; they cannot guarantee unlimited public AI. Do not enable paid billing to chase a zero-cost goal. Check eligibility, quotas, and terms in each provider dashboard before activating a service. A `vercel.app` address avoids buying a custom domain. Email delivery to public users may require an SMTP service and verified sending domain, so test that before advertising public registration.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:6adb69051036664ed1308a8add208a7bb5cd973585d0beeab746c2428ecb8b30 -->

Full Gemini feature parity, perfect speech in every language, and a secure Jarvis-style device assistant are beyond this beta. Image and video generation are excluded. Real-time voice conversations, cross-device history, account deletion, advanced moderation, admin audit logs, and device automation are future work.

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:8cb5307e3d43838ce7f098492c3289cc816f77cccb530d276f7bb44ec1900004 -->

## File analysis and response speed

Use **+** beside the message box, choose one file, wait for **Ready**, and send your question. A file can also be sent without a typed question. Follow-up questions retain available files from the conversation context.

| File type | Analysis supplied to Gemini |
| --- | --- |
| PNG, JPEG, WebP, HEIC/HEIF | Original image for visual analysis |
| GIF, BMP, AVIF, SVG supported by the browser | Converted PNG; animated images use one frame |
| PDF | Original PDF for text and page-image analysis, subject to the model's page/context limits |
| Common video/audio (including MP4, MOV, WebM, MP3, WAV) | Original media; wait for provider processing |
| Text, code, CSV, JSON, configuration files | Text report; large files use explicitly labeled beginning/end excerpts |
| ZIP, DOCX, XLSX, PPTX, EPUB and other ZIP containers | Bounded text extraction and file listing; embedded visuals/layout are omitted |
| APK | Static file list and available manifest text/strings; compiled code is not decompiled or executed |
| Other binaries/proprietary formats | File size, header and sampled printable strings; this is limited inspection, not full format understanding |

- Maximum original file size **100 MB**, or **50 MB for PDF**. Unsupported encodings, encrypted/damaged archives, model context/page limits and provider quotas can prevent analysis. Split large files or export to a supported format when needed. No universal decoder or unlimited file support is claimed.
- <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:757d1bb9ce3823e2cdd8e5d68a53eb2077c6d2edc618ea356a8921e8e4af657d -->

Small uploads use the server relay (at most 2 MB per request). When Gemini requires 8 MB chunks, larger files upload directly to a temporary Gemini session for a server-reserved random file name. The project API key stays on the server; completion rechecks file ownership, size and MIME type before issuing a usable reference. Processing status is polled separately, including for long videos.

<!-- /coderabbit-ai-generated:v1 --> Cancellation stops further work; Gemini automatically deletes uploaded files within 48 hours. Reattach expired files or files uploaded under a different account/session.
- Each upload start and each AI request consumes one unit of the existing daily quota, including failed attempts. Uploads use the existing server-only Gemini key and account/guest authorization; no new service or environment variable is required. The chosen Gemini model must support the media being analyzed.
- Extraction runs in a browser worker. Archives are bounded to 1,000 listed entries, 60 selected text entries, 1 MB per entry and 2 MB total expanded text. <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4624a9d07957e21ad38bfc961c10d4fd472e30f8e807a4a7a434244da9d1f719 -->

Extracted body text is capped at 200,000 characters, plus the bounded file listing; omitted sections are identified.

<!-- /coderabbit-ai-generated:v1 --> Programs and APKs are never run, and static inspection cannot certify software safety.
- **Fast** is the default and reduces the model's reasoning effort on known Gemini 2.5/3 model families. Choose **Thorough** for deeper analysis when quality matters more than latency. Other models use their defaults. Answers stream as they are generated; **Stop** cancels generation and preserves clearly labeled partial text. This improves time to visible text, and does not guarantee faster provider computation or bypass quotas.

## Day 1 — Open the project in VS Code

<!-- /coderabbit-ai-generated:v1 -->

1. Install VS Code, Git, and a maintained Node.js version supported by Next.js. This project was checked with Node 24 and npm 11.
2. In VS Code, open **Terminal → New Terminal**.
3. Clone your repository and open it:

```bash
git clone https://github.com/xamoxm366-code/XAMO-AI.git
cd XAMO-AI
code .
```

4. If the new files are on the coding-task branch, select `coderabbit/build-xamo-ai-assistant/c906b6e4` in VS Code’s branch picker.
5. In the project terminal, run:

```bash
npm ci
```

6. Copy `.env.example` to `.env.local` in the project root. On macOS/Linux use `cp .env.example .env.local`; in PowerShell use `Copy-Item .env.example .env.local`. You can also copy and rename it in VS Code.
7. Start the app:

```bash
npm run dev
```

8. Open `http://localhost:3000`. Try a starter card, send a message, save preferences, and search your history. No accounts or API keys are needed for the sample preview.

## Day 2 — Personalize and understand the files

- `src/components/workspace.tsx`: chat workspace, account screens, settings, and admin UI.
- `src/app/globals.css`: colors, typography, layout, and responsive styles.
- `src/app/api/chat/route.ts`: validation, verified-user checks, daily quotas, and provider requests.
- `src/app/api/admin/route.ts`: server authorization and admin controls.
- `src/lib/server.ts`: trusted Supabase user checks and server-only admin allowlist.
- `supabase/schema.sql`: settings and quota storage.
- `.env.local`: private local configuration. Never commit this file or paste secrets into chat.

The browser receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. All other keys stay on the server. Never rename the Gemini key or service-role key to start with `NEXT_PUBLIC_`.

## Day 3 — Create Supabase storage and email accounts

1. Open [Supabase](https://supabase.com/dashboard) and create a project using the free plan if available for your account. Save the database password privately.
2. In project settings, find the API URL and anonymous/public key. Add their values to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
3. Find the server service-role key in the API key settings. Add it to `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. This privileged key must never appear in browser code, logs, or GitHub.
4. Open **SQL Editor → New query**. Paste the contents of `supabase/schema.sql` and run it once. The two tables use row-level security and deny browser roles direct access. Only the server can consume quotas or change controls.
5. Under **Authentication → Providers → Email**, enable email/password and **Confirm email**. Set a password minimum of at least 8 characters.
6. Under **Authentication → URL Configuration**, use `http://localhost:3000` as the local Site URL and add that exact URL to the allowed redirects.
7. Inspect Supabase’s current email restrictions. Configure an SMTP provider for delivery to public users if required. A successful sign-up request is not evidence that email delivery is ready.
8. Restart `npm run dev` after editing environment variables.

## Day 4 — Connect real AI

1. Open [Google AI Studio](https://aistudio.google.com/) and create a Gemini API key for an eligible project. Check the current free quota and regional availability.
2. Put the key in `GEMINI_API_KEY` in `.env.local`.
3. `GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`, a model listed in Google’s documentation when this guide was written. Select a currently available text model eligible for your intended plan; availability and quotas change.
4. Keep `ALLOW_GUEST_AI=false`. Live AI will require a verified account; guest visitors can explore the interface. Before the AI key is connected, guests receive sample replies.
5. Keep `ENABLE_WEB_SEARCH=false` until Day 7. Search grounding can have separate charges and usage terms.
6. Restart the app. Sign up, verify your email, sign in, and ask a question. A real model answer does not carry the preview label.
7. Check the provider’s usage dashboard. The default app limit is 30 requests per user per UTC day. The app also has input and output limits; provider-side quotas remain essential. Provider attempts, including failed attempts, count toward the app’s limit.

The AI will refuse to run if durable quota storage is missing. Do not remove that check to make a setup error disappear.

## Day 5 — Connect Google sign-in

1. Open [Google Cloud Console](https://console.cloud.google.com/), choose your project, and configure the OAuth consent screen. Add your app name, support email, and required test users while in testing mode.
2. Create an OAuth client of type **Web application**.
3. In **Supabase → Authentication → Providers → Google**, copy the callback URL. It normally looks like `https://YOUR_PROJECT.supabase.co/auth/v1/callback`.
4. Add that exact callback URL as an authorized redirect URI on the Google OAuth client.
5. Add `http://localhost:3000` to the authorized JavaScript origins where required.
6. Copy the Google client ID and secret into the Google provider settings in Supabase and enable the provider. These values do not belong in this app’s public environment variables.
7. Use **Sign in → Continue with Google**. Confirm you return to your workspace and see the correct account. Public release can require Google’s consent-screen publishing or verification process.

## Day 6 — Activate Zaeem’s admin panel

1. Set `ADMIN_EMAILS` in `.env.local` to your exact verified account email. For more than one trusted admin, use comma-separated addresses.
2. Restart the app and sign in with that verified account.
3. **Admin dashboard** appears in the sidebar only after the server verifies your account and email allowlist.
4. Test pausing AI, saving a small daily limit, restoring AI, and suspending a separate synthetic test account. The admin screen intentionally disables suspending your currently signed-in account.
5. Test a normal user and a guest: neither should see admin controls, and direct requests to `/api/admin` must return `403`.

Service credentials and environment variables are managed through your hosting dashboard; the admin UI does not expose them. Guest preview visitors are not Supabase accounts and do not appear in the user list. Admin user management shows the first 100 accounts in this beta.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:5939c76475158b7a6c9475a283cafb4b0d75a0f6e93e8f1e8bdfaaa1adf12ec9 -->

## Day 7 — Live information and voice

1. For a limited free search option, create a free [Tavily account](https://app.tavily.com/). Basic searches currently use one credit each; check [current credits and pricing](https://docs.tavily.com/documentation/api-credits) before enabling it.
2. Add the Tavily key as server-only `TAVILY_API_KEY` in `.env.local` and Vercel's Production environment. Set `ENABLE_WEB_SEARCH=true` in the same environments, then restart locally or redeploy on Vercel. Never share the key or put it in a `NEXT_PUBLIC_` variable.
3. Turn on **Web search** in the composer. Your question is sent to the search provider; the attached file is excluded from that search query. Search snippets are sent to Gemini to produce the answer. Review the source links and check important claims.
4. When a Tavily key is configured, XAMO uses Tavily. Without it, enabled search uses Google Search grounding; that feature may need a paid tier and has separate terms, charges, and display requirements. Check [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) before enabling it. Failed Tavily requests do not fall back to Google search.
5. Try microphone dictation and read-aloud in Chrome, with permission granted. Test the specific languages and devices you plan to support. Browser voice controls are not a real-time Gemini voice conversation.
6. Free credits and AI quotas are limited and shared by everyone using the project. Monitor both dashboards; no provider guarantees unlimited free usage.



<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:83a524d308c7a230e8edc113a8f75fd9673268b31fba92a2b89132c1eb07af6f -->

<!-- /coderabbit-ai-generated:v1 -->

## Day 8 — Test before launch

<!-- /coderabbit-ai-generated:v1 -->

Run these in the VS Code terminal:

```bash
npm test
npm run typecheck
npm run build
```

Then check:

- Guest chat preview without provider configuration; honest errors when live AI requires sign-in.
- Email sign-up, actual delivery of the verification message, verification, sign-in, and sign-out.
- Forgot-password email, reset link, password update, and sign-in using the new password.
- Google sign-in with a permitted test account.
- A real AI conversation, a non-English conversation, and web sources if enabled.
- Daily limit enforcement, an intentionally unavailable provider, admin access denial for normal users, and suspension of a test account.
- Refresh persistence, conversation search/delete, local export, file attachment limits, mobile navigation, and keyboard access.
- Shared-device behavior: local chat history is shared by people using the same browser profile. Clear/export chats before sharing a device. Signing in does not sync or isolate local history.

Tests cover API behavior with synthetic provider responses. They do not prove real OAuth, email delivery, or live model quality. The database quota script was separately exercised using a temporary PostgreSQL-compatible PGlite instance; run the schema and integration checks against your actual Supabase project as well.

## Day 9 — GitHub and Vercel

1. Save your changes in VS Code. Inspect Source Control and make sure `.env.local` is ignored.
2. Commit and push the application files to your GitHub repository using VS Code’s Source Control panel.
3. Open [Vercel’s import screen](https://vercel.com/new) and import `XAMO-AI`. Check that the selected branch contains the app. Keep the framework preset as Next.js.
4. Add the same environment variable names from `.env.local` in the Vercel project settings. Use production values. Public Supabase variables are read at build time, so redeploy after changing them.
5. Deploy and wait for a successful build. Vercel gives the deployment a `vercel.app` URL. Check the current [Hobby plan terms](https://vercel.com/docs/plans/hobby) and limits against your intended use.
6. In Supabase URL Configuration, set the production Site URL to your final HTTPS address and add it to allowed redirects. Keep localhost only if you still need local development.
7. Update Google OAuth authorized origins for your production URL as required. The Supabase callback URL remains the provider callback.

## Day 10 — Verify production and share your beta

Repeat the Day 8 checklist on the final HTTPS URL with synthetic accounts. Watch Supabase and Gemini quotas, verify mail delivery, and start with a small invitation group. Set an affordable provider quota and leave guest AI disabled unless you have an abuse-control plan. The optional guest mode uses Vercel’s forwarded client address for per-IP quotas; it is intended for that hosting gateway and should remain disabled on other hosts until adapted.

Do not describe this beta as unlimited, perfect in every language, or capable of controlling devices. Publish clear privacy information before inviting public users; cover local history, Supabase accounts, Gemini prompts/files, browser speech processing, and retention. Add operational controls and a deletion workflow as your audience grows.

## Device assistant: separate follow-up phase

A normal website cannot open/close arbitrary apps, inspect other apps’ messages, identify who is typing, or read private device notifications. A device companion would need platform-specific APIs, explicit user permissions, visible start/stop controls, a narrow action allowlist, confirmations for consequential actions, and secure authentication between the companion and your web app. Windows, Android, iOS, macOS, and Linux require different implementations. Start by choosing **one** platform after the web beta works. No device-control capability is claimed in this version.

## Useful references

- [Gemini models](https://ai.google.dev/gemini-api/docs/models) and [Gemini content-generation API](https://ai.google.dev/api/generate-content)
- [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase password reset API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
