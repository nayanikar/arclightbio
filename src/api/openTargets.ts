import type { TargetDiseaseAssociation } from "@/types/api";
import { ApiError, fetchWithRetry } from "@/lib/http";

const GRAPHQL_URL = "https://api.platform.opentargets.org/api/v4/graphql";

const TARGET_QUERY = `
  query SearchTarget($queryString: String!) {
    search(queryString: $queryString, entityNames: ["target"], page: { index: 0, size: 5 }) {
      hits {
        id
        name
        entity
      }
    }
  }
`;

const ASSOCIATIONS_QUERY = `
  query TargetAssociations($ensemblId: String!) {
    target(ensemblId: $ensemblId) {
      id
      approvedSymbol
      associatedDiseases(page: { index: 0, size: 20 }) {
        rows {
          disease {
            id
            name
          }
          score
          datasourceScores {
            id
            score
          }
        }
      }
    }
  }
`;

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetchWithRetry(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new ApiError(`Open Targets failed: ${res.status}`, "HTTP_ERROR");
  }

  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors?.length) {
    throw new ApiError("Open Targets GraphQL error", "PARSE_ERROR");
  }
  return json.data as T;
}

/** Pick the search hit whose name best matches query tokens (avoids blind hits[0]). */
export function pickBestTargetHit(
  hits: Array<{ id: string; name: string }>,
  query: string
): string | null {
  if (hits.length === 0) return null;
  const tokens = query
    .toLowerCase()
    .split(/[\s,/+-]+/)
    .filter((t) => t.length > 2);
  for (const hit of hits) {
    const name = hit.name.toLowerCase();
    if (tokens.some((t) => name.includes(t) || t.includes(name))) {
      return hit.id;
    }
  }
  return hits[0].id;
}

function parseDatasourceScores(
  rows?: Array<{ id: string; score: number }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ds of rows ?? []) {
    out[ds.id] = ds.score;
  }
  return out;
}

export async function getTargetDiseaseAssociations(
  target: string
): Promise<TargetDiseaseAssociation[]> {
  const searchData = await graphql<{
    search?: { hits?: Array<{ id: string; name: string }> };
  }>(TARGET_QUERY, { queryString: target });

  const hits = searchData.search?.hits ?? [];
  if (hits.length === 0) return [];

  const ensemblId = pickBestTargetHit(hits, target);
  if (!ensemblId) return [];

  const assocData = await graphql<{
    target?: {
      id: string;
      approvedSymbol: string;
      associatedDiseases?: {
        rows?: Array<{
          disease: { id: string; name: string };
          score: number;
          datasourceScores?: Array<{ id: string; score: number }>;
        }>;
      };
    };
  }>(ASSOCIATIONS_QUERY, { ensemblId });

  const targetInfo = assocData.target;
  if (!targetInfo) return [];

  return (targetInfo.associatedDiseases?.rows ?? []).map((row) => {
    const datasourceScores = parseDatasourceScores(row.datasourceScores);
    const geneticsScore =
      datasourceScores["gene_burden"] ??
      datasourceScores["genetic_association"] ??
      datasourceScores["genetics"] ??
      datasourceScores["gwas"] ??
      undefined;

    return {
      targetId: targetInfo.id,
      targetName: targetInfo.approvedSymbol,
      diseaseId: row.disease.id,
      diseaseName: row.disease.name,
      score: row.score,
      geneticsScore,
      datasourceScores,
    };
  });
}
