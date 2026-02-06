"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import TweetCard from "@/components/tweet-card";
import type { Tweet } from "@/lib/data";

interface SearchResult {
  tweets: Tweet[];
  matchedCategories?: string[];
  suggestedKeywords?: string[];
  error?: string;
}

function SearchResults() {
  const params = useSearchParams();
  const q = params.get("q") || "";
  const mode = params.get("mode") || "text";
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    setResult(null);
    fetch(`/api/search?q=${encodeURIComponent(q)}&mode=${mode}`)
      .then((r) => r.json())
      .then(setResult)
      .catch(() => setResult({ tweets: [], error: "Search failed" }))
      .finally(() => setLoading(false));
  }, [q, mode]);

  if (!q) {
    return (
      <p className="text-zinc-500 mt-8">
        Enter a query in the search bar above.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100">
          {mode === "ai" ? "AI Search" : "Search"}: &ldquo;{q}&rdquo;
        </h1>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
            {mode === "ai"
              ? "AI is searching your tweets..."
              : "Searching..."}
          </div>
        )}
      </div>

      {result && (
        <>
          {result.error && (
            <p className="mb-4 text-sm text-red-400">{result.error}</p>
          )}

          {/* AI metadata */}
          {mode === "ai" && result.matchedCategories && result.matchedCategories.length > 0 && (
            <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs text-zinc-500 mb-1.5">
                AI matched categories:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.matchedCategories.map((c) => (
                  <a
                    key={c}
                    href={`/category/${c}`}
                    className="rounded-md bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400
                               hover:bg-blue-600/30 transition-colors"
                  >
                    {c.replace(/_/g, " ")}
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="mb-4 text-sm text-zinc-500">
            {result.tweets.length} result{result.tweets.length !== 1 && "s"}
          </p>

          <div className="grid gap-3">
            {result.tweets.map((tweet) => (
              <TweetCard key={tweet.id} tweet={tweet} />
            ))}
          </div>

          {result.tweets.length === 0 && !loading && (
            <p className="text-zinc-500 mt-4">
              No tweets found.{" "}
              {mode === "text"
                ? 'Try "Ask AI" for smarter search.'
                : "Try different keywords."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="text-zinc-500 mt-8">Loading search...</div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
