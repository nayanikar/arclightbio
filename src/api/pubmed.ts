import type { Paper } from "@/types/api";
import { ApiError, fetchWithRetry, optionalEnv } from "@/lib/http";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

interface PubMedSearchResult {
  esearchresult?: { idlist?: string[] };
}

export async function searchPubMed(
  query: string,
  maxResults = 20
): Promise<Paper[]> {
  const apiKey = optionalEnv("NCBI_API_KEY");
  const keyParam = apiKey ? `&api_key=${apiKey}` : "";

  const searchUrl = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json${keyParam}`;
  const searchRes = await fetchWithRetry(searchUrl);
  if (!searchRes.ok) {
    throw new ApiError(`PubMed search failed: ${searchRes.status}`, "HTTP_ERROR");
  }

  const searchData = (await searchRes.json()) as PubMedSearchResult;
  const ids = searchData.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const fetchUrl = `${BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml${keyParam}`;
  const fetchRes = await fetchWithRetry(fetchUrl);
  if (!fetchRes.ok) {
    throw new ApiError(`PubMed fetch failed: ${fetchRes.status}`, "HTTP_ERROR");
  }

  const xml = await fetchRes.text();
  return parsePubMedXml(xml, ids);
}

function parsePubMedXml(xml: string, ids: string[]): Paper[] {
  const papers: Paper[] = [];

  for (const pmid of ids) {
    const articleMatch = xml.match(
      new RegExp(
        `<PMID[^>]*>${pmid}</PMID>[\\s\\S]*?(?=<PMID|<PubmedArticleSet>)`,
        "i"
      )
    );
    if (!articleMatch) continue;

    const block = articleMatch[0];
    const title =
      block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(
        /<[^>]+>/g,
        ""
      ) ?? "";
    const journal =
      block.match(/<Title>([\s\S]*?)<\/Title>/)?.[1]?.replace(/<[^>]+>/g, "") ??
      "";
    const abstractParts = Array.from(
      block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
    ).map((m) => m[1].replace(/<[^>]+>/g, ""));
    const abstract = abstractParts.join(" ");
    const yearMatch = block.match(/<Year>(\d{4})<\/Year>/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
    const authorMatches = Array.from(
      block.matchAll(/<LastName>([\s\S]*?)<\/LastName>/g)
    );
    const authors = authorMatches.map((m) => m[1].replace(/<[^>]+>/g, ""));

    papers.push({
      pmid,
      title: decodeXmlEntities(title),
      abstract: decodeXmlEntities(abstract),
      journal: decodeXmlEntities(journal),
      year,
      authors,
      source_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      is_peer_reviewed: !journal.toLowerCase().includes("biorxiv"),
    });
  }

  return papers;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

export async function getPubMedCount(query: string): Promise<number> {
  const apiKey = optionalEnv("NCBI_API_KEY");
  const keyParam = apiKey ? `&api_key=${apiKey}` : "";
  const url = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=0&retmode=json${keyParam}`;
  const res = await fetchWithRetry(url);
  const data = (await res.json()) as { esearchresult?: { count?: string } };
  return parseInt(data.esearchresult?.count ?? "0", 10);
}
