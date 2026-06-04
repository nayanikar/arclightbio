import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { IntentSpaceEvent } from "@/lib/intentSpace/types";

const REPO_ROOT = process.cwd();
const EMIT_SCRIPT = path.join(REPO_ROOT, "scripts", "spacebase", "emit.py");

/** Serialize Spacebase emits per opportunity so session_started always completes first. */
const emitQueues = new Map<string, Promise<void>>();

function isEnabled(): boolean {
  if (process.env.SPACEBASE_ENABLED !== "true") return false;

  const workspace = path.resolve(
    REPO_ROOT,
    process.env.SPACEBASE_WORKSPACE ?? ".spacebase/arclightbio"
  );
  const enrollment = path.join(
    workspace,
    ".intent-space",
    "state",
    "station-enrollment.json"
  );
  return fs.existsSync(enrollment);
}

function runEmit(event: IntentSpaceEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(event);
    const child = spawn("python3", [EMIT_SCRIPT], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        SPACEBASE_WORKSPACE:
          process.env.SPACEBASE_WORKSPACE ?? ".spacebase/arclightbio",
        SPACEBASE_AGENT_NAME: process.env.SPACEBASE_AGENT_NAME ?? "arclight",
      },
      stdio: ["pipe", "ignore", "pipe"],
    });

    child.stdin?.write(payload);
    child.stdin?.end();

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      stderr += text;
      console.error("[spacebase]", text);
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `emit.py exited with code ${code}`));
    });
  });
}

export function broadcastIntentSpaceEvent(event: IntentSpaceEvent): void {
  if (!isEnabled()) return;

  const opportunityId = event.opportunityId;
  const previous = emitQueues.get(opportunityId) ?? Promise.resolve();
  const next = previous
    .then(() => runEmit(event))
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[spacebase] emit failed:", message);
    });

  emitQueues.set(opportunityId, next);
  void next.finally(() => {
    if (emitQueues.get(opportunityId) === next) {
      emitQueues.delete(opportunityId);
    }
  });
}
