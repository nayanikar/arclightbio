import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import type { IntentSpaceEvent } from "@/lib/intentSpace/types";

const REPO_ROOT = process.cwd();
const EMIT_SCRIPT = path.join(REPO_ROOT, "scripts", "spacebase", "emit.py");

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

export function broadcastIntentSpaceEvent(event: IntentSpaceEvent): void {
  if (!isEnabled()) return;

  const payload = JSON.stringify(event);
  const child = spawn("python3", [EMIT_SCRIPT], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      SPACEBASE_WORKSPACE:
        process.env.SPACEBASE_WORKSPACE ?? ".spacebase/arclightbio",
      SPACEBASE_AGENT_NAME:
        process.env.SPACEBASE_AGENT_NAME ?? "arclightbio",
    },
    stdio: ["pipe", "ignore", "pipe"],
  });

  child.stdin?.write(payload);
  child.stdin?.end();

  child.stderr?.on("data", (chunk: Buffer) => {
    console.error("[spacebase]", chunk.toString().trim());
  });

  child.on("error", (err) => {
    console.error("[spacebase] emit spawn failed:", err.message);
  });

  child.on("close", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[spacebase] emit exited with code ${code}`);
    }
  });
}
