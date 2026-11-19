import { z } from "zod";
export const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(24000),
        attachments: z
          .array(
            z.object({
              name: z.string().min(1).max(240),
              size: z
                .number()
                .int()
                .positive()
                .max(100 * 1024 * 1024),
              mimeType: z.string().max(100),
              token: z.string().min(1).max(6000),
              expiresAt: z.number(),
              note: z.string().max(300).optional(),
            }),
          )
          .max(4)
          .optional(),
      }),
    )
    .min(1)
    .max(40),
  webSearch: z.boolean().default(false),
  stream: z.boolean().default(false),
  speed: z.enum(["fast", "thorough"]).default("fast"),
  language: z.string().max(50).default("Auto-detect"),
  persona: z
    .enum(["Balanced", "Concise", "Creative", "Teacher"])
    .default("Balanced"),
});
export function safeUrl(value: string): boolean {
  try {
    return ["https:", "http:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export function previewReply(prompt: string) {
  if (/\b(date|time|day is it)\b/i.test(prompt))
    return `Your device can show the current date and time using the clock button beside the composer.\n\nThis is **preview mode**. Connect an AI provider to get conversational answers and live search.`;
  if (/plan|productive|week|day/i.test(prompt))
    return `Here's a simple way to make room for what matters:\n\n1. **Pick your big three.** Write down three outcomes that would make today feel successful.\n2. **Make time for focus.** Give your most important task a quiet, 45-minute block.\n3. **Leave a little space.** Add breaks and room for the unexpected.\n4. **Close the loop.** Take five minutes tonight to reflect and plan tomorrow.\n\n*This is a sample response in preview mode. Connect an AI provider for a plan tailored to you.*`;
  if (/write|story|creative/i.test(prompt))
    return `Every great idea starts with a small spark. Here's a writing prompt to get yours going:\n\n> A letter arrives at your door. The handwriting is yours, but the date is ten years from now.\n\nTry writing the first three sentences. Who are you in that future, and what's the one thing you need to know today?\n\n*This is a sample response in preview mode. Connect an AI provider for original writing based on your request.*`;
  return `Welcome to **XAMO AI**, created by **Zaeem**. This workspace is ready for your ideas.\n\nYou can already save conversations on this device, organize your chats, attach text files, and customize your preferences.\n\nTo answer your question with a real AI model, the owner needs to add a Gemini API key in the server environment. Open **Settings → Setup guide** for the next steps.\n\n*Preview mode does not search the web or generate AI answers.*`;
}
