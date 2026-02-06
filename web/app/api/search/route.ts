import { NextRequest, NextResponse } from "next/server";
import {
  getClassifiedTweets,
  getCategoryDescriptions,
  searchTweets,
} from "@/lib/data";
import { findRelevantCategories } from "@/lib/ai";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const mode = request.nextUrl.searchParams.get("mode") || "text";

  if (!q.trim()) {
    return NextResponse.json({ tweets: [] });
  }

  // Text search — keyword matching
  if (mode === "text") {
    const results = searchTweets(q);
    return NextResponse.json({ tweets: results });
  }

  // AI search — ask the model which categories match, then filter
  try {
    const descriptions = getCategoryDescriptions();
    const { categories, keywords } = await findRelevantCategories(
      q,
      descriptions
    );

    const allTweets = getClassifiedTweets();

    // Tweets from AI-matched categories
    const byCategory = allTweets.filter((t) =>
      t.categories.some((c) => categories.includes(c))
    );

    // Tweets matching AI-suggested keywords
    const byKeyword = allTweets.filter((t) => {
      const haystack = `${t.text} ${t.author}`.toLowerCase();
      return keywords.some((k) => haystack.includes(k.toLowerCase()));
    });

    // Merge, deduplicate (category matches first)
    const seen = new Set<string>();
    const merged = [...byCategory, ...byKeyword].filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    return NextResponse.json({
      tweets: merged,
      matchedCategories: categories,
      suggestedKeywords: keywords,
    });
  } catch (error: any) {
    return NextResponse.json(
      { tweets: [], error: error.message },
      { status: 500 }
    );
  }
}
