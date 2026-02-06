"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClassifyPanel({
  unclassifiedCount,
}: {
  unclassifiedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [limit, setLimit] = useState("");
  const logsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    logsRef.current?.scrollTo(0, logsRef.current.scrollHeight);
  }, [logs]);

  async function start() {
    setRunning(true);
    setLogs([]);
    setDone(false);

    try {
      const resp = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: limit ? parseInt(limit) : undefined,
        }),
      });

      if (!resp.body) {
        setLogs(["Error: no response stream"]);
        setRunning(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(part.slice(6));
            if (data.done) {
              setDone(true);
            } else if (data.line) {
              setLogs((prev) => [...prev, data.line]);
            } else if (data.error) {
              setLogs((prev) => [...prev, data.error]);
            }
          } catch {
            /* skip malformed events */
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, `Error: ${err.message}`]);
    } finally {
      setRunning(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm
                   font-medium text-white hover:bg-blue-500 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Classify {unclassifiedCount} bookmarks
      </button>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-zinc-100">Classify Bookmarks</h2>
        {!running && (
          <button
            onClick={() => { setOpen(false); setLogs([]); setDone(false); }}
            className="text-zinc-500 hover:text-zinc-300 text-sm"
          >
            Close
          </button>
        )}
      </div>

      {!running && !done && (
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="All tweets"
            min={1}
            className="w-32 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm
                       text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500
                       transition-colors"
          />
          <button
            onClick={start}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white
                       hover:bg-blue-500 transition-colors"
          >
            Start
          </button>
          <span className="text-xs text-zinc-500">
            {unclassifiedCount} unclassified
          </span>
        </div>
      )}

      {(running || logs.length > 0) && (
        <div
          ref={logsRef}
          className="mt-4 max-h-72 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono
                     text-xs leading-relaxed text-zinc-400"
        >
          {logs.map((line, i) => (
            <div key={i} className={line.includes("error") || line.includes("Error") ? "text-red-400" : ""}>
              {line}
            </div>
          ))}
          {running && (
            <div className="mt-2 flex items-center gap-2 text-blue-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
              Processing...
            </div>
          )}
        </div>
      )}

      {done && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-green-400">Classification complete</span>
          <button
            onClick={() => router.refresh()}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300
                       hover:bg-zinc-700 transition-colors"
          >
            Refresh page
          </button>
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-600">
        Or run manually: <code className="text-zinc-500">python main.py</code>
      </p>
    </div>
  );
}
