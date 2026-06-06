import { AsyncLocalStorage } from "async_hooks";
import type { TrailSource } from "@/types/AgentTrail";

export interface TrailCapture {
  addSource: (source: TrailSource) => void;
  addReasoning: (text: string) => void;
  setSummary: (text: string) => void;
  flush: () => { sources: TrailSource[]; summary?: string };
}

const trailStorage = new AsyncLocalStorage<TrailCapture>();

export function createTrailCapture(): TrailCapture {
  const sources: TrailSource[] = [];
  const reasoning: string[] = [];
  let summary: string | undefined;

  return {
    addSource(s) {
      if (!sources.some((x) => x.url === s.url && x.label === s.label)) {
        sources.push(s);
      }
    },
    addReasoning(text) {
      const t = text.trim();
      if (t) reasoning.push(t);
    },
    setSummary(text) {
      summary = text.trim() || undefined;
    },
    flush() {
      const mergedSummary =
        summary ?? (reasoning.length ? reasoning.join("\n\n") : undefined);
      return { sources: [...sources], summary: mergedSummary };
    },
  };
}

export async function withTrailCapture<T>(
  fn: () => Promise<T>
): Promise<{ result: T; capture: ReturnType<TrailCapture["flush"]> }> {
  const capture = createTrailCapture();
  const result = await trailStorage.run(capture, fn);
  return { result, capture: capture.flush() };
}

export function getActiveTrailCapture(): TrailCapture | undefined {
  return trailStorage.getStore();
}
