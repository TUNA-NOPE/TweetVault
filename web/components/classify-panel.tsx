"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter }1 from "next/navigation";

export default function ClassifyPanel({
  unclassifiedCount,
  stats = { totalTweets: 0, classifiedTweets: 0 },
}: {
  unclassifiedCount: number;
  stats?: { totalTweets: number; classifiedTweets: number };
}) {
  const initialPercent = stats.totalTweets > 0
    ? Math.floor((stats.classifiedTweets / stats.totalTweets) * 100)
    : 0;

  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [done, setDone] = useState(false);
  const [limit, setLimit] = useState("");
  const [progress, setProgress] = useState(initialPercent);
  const [statusMessage, setStatusMessage] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    logsRef.current?.scrollTo(0, logsRef.current.scrollHeight);
  }, [logs]);

  // Check for active session on mount
  useEffect(() => {
    fetch("/api/classify")
      .then((res) => res.json())
      .then((data) => {
        if (data.running) {
          setOpen(true);

          // Instant resume state
          if (data.progress) setProgress(data.progress.percent);
          if (data.status) setStatusMessage(data.status.message);

          // Small delay to ensure state updates before starting stream
          setTimeout(() => start(true), 100);
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh stats while running
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [running, router]);

  async function start(isResume = false) {
    setRunning(true);

    if (!isResume) {
      setLogs([]);
      setDone(false);
      // Don't reset to 0, reset to current "actual" progress from server stats if available
      // But better to trust the initialPercent or keep current if we have it
      setProgress(progress > 0 ? progress : initialPercent);
      setStatusMessage("Initializing...");
    } else {
      // If resuming, we want to reset 'done' to false just in case, 
      // but keep existing logs/progress/status
      setDone(false);
    }

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

            if (data.type === "progress") {
              setProgress(data.percent);
            } else if (data.type === "status") {
              setStatusMessage(data.message);
            } else if (data.type === "new_category") {
              setLogs((prev) => [...prev, { type: "info", text: `New category: ${data.id}` }]);
            } else if (data.done || (data.type === "done")) {
              setDone(true);
              setStatusMessage("Classification complete");
              setProgress(100);
            } else if (data.line) {
              setLogs((prev) => [...prev, { type: "log", text: data.line }]);
            } else if (data.error) {
              setLogs((prev) => [...prev, { type: "error", text: data.error }]);
            }
          } catch {
            /* skip malformed events */
          }
        }
      }
    } catch (err: any) {
      setLogs((prev) => [...prev, { type: "error", text: `Error: ${err.message}` }]);
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
            onClick={() => start(false)}
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
        <div className="mt-4 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{statusMessage || "Starting..."}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* New Categories Toast / Info area could go here */}

          {/* Debug Toggle */}
          <div className="pt-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400"
            >
              {showDebug ? "Hide Debug Logs" : "Show Debug Logs"}
            </button>
          </div>

          {/* Hidden Logs */}
          {showDebug && (
            <div
              ref={logsRef}
              className="max-h-48 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono
                         text-xs leading-relaxed text-zinc-400"
            >
              {logs.map((log, i) => (
                <div key={i} className={log.type === "error" ? "text-red-400" : "text-zinc-500"}>
                  {log.text}
                </div>
              ))}
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
