import { AsyncLocalStorage } from "async_hooks";

export class PipelineAbortedError extends Error {
  constructor(message = "Pipeline run aborted by user") {
    super(message);
    this.name = "PipelineAbortedError";
  }
}

export function isPipelineAbortedError(err: unknown): boolean {
  return err instanceof PipelineAbortedError;
}

const controllers = new Map<string, AbortController>();

export const activePipelineRun = new AsyncLocalStorage<{ opportunityId: string }>();

export function beginPipelineRun(opportunityId: string): void {
  abortPipelineRun(opportunityId);
  controllers.set(opportunityId, new AbortController());
}

export function endPipelineRun(opportunityId: string): void {
  controllers.delete(opportunityId);
}

export function abortPipelineRun(opportunityId: string): boolean {
  const controller = controllers.get(opportunityId);
  if (!controller) return false;
  controller.abort();
  controllers.delete(opportunityId);
  return true;
}

export function abortAllPipelineRuns(): string[] {
  const ids = Array.from(controllers.keys());
  for (const id of ids) {
    abortPipelineRun(id);
  }
  return ids;
}

export function getActiveAbortSignal(): AbortSignal | undefined {
  const store = activePipelineRun.getStore();
  if (!store) return undefined;
  return controllers.get(store.opportunityId)?.signal;
}

export function listActivePipelineRuns(): string[] {
  return Array.from(controllers.keys());
}
