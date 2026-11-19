// Parse lines incrementally, including split UTF-8 characters and CRLF frames.
export async function* lines(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 2_000_000)
        throw new Error("Response frame is too large.");
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);
        yield line;
      }
      if (done) break;
    }
    if (buffer.trim()) yield buffer;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function* geminiEvents(body: ReadableStream<Uint8Array>) {
  let data: string[] = [];
  for await (const line of lines(body)) {
    if (!line) {
      if (data.length) {
        const value = data.join("\n");
        if (value !== "[DONE]") yield JSON.parse(value);
        data = [];
      }
    } else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (data.length && data.join("\n") !== "[DONE]")
    yield JSON.parse(data.join("\n"));
}
