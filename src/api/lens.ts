import type { Patent } from "@/types/api";
import { ApiError, fetchWithRetry, optionalEnv } from "@/lib/http";

const BASE = "https://api.lens.org/patent/search";

export async function searchPatents(
  query: string,
  maxResults = 20
): Promise<Patent[]> {
  const apiKey = optionalEnv("LENS_API_KEY");
  if (!apiKey) {
    throw new ApiError("LENS_API_KEY not configured", "MISSING_KEY", true);
  }

  const res = await fetchWithRetry(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: { match_phrase: { title: query } },
      size: maxResults,
      include: ["lens_id", "biblio", "publication_date"],
    }),
  });

  if (!res.ok) {
    throw new ApiError(`Lens.org failed: ${res.status}`, "HTTP_ERROR");
  }

  const data = (await res.json()) as {
    data?: Array<{
      lens_id?: string;
      biblio?: {
        invention_title?: Array<{ text?: string }>;
        abstract?: Array<{ text?: string }>;
        applicants?: Array<{ extracted_name?: { value?: string } }>;
      };
      publication_date?: string;
    }>;
  };

  return (data.data ?? []).map((p) => ({
    lensId: p.lens_id ?? "",
    title: p.biblio?.invention_title?.[0]?.text ?? "Untitled patent",
    abstract: p.biblio?.abstract?.[0]?.text ?? "",
    assignee:
      p.biblio?.applicants?.[0]?.extracted_name?.value ?? "Unknown assignee",
    publicationDate: p.publication_date ?? "",
    source_url: `https://www.lens.org/lens/patent/${p.lens_id}`,
  }));
}
