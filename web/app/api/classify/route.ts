import { NextRequest } from "next/server";
import { spawn } from "child_process";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || "..");

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const limit = body.limit ? Number(body.limit) : null;
  const batchSize = body.batchSize ? Number(body.batchSize) : 10;

  const args = ["main.py", "--batch-size", String(batchSize)];
  if (limit) args.push("--limit", String(limit));

  const pythonPath = path.join(DATA_DIR, "venv", "bin", "python");
  const proc = spawn(pythonPath, args, {
    cwd: DATA_DIR,
    env: { ...process.env },
  });

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      function send(obj: Record<string, unknown>) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      proc.stdout.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString().split("\n")) {
          if (line.trim()) send({ line: line });
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        for (const line of chunk.toString().split("\n")) {
          if (line.trim()) send({ error: line });
        }
      });

      proc.on("error", (err) => {
        send({ error: `Failed to start classifier: ${err.message}` });
        send({ done: true, code: 1 });
        controller.close();
      });

      proc.on("close", (code) => {
        send({ done: true, code: code ?? 0 });
        controller.close();
      });
    },
    cancel() {
      proc.kill();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
