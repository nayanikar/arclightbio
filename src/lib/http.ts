export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: "TIMEOUT" | "RATE_LIMIT" | "MISSING_KEY" | "HTTP_ERROR" | "PARSE_ERROR",
    public readonly partial = false,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const DEFAULT_TIMEOUT = Number(process.env.API_REQUEST_TIMEOUT_MS ?? 10000);
const MAX_RETRIES = Number(process.env.API_MAX_RETRIES ?? 3);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 429 && attempt < retries) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        lastError = new ApiError("Request timed out", "TIMEOUT", true);
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
      if (attempt < retries) {
        await sleep(Math.pow(2, attempt) * 500);
        continue;
      }
    }
  }

  throw lastError ?? new ApiError("Request failed", "HTTP_ERROR");
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ApiError(`Missing environment variable: ${key}`, "MISSING_KEY");
  }
  return value;
}

export function optionalEnv(key: string): string | undefined {
  return process.env[key];
}
