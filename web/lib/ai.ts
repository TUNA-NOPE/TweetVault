const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function findRelevantCategories(
  query: string,
  categories: Record<string, string>
): Promise<{ categories: string[]; keywords: string[] }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const catList = Object.entries(categories)
    .map(([id, desc]) => `- ${id}: ${desc}`)
    .join("\n");

  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/TweetVault",
      "X-Title": "TweetVault Web",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content:
            "You help find relevant tweets. Given categories and a search query, " +
            "return the category IDs that match and keywords to text-search for. " +
            "Respond with ONLY valid JSON.",
        },
        {
          role: "user",
          content:
            `Categories:\n${catList}\n\n` +
            `Query: "${query}"\n\n` +
            `Return: {"categories": ["id1", "id2"], "keywords": ["word1", "word2"]}`,
        },
      ],
      temperature: 0.1,
      reasoning: { enabled: true },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenRouter API error ${resp.status}: ${body}`);
  }

  const data = await resp.json();
  const content: string = data.choices[0].message.content;

  let text = content.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(text);
    return {
      categories: parsed.categories || [],
      keywords: parsed.keywords || [],
    };
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return {
          categories: parsed.categories || [],
          keywords: parsed.keywords || [],
        };
      } catch {
        /* fall through */
      }
    }
    return { categories: [], keywords: [] };
  }
}
