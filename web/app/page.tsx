import Link from "next/link";
import { getCategories, getStats } from "@/lib/data";
import ClassifyPanel from "@/components/classify-panel";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const categories = getCategories();
  const stats = getStats();
  const unclassified = stats.totalTweets - stats.classifiedTweets;

  return (
    <div>
      {/* Stats bar */}
      <div className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
        <span>
          <strong className="text-zinc-100">{stats.classifiedTweets}</strong>{" "}
          tweets classified
        </span>
        <span>
          <strong className="text-zinc-100">{stats.totalCategories}</strong>{" "}
          categories
        </span>
        {unclassified > 0 && (
          <span>
            <strong className="text-zinc-100">{unclassified}</strong>{" "}
            unclassified
          </span>
        )}
      </div>

      {/* Classify panel — shown when there are unclassified tweets */}
      {unclassified > 0 && (
        <ClassifyPanel unclassifiedCount={unclassified} stats={stats} />
      )}

      {/* Category grid */}
      {categories.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
          <p className="text-lg text-zinc-400 mb-2">
            No classified tweets yet
          </p>
          <p className="text-sm text-zinc-500">
            Click the button above or run{" "}
            <code className="text-zinc-300">python main.py</code> to classify
            your bookmarks.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/category/${cat.id}`}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 p-5
                         hover:border-zinc-600 hover:bg-zinc-800/60 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-zinc-100 group-hover:text-white">
                  {cat.name}
                </h2>
                <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-400 group-hover:bg-zinc-700">
                  {cat.count}
                </span>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {cat.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
