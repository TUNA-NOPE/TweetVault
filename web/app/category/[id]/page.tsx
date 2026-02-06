import Link from "next/link";
import { getTweetsByCategory, getCategoryDescriptions } from "@/lib/data";
import TweetCard from "@/components/tweet-card";

export default function CategoryPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const tweets = getTweetsByCategory(id);
  const descriptions = getCategoryDescriptions();
  const description = descriptions[id] || "";
  const name = id
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      {/* Back + heading */}
      <Link
        href="/"
        className="inline-block mb-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        &larr; All categories
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">{name}</h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        )}
        <p className="mt-2 text-sm text-zinc-500">{tweets.length} tweets</p>
      </div>

      {/* Tweet list */}
      {tweets.length === 0 ? (
        <p className="text-zinc-500">No tweets in this category.</p>
      ) : (
        <div className="grid gap-3">
          {tweets.map((tweet) => (
            <TweetCard key={tweet.id} tweet={tweet} />
          ))}
        </div>
      )}
    </div>
  );
}
