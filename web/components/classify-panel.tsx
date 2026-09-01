"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  X,
  Terminal,
  CheckCircle2,
  Loader2,
  LayoutList,
  ChevronDown,
  ChevronUp,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs, showDebug]);

  // Check for active session on mount
  useEffect(() => {
    fetch("/api/classify")
      .then((res) => res.json())
      .then((data) => {
        if (data.running) {
          setOpen(true);
          if (data.progress) setProgress(data.progress.percent);
          if (data.status) setStatusMessage(data.status.message);
          setTimeout(() => start(true), 100);
        }
      })
      .catch(() => { });
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
      setProgress(progress > 0 ? progress : initialPercent);
      setStatusMessage("Initializing...");
    } else {
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

  return (
    <div className="mb-8 w-full">
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex justify-start"
          >
            <button
              onClick={() => setOpen(true)}
              className="group relative flex items-center gap-3 rounded-full bg-zinc-900/50 px-6 py-3 
                         text-sm font-medium text-zinc-100 ring-1 ring-white/10 backdrop-blur-xl 
                         transition-all hover:bg-zinc-800/60 hover:ring-white/20 active:scale-95"
            >
              <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-indigo-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
              <Activity className="h-4 w-4 text-blue-400" />
              <span>
                Classify <span className="font-bold text-white">{unclassifiedCount}</span> new bookmarks
              </span>
              <div className="ml-1 h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br transition-all duration-500",
                    running ? "from-blue-500/20 to-indigo-500/20 shadow-lg shadow-blue-500/10" : "from-zinc-800 to-zinc-900"
                  )}>
                    <LayoutList className={cn("h-5 w-5 transition-colors", running ? "text-blue-400" : "text-zinc-400")} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-zinc-100">Classification Engine</h2>
                    <p className="text-xs text-zinc-500">
                      {running ? "Processing your bookmarks..." : "Ready to organize your feed"}
                    </p>
                  </div>
                </div>
                {!running && (
                  <button
                    onClick={() => { setOpen(false); setLogs([]); setDone(false); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 
                               hover:bg-white/5 hover:text-zinc-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Controls */}
              {!running && !done && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <span className="text-zinc-500 text-xs">Limit:</span>
                    </div>
                    <input
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="All"
                      min={1}
                      className="w-32 rounded-xl border border-zinc-800 bg-zinc-900/50 pl-12 pr-3 py-2 text-sm
                                 text-zinc-100 placeholder-zinc-600 outline-none focus:border-blue-500/50
                                 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                    />
                  </div>

                  <button
                    onClick={() => start(false)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 
                               px-5 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20
                               hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Start Processing
                  </button>

                  <span className="text-xs font-medium text-zinc-500 px-2 bg-zinc-900/50 py-1 rounded-md border border-zinc-800/50">
                    {unclassifiedCount} pending
                  </span>
                </motion.div>
              )}

              {/* Progress & Status */}
              {(running || logs.length > 0) && (
                <div className="space-y-6">
                  {/* Progress Bar */}
                  <div className="relative">
                    <div className="flex items-center justify-between text-xs font-medium mb-3">
                      <span className={cn(
                        "flex items-center gap-2 transition-colors",
                        done ? "text-green-400" : "text-blue-400"
                      )}>
                        {done ? <CheckCircle2 className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
                        {statusMessage || "Starting..."}
                      </span>
                      <span className="text-zinc-400 font-mono">{progress}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900/50 ring-1 ring-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 relative overflow-hidden"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: "easeInOut" }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"
                          style={{ transform: 'skewX(-20deg) translateX(-150%)' }} />
                      </motion.div>
                    </div>
                  </div>

                  {/* Debug Logs Toggle */}
                  <div>
                    <button
                      onClick={() => setShowDebug(!showDebug)}
                      className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold 
                                 text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <Terminal className="h-3 w-3" />
                      {showDebug ? "Hide Logs" : "Show Logs"}
                      {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    <AnimatePresence>
                      {showDebug && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div
                            ref={logsRef}
                            className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-zinc-800/50 
                                     bg-black/40 p-3 font-mono text-xs leading-relaxed backdrop-blur-sm"
                          >
                            {logs.map((log, i) => (
                              <div key={i} className={cn(
                                "border-l-2 pl-2 mb-1",
                                log.type === "error" ? "border-red-500/50 text-red-400" :
                                  log.type === "info" ? "border-blue-500/50 text-blue-400" :
                                    "border-zinc-700/50 text-zinc-500"
                              )}>
                                {log.text}
                              </div>
                            ))}
                            {logs.length === 0 && <span className="text-zinc-700 italic">No logs yet...</span>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Done State */}
              {done && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center gap-4 border-t border-white/5 pt-4"
                >
                  <button
                    onClick={() => router.refresh()}
                    className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium 
                               text-zinc-900 hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Refresh View
                  </button>
                  <p className="text-xs text-zinc-500">
                    Process complete. <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-400">Ctrl+R</code> to reload manually.
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
