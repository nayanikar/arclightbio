import type { Trial } from "@/types/api";
import { ApiError, fetchWithRetry } from "@/lib/http";

const BASE = "https://clinicaltrials.gov/api/v2/studies";

interface CTGovResponse {
  studies?: Array<{
    protocolSection?: {
      identificationModule?: {
        nctId?: string;
        briefTitle?: string;
        officialTitle?: string;
      };
      statusModule?: {
        overallStatus?: string;
        startDateStruct?: { date?: string };
        primaryCompletionDateStruct?: { date?: string };
        whyStopped?: string;
      };
      designModule?: {
        phases?: string[];
        enrollmentInfo?: { count?: number };
      };
      conditionsModule?: { conditions?: string[] };
      armsInterventionsModule?: {
        interventions?: Array<{ name?: string }>;
      };
    };
  }>;
  nextPageToken?: string;
}

export async function searchTrialsByTerm(
  term: string,
  maxResults = 20,
  includeCompleted = false
): Promise<Trial[]> {
  const params = new URLSearchParams({
    "query.term": term,
    pageSize: String(Math.min(maxResults, 100)),
    format: "json",
  });

  if (!includeCompleted) {
    params.set(
      "filter.overallStatus",
      "RECRUITING|ACTIVE_NOT_RECRUITING|ENROLLING_BY_INVITATION|NOT_YET_RECRUITING"
    );
  }

  const url = `${BASE}?${params.toString()}`;
  const res = await fetchWithRetry(url);

  if (!res.ok) {
    throw new ApiError(
      `ClinicalTrials.gov search failed: ${res.status}`,
      "HTTP_ERROR"
    );
  }

  const data = (await res.json()) as CTGovResponse;
  return (data.studies ?? []).map(mapStudy).slice(0, maxResults);
}

export async function searchTrials(
  condition: string,
  intervention: string,
  maxResults = 20,
  includeCompleted = false
): Promise<Trial[]> {
  const params = new URLSearchParams({
    "query.cond": condition,
    pageSize: String(Math.min(maxResults, 100)),
    format: "json",
  });

  if (intervention) {
    params.set("query.intr", intervention);
  }

  if (!includeCompleted) {
    params.set("filter.overallStatus", "RECRUITING|ACTIVE_NOT_RECRUITING|ENROLLING_BY_INVITATION|NOT_YET_RECRUITING");
  }

  const url = `${BASE}?${params.toString()}`;
  const res = await fetchWithRetry(url);

  if (!res.ok) {
    throw new ApiError(
      `ClinicalTrials.gov search failed: ${res.status}`,
      "HTTP_ERROR"
    );
  }

  const data = (await res.json()) as CTGovResponse;
  return (data.studies ?? []).map(mapStudy).slice(0, maxResults);
}

function mapStudy(study: NonNullable<CTGovResponse["studies"]>[0]): Trial {
  const ps = study.protocolSection ?? {};
  const id = ps.identificationModule ?? {};
  const status = ps.statusModule ?? {};
  const design = ps.designModule ?? {};
  const conditions = ps.conditionsModule?.conditions ?? [];
  const interventions =
    ps.armsInterventionsModule?.interventions?.map((i) => i.name ?? "") ?? [];

  const nctId = id.nctId ?? "unknown";

  return {
    nctId,
    title: id.briefTitle ?? id.officialTitle ?? "Untitled trial",
    phase: design.phases?.join(", ") ?? "N/A",
    status: status.overallStatus ?? "Unknown",
    enrollment: design.enrollmentInfo?.count ?? 0,
    startDate: status.startDateStruct?.date ?? "",
    primaryCompletionDate: status.primaryCompletionDateStruct?.date,
    whyStopped: status.whyStopped,
    condition: conditions.join(", "),
    intervention: interventions.join(", "),
    source_url: `https://clinicaltrials.gov/study/${nctId}`,
  };
}

export async function getTrialCount(condition: string): Promise<number> {
  const params = new URLSearchParams({
    "query.cond": condition,
    pageSize: "1",
    format: "json",
    countTotal: "true",
  });
  const url = `${BASE}?${params.toString()}`;
  const res = await fetchWithRetry(url);
  const data = (await res.json()) as { totalCount?: number };
  return data.totalCount ?? 0;
}
