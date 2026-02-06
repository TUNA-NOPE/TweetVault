import { NextRequest, NextResponse } from "next/server";
import { spawn, ChildProcess } from "child_process";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || "..");

// Define global state shape
type ClassifierState = {
  process: ChildProcess | null;
  subscribers: Set<ReadableStreamDefaultController>;
  logs: string[]; // JSON strings of message objects
  done: boolean;
  latestProgress: any | null;
  latestStatus: any | null;
};

// Use globalThis to persist state across hot reloads in dev
const globalState = global as unknown as { classifierState?: ClassifierState };

if (!globalState.classifierState) {
  globalState.classifierState = {
    process: null,
    subscribers: new Set(),
    logs: [],
    done: false,
    latestProgress: null,
    latestStatus: null,
  };
}

const state = globalState.classifierState!;

// Broadcast a message object to all connected clients
function broadcast(data: Record<string, unknown>) {
  const json = JSON.stringify(data);
  const msg = new TextEncoder().encode(`data: ${json}\n\n`);

  state.subscribers.forEach((controller) => {
    try {
      controller.enqueue(msg);
    } catch (e) {
      state.subscribers.delete(controller);
    }
  });
}

function startProcess(limit: number | null, batchSize: number) {
  if (state.process) return;

  state.logs = [];
  state.done = false;
  state.latestProgress = null;
  state.latestStatus = null;

  const args = ["main.py", "--batch-size", String(batchSize), "--web"];
  if (limit) args.push("--limit", String(limit));

  const pythonPath = path.join(DATA_DIR, "venv", "bin", "python");
  console.log("Spawning classifier:", pythonPath, args.join(" "));

  const proc = spawn(pythonPath, args, {
    cwd: DATA_DIR,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  state.process = proc;

  const handleOutput = (chunk: Buffer, isError = false) => {
    const text = chunk.toString();
    const lines = text.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      let msg;
      if (isError) {
        msg = { error: line };
      } else {
        try {
          // Try to parse structured JSON from Python
          msg = JSON.parse(line);

          if (msg.type === "progress") {
            state.latestProgress = msg;
          } else if (msg.type === "status") {
            state.latestStatus = msg;
          } else if (msg.type === "done" || msg.done) {
            state.done = true;
          }
        } catch {
          // Fallback for non-JSON lines (e.g. from libraries)
          msg = { line: line };
        }
      }

      const json = JSON.stringify(msg);
      state.logs.push(json);
      broadcast(msg);
    }
  };

  proc.stdout.on("data", (c) => handleOutput(c, false));
  proc.stderr.on("data", (c) => handleOutput(c, true));

  proc.on("error", (err) => {
    const msg = { error: `Failed to start: ${err.message}` };
    state.logs.push(JSON.stringify(msg));
    broadcast(msg);
  });

  proc.on("close", (code) => {
    console.log("Classifier finished with code", code);
    state.process = null;
    state.done = true;
    const msg = { done: true, code: code ?? 0 };
    broadcast(msg);
    // Close all streams
    state.subscribers.forEach(c => {
      try { c.close(); } catch (e) { }
    });
    state.subscribers.clear();
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  // Start if not running
  if (!state.process) {
    const limit = body.limit ? Number(body.limit) : null;
    const batchSize = body.batchSize ? Number(body.batchSize) : 10;
    startProcess(limit, batchSize);
  }

  // Return stream
  let currentController: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      currentController = controller;
      state.subscribers.add(controller);
      const enc = new TextEncoder();

      // Send history immediately
      for (const logJson of state.logs) {
        controller.enqueue(enc.encode(`data: ${logJson}\n\n`));
      }

      // If finished between request and now
      if (state.done && !state.process) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ done: true, code: 0 })}\n\n`));
        try { controller.close(); } catch (e) { }
      }
    },
    cancel() {
      // Client disconnected
      if (currentController) {
        state.subscribers.delete(currentController);
      }
      // We do NOT kill the process here
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return NextResponse.json({
    running: !!state.process,
    done: state.done,
    logCount: state.logs.length,
    progress: state.latestProgress,
    status: state.latestStatus
  });
}
