import Link from "next/link";
import { ExternalLink, Hash } from "lucide-react";
import type { Tweet } from "@/lib/data";

export default function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <div className="group relative rounded-2xl border border-white/5 bg-zinc-900/60 p-5 
                    transition-all hover:border-white/10 hover:bg-zinc-800/80 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
          @{tweet.author}
        </span>
        {tweet.url && (
          <a
            href={tweet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center p-2 -m-2 text-zinc-500 hover:text-blue-400 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed mb-4">
        {tweet.text}
      </p>

      {tweet.categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tweet.categories.map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat}`}
              className="flex items-center gap-1 rounded-lg bg-zinc-800/50 px-2.5 py-1 text-xs 
                         font-medium text-zinc-400 border border-transparent
                         hover:bg-blue-500/10 hover:text-blue-300 hover:border-blue-500/20 transition-all"
            >
              <Hash className="h-3 w-3 opacity-50" />
              {cat.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
