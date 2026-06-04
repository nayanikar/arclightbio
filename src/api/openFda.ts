import type { AdverseEvent } from "@/types/api";
import { ApiError, fetchWithRetry, optionalEnv } from "@/lib/http";

const BASE = "https://api.fda.gov/drug/event.json";

export async function getAdverseEvents(
  drugName: string,
  limit = 100
): Promise<AdverseEvent[]> {
  const apiKey = optionalEnv("OPENFDA_API_KEY");
  const keyParam = apiKey ? `&api_key=${apiKey}` : "";

  const search = encodeURIComponent(
    `patient.drug.medicinalproduct:"${drugName}"`
  );
  const url = `${BASE}?search=${search}&limit=${limit}${keyParam}`;

  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new ApiError(`OpenFDA failed: ${res.status}`, "HTTP_ERROR");
  }

  const data = (await res.json()) as {
    results?: Array<{
      patient?: {
        drug?: Array<{
          medicinalproduct?: string;
          drugindication?: string;
        }>;
        reaction?: Array<{ reactionmeddrapt?: string }>;
      };
    }>;
  };

  const eventMap = new Map<string, AdverseEvent>();

  for (const result of data.results ?? []) {
    const drugs = result.patient?.drug ?? [];
    const reactions = result.patient?.reaction ?? [];

    for (const reaction of reactions) {
      const reactionName = reaction.reactionmeddrapt ?? "Unknown";
      const key = reactionName.toLowerCase();
      const existing = eventMap.get(key);
      const indication = drugs[0]?.drugindication;

      if (existing) {
        existing.count += 1;
      } else {
        eventMap.set(key, {
          drugName,
          reaction: reactionName,
          count: 1,
          indication,
        });
      }
    }
  }

  return Array.from(eventMap.values()).sort((a, b) => b.count - a.count);
}

export async function getOffLabelIndications(
  drugName: string
): Promise<Map<string, number>> {
  const events = await getAdverseEvents(drugName, 500);
  const indicationCounts = new Map<string, number>();

  for (const event of events) {
    if (event.indication) {
      const key = event.indication.toLowerCase();
      indicationCounts.set(key, (indicationCounts.get(key) ?? 0) + event.count);
    }
  }

  return indicationCounts;
}

export interface FDAApproval {
  brandName: string;
  genericName: string;
  manufacturer: string;
  indication: string;
}

export async function searchFDAApprovals(
  target: string,
  indication: string,
  limit = 10
): Promise<FDAApproval[]> {
  const apiKey = optionalEnv("OPENFDA_API_KEY");
  const keyParam = apiKey ? `&api_key=${apiKey}` : "";
  const search = encodeURIComponent(
    `(openfda.brand_name:"${target}" OR openfda.generic_name:"${target}" OR products.brand_name:"${target}")`
  );
  const url = `https://api.fda.gov/drug/drugsfda.json?search=${search}&limit=${limit}${keyParam}`;

  try {
    const res = await fetchWithRetry(url);
    if (!res.ok) return [];

    const data = (await res.json()) as {
      results?: Array<{
        products?: Array<{
          brand_name?: string;
          active_ingredients?: Array<{ name?: string }>;
        }>;
        openfda?: {
          brand_name?: string[];
          generic_name?: string[];
          manufacturer_name?: string[];
        };
        submissions?: Array<{
          submission_type?: string;
          submission_status?: string;
        }>;
      }>;
    };

    return (data.results ?? []).map((r) => ({
      brandName:
        r.openfda?.brand_name?.[0] ??
        r.products?.[0]?.brand_name ??
        target,
      genericName:
        r.openfda?.generic_name?.[0] ??
        r.products?.[0]?.active_ingredients?.[0]?.name ??
        target,
      manufacturer: r.openfda?.manufacturer_name?.[0] ?? "Unknown",
      indication,
    }));
  } catch {
    return [];
  }
}
