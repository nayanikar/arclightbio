export type FilterResult<T> =
  | { status: "ok"; items: T[] }
  | { status: "failed"; reason: string };

export function filterOk<T>(items: T[]): FilterResult<T> {
  return { status: "ok", items };
}

export function filterFailed<T>(reason: string): FilterResult<T> {
  return { status: "failed", reason };
}
