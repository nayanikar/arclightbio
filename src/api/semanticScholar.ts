import type { Paper } from "@/types/api";
import { ApiError, fetchWithRetry, optionalEnv } from "@/lib/http";

const BASE = "https://api.semanticscholar.org/graph/v1";

// Semantic Scholar: 1 request/sec cumulative across all endpoints (with API key)
const MIN_INTERVAL_MS = Number(
  process.env.SEMANTIC_SCHOLAR_MIN_INTERVAL_MS ?? 1100
);

let lastRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSemanticScholarHeaders(): Record<string, string> {
  const apiKey = optionalEnv("SEMANTIC_SCHOLAR_API_KEY");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

function enqueueSemanticScholarRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = requestQueue.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }
    lastRequestAt = Date.now();
    return fn();
  });

  requestQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

async function semanticScholarFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return enqueueSemanticScholarRequest(async () => {
    const res = await fetchWithRetry(url, options);

    if (res.status === 429) {
      await sleep(MIN_INTERVAL_MS * 2);
      lastRequestAt = Date.now();
      const retry = await fetchWithRetry(url, options, 1);
      if (retry.status === 429) {
        throw new ApiError(
          "Semantic Scholar rate limit exceeded (1 req/sec). Retry shortly.",
          "RATE_LIMIT",
          true,
          429
        );
      }
      return retry;
    }

    return res;
  });
}

function mapPaper(p: {
  paperId?: string;
  title?: string;
  abstract?: string;
  year?: number;
  authors?: Array<{ name?: string }>;
  externalIds?: { DOI?: string; PubMed?: string };
  journal?: { name?: string };
}): Paper {
  const pmid = p.externalIds?.PubMed ?? p.paperId ?? "";
  return {
    pmid,
    title: p.title ?? "",
    abstract: p.abstract ?? "",
    journal: p.journal?.name ?? "",
    year: p.year ?? new Date().getFullYear(),
    authors: (p.authors ?? []).map((a) => a.name ?? ""),
    doi: p.externalIds?.DOI,
    source_url: pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : `https://www.semanticscholar.org/paper/${p.paperId}`,
    is_peer_reviewed: true,
  };
}

export async function findRelatedPapers(
  paperId: string,
  maxResults = 10
): Promise<Paper[]> {
  const headers = getSemanticScholarHeaders();
  const url = `${BASE}/paper/${encodeURIComponent(paperId)}/references?fields=title,abstract,authors,year,externalIds,journal&limit=${maxResults}`;
  const res = await semanticScholarFetch(url, { headers });

  if (!res.ok) {
    if (res.status === 404) return [];
    throw new ApiError(
      `Semantic Scholar failed: ${res.status}`,
      res.status === 429 ? "RATE_LIMIT" : "HTTP_ERROR",
      res.status === 429
    );
  }

  const data = (await res.json()) as {
    data?: Array<{
      citedPaper?: {
        paperId?: string;
        title?: string;
        abstract?: string;
        year?: number;
        authors?: Array<{ name?: string }>;
        externalIds?: { DOI?: string; PubMed?: string };
        journal?: { name?: string };
      };
    }>;
  };

  return (data.data ?? [])
    .map((item) => item.citedPaper)
    .filter(Boolean)
    .map((p) => mapPaper(p!));
}

export async function searchSemanticScholar(
  query: string,
  maxResults = 20
): Promise<Paper[]> {
  const headers = getSemanticScholarHeaders();
  const url = `${BASE}/paper/search?query=${encodeURIComponent(query)}&fields=title,abstract,authors,year,externalIds,journal&limit=${maxResults}`;
  const res = await semanticScholarFetch(url, { headers });

  if (!res.ok) {
    throw new ApiError(
      `Semantic Scholar search failed: ${res.status}`,
      res.status === 429 ? "RATE_LIMIT" : "HTTP_ERROR",
      res.status === 429
    );
  }

  const data = (await res.json()) as {
    data?: Array<{
      paperId?: string;
      title?: string;
      abstract?: string;
      year?: number;
      authors?: Array<{ name?: string }>;
      externalIds?: { DOI?: string; PubMed?: string };
      journal?: { name?: string };
    }>;
  };

  return (data.data ?? []).map(mapPaper);
}
