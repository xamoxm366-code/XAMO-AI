<!-- coderabbit-ai-generated:v1 -->

# XAMO AI — Zaeem’s launch guide

XAMO AI is a responsive chat application built with Next.js, React, TypeScript, Gemini, and Supabase. Creator: **Zaeem**.

## What is ready

- Dark chat workspace, conversation search and deletion, local history, preferences, export, and text attachments (TXT, Markdown, CSV, JSON; up to 20 KB).
- Sign-in, sign-up, Google sign-in, email verification instructions, forgot-password and password-update screens, wired to Supabase when configured.
- Server-side Gemini adapter, optional Google Search grounding with source links, request validation, and durable daily limits.
- Server-authorized admin dashboard: enable/pause AI, set daily message limits, list the first 100 accounts, suspend and restore users. Admins cannot read local conversations.
- Browser speech input and read-aloud controls. Available voices, language quality, and microphone support vary by browser and operating system. Speech services may process audio remotely.
- Language auto-detection through the model, plus explicit preferences for English, Urdu, Hindi, Arabic, Spanish, French, German, Chinese, Japanese, and Portuguese. Other languages can be requested directly in chat.

**Without provider configuration, chats return clearly labeled sample responses. They are not live AI or live web results.** Accounts and the admin dashboard require a configured Supabase project. Chat history stays on this browser and does not sync between accounts or devices. When connected, conversation context and attached text are sent to Gemini.

## A realistic zero-cost target

Aim for a useful, limited beta in 10 days. Free services can support an initial experiment within their current quotas; they cannot guarantee unlimited public AI. Do not enable paid billing to chase a zero-cost goal. Check eligibility, quotas, and terms in each provider dashboard before activating a service. A `vercel.app` address avoids buying a custom domain. Email delivery to public users may require an SMTP service and verified sending domain, so test that before advertising public registration.

Full Gemini feature parity, perfect speech in every language, and a secure Jarvis-style device assistant are beyond this beta. Image and video generation are excluded. PDF/image analysis, real-time voice conversations, cross-device history, account deletion, advanced moderation, streaming replies, admin audit logs, and device automation are future work.

## Day 1 — Open the project in VS Code

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

## Day 7 — Live information and voice

1. Read the [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Google Search grounding documentation](https://ai.google.dev/gemini-api/docs/google-search), including source and search-suggestion display requirements for your chosen model/API.
2. If the available quota and terms fit your zero-cost constraint, set `ENABLE_WEB_SEARCH=true`, restart, and enable **Web search** in the composer. Otherwise leave it off.
3. Ask a question that needs current information. Confirm the result has real source links and that they support the answer. The app displays provider-supplied search suggestions in a sandboxed frame; verify their display against the applicable provider requirements before public launch.
4. Try microphone dictation and read-aloud in Chrome, with permission granted. Test the specific languages and devices you plan to support. Browser voice controls are not a real-time Gemini voice conversation.
5. Check answers manually. Search grounding improves access to sources but cannot guarantee correctness.

## Day 8 — Test before launch

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
