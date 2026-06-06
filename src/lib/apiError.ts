/** Generic client message in production; full detail only in dev logs. */
export function clientErrorMessage(err: unknown, fallback: string): string {
  if (process.env.NODE_ENV !== "production") {
    return err instanceof Error ? err.message : fallback;
  }
  return fallback;
}
