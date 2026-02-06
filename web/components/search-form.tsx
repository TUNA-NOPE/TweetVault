"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchForm({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  function go(mode: string) {
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}&mode=${mode}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go("text");
      }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tweets..."
        className="w-48 sm:w-72 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm
                   text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500
                   transition-colors"
      />
      <button
        type="submit"
        className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300
                   hover:bg-zinc-700 transition-colors"
      >
        Search
      </button>
      <button
        type="button"
        onClick={() => go("ai")}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white
                   hover:bg-blue-500 transition-colors"
      >
        Ask AI
      </button>
    </form>
  );
}
