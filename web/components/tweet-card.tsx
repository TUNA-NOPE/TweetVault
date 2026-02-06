import type { Tweet } from "@/lib/data";

export default function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-blue-400">
          @{tweet.author}
        </span>
        {tweet.url && (
          <a
            href={tweet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            View original
          </a>
        )}
      </div>

      <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed mb-3">
        {tweet.text}
      </p>

      {tweet.categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tweet.categories.map((cat) => (
            <a
              key={cat}
              href={`/category/${cat}`}
              className="inline-block rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400
                         hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
            >
              {cat.replace(/_/g, " ")}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
