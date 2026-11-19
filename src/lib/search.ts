import { safeUrl } from "./chat";

export type SearchSource = { url: string; title: string; content: string };

export class SearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function searchTavily(
  userMessage: string,
  key: string,
): Promise<SearchSource[]> {
  // Attached files are meant for the assistant, not for the search query.
  const query = userMessage
    .split("\n\nAttached file: ")[0]
    .slice(0, 400)
    .trim();
  if (!query)
    throw new SearchError("Please enter a question to search for.", 400);

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        auto_parameters: false,
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new SearchError("Web search is unavailable. Please try again.", 502);
  }
  if (!response.ok) {
    if (response.status === 429 || response.status === 432)
      throw new SearchError(
        "Web search has reached its usage limit. Please try later.",
        429,
      );
    throw new SearchError(
      "Web search is unavailable. Please try again later.",
      502,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new SearchError(
      "Web search returned an invalid response. Please try again.",
      502,
    );
  }
  const results = (data as { results?: unknown })?.results;
  if (!Array.isArray(results))
    throw new SearchError(
      "Web search returned an invalid response. Please try again.",
      502,
    );
  const sources: SearchSource[] = [];
  for (const result of results.slice(0, 5)) {
    if (
      !result ||
      typeof result.url !== "string" ||
      result.url.length > 2048 ||
      !safeUrl(result.url) ||
      typeof result.content !== "string" ||
      !result.content.trim()
    )
      continue;
    sources.push({
      url: result.url,
      title:
        typeof result.title === "string"
          ? result.title.slice(0, 200)
          : "Source",
      content: result.content.slice(0, 2000),
    });
  }
  if (!sources.length)
    throw new SearchError(
      "Web search found no usable sources. Try a different question.",
      422,
    );
  return sources;
}
