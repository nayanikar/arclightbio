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

export async function getTargetDiseaseAssociations(
  target: string
): Promise<TargetDiseaseAssociation[]> {
  const searchData = await graphql<{
    search?: { hits?: Array<{ id: string; name: string }> };
  }>(TARGET_QUERY, { queryString: target });

  const hits = searchData.search?.hits ?? [];
  if (hits.length === 0) return [];

  const ensemblId = hits[0].id;

  const assocData = await graphql<{
    target?: {
      id: string;
      approvedSymbol: string;
      associatedDiseases?: {
        rows?: Array<{
          disease: { id: string; name: string };
          score: number;
        }>;
      };
    };
  }>(ASSOCIATIONS_QUERY, { ensemblId });

  const targetInfo = assocData.target;
  if (!targetInfo) return [];

  return (targetInfo.associatedDiseases?.rows ?? []).map((row) => ({
    targetId: targetInfo.id,
    targetName: targetInfo.approvedSymbol,
    diseaseId: row.disease.id,
    diseaseName: row.disease.name,
    score: row.score,
  }));
}
