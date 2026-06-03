import type { Paper } from "@/types/api";
import { ApiError, fetchWithRetry } from "@/lib/http";

const BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

export async function searchEuropePmc(
  query: string,
  maxResults = 20
): Promise<Paper[]> {
  const params = new URLSearchParams({
    query,
    format: "json",
    pageSize: String(maxResults),
    resultType: "core",
  });

  const url = `${BASE}?${params.toString()}`;
  const res = await fetchWithRetry(url);

  if (!res.ok) {
    throw new ApiError(`Europe PMC failed: ${res.status}`, "HTTP_ERROR");
  }

  const data = (await res.json()) as {
    resultList?: {
      result?: Array<{
        id?: string;
        pmid?: string;
        title?: string;
        abstractText?: string;
        journalTitle?: string;
        pubYear?: string;
        authorList?: { author?: Array<{ fullName?: string }> };
        doi?: string;
      }>;
    };
  };

  return (data.resultList?.result ?? []).map((r) => {
    const pmid = r.pmid ?? r.id ?? "";
    return {
      pmid,
      title: r.title ?? "",
      abstract: r.abstractText ?? "",
      journal: r.journalTitle ?? "",
      year: parseInt(r.pubYear ?? String(new Date().getFullYear()), 10),
      authors: (r.authorList?.author ?? []).map((a) => a.fullName ?? ""),
      doi: r.doi,
      source_url: pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
        : `https://europepmc.org/article/MED/${r.id}`,
    };
  });
}
