import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { AgentTrailEntry } from "@/types/AgentTrail";
import type {
  CohortRecord,
  V3HypothesisRecord,
  V3OpportunityFields,
} from "@/types/V3Pipeline";

const DATA_DIR = path.join(process.cwd(), ".data");
const V3_STORE_PATH = path.join(DATA_DIR, "v3-store.json");

interface V3StoreData {
  cohorts: Record<string, CohortRecord>;
  opportunityFields: Record<string, V3OpportunityFields>;
  hypotheses: Record<string, V3HypothesisRecord[]>;
  trailEntries: Record<string, AgentTrailEntry[]>;
}

const EMPTY_STORE: V3StoreData = {
  cohorts: {},
  opportunityFields: {},
  hypotheses: {},
  trailEntries: {},
};

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readStore(): Promise<V3StoreData> {
  try {
    const raw = await readFile(V3_STORE_PATH, "utf-8");
    return { ...EMPTY_STORE, ...JSON.parse(raw) } as V3StoreData;
  } catch {
    return { ...EMPTY_STORE };
  }
}

async function writeStore(data: V3StoreData): Promise<void> {
  await ensureDataDir();
  await writeFile(V3_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function fileStoreSaveCohort(cohort: CohortRecord): Promise<void> {
  const store = await readStore();
  store.cohorts[cohort.id] = cohort;
  await writeStore(store);
}

export async function fileStoreGetCohort(
  cohortId: string
): Promise<CohortRecord | null> {
  const store = await readStore();
  return store.cohorts[cohortId] ?? null;
}

export async function fileStoreGetCohortByOpportunity(
  opportunityId: string
): Promise<CohortRecord | null> {
  const store = await readStore();
  return (
    Object.values(store.cohorts).find(
      (c) => c.opportunity_object_id === opportunityId
    ) ?? null
  );
}

export async function fileStoreUpdateV3OpportunityFields(
  opportunityId: string,
  fields: Partial<V3OpportunityFields>
): Promise<V3OpportunityFields> {
  const store = await readStore();
  const current = store.opportunityFields[opportunityId] ?? {};
  const merged = { ...current, ...fields };
  store.opportunityFields[opportunityId] = merged;
  await writeStore(store);
  return merged;
}

export async function fileStoreGetV3OpportunityFields(
  opportunityId: string
): Promise<V3OpportunityFields> {
  const store = await readStore();
  return store.opportunityFields[opportunityId] ?? {};
}

export async function fileStoreListV3Hypotheses(
  opportunityId: string
): Promise<V3HypothesisRecord[]> {
  const store = await readStore();
  return store.hypotheses[opportunityId] ?? [];
}

export async function fileStoreSaveV3Hypotheses(
  opportunityId: string,
  records: V3HypothesisRecord[]
): Promise<void> {
  const store = await readStore();
  store.hypotheses[opportunityId] = records;
  await writeStore(store);
}

export async function fileStoreUpsertV3Hypothesis(
  opportunityId: string,
  record: V3HypothesisRecord
): Promise<void> {
  const store = await readStore();
  const list = store.hypotheses[opportunityId] ?? [];
  const idx = list.findIndex((h) => h.id === record.id);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  store.hypotheses[opportunityId] = list;
  await writeStore(store);
}

export async function fileStoreUpdateV3Hypothesis(
  opportunityId: string,
  hypothesisId: string,
  updates: Partial<V3HypothesisRecord>
): Promise<void> {
  const store = await readStore();
  const list = store.hypotheses[opportunityId] ?? [];
  const idx = list.findIndex((h) => h.id === hypothesisId);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...updates };
  store.hypotheses[opportunityId] = list;
  await writeStore(store);
}

export async function fileStoreAppendTrailEntry(
  entry: AgentTrailEntry
): Promise<void> {
  const store = await readStore();
  const list = store.trailEntries[entry.opportunity_id] ?? [];
  list.push(entry);
  store.trailEntries[entry.opportunity_id] = list;
  await writeStore(store);
}

export async function fileStoreListTrailEntries(
  opportunityId: string
): Promise<AgentTrailEntry[]> {
  const store = await readStore();
  return store.trailEntries[opportunityId] ?? [];
}

export async function fileStoreSetTrailEntries(
  opportunityId: string,
  entries: AgentTrailEntry[]
): Promise<void> {
  const store = await readStore();
  store.trailEntries[opportunityId] = entries;
  await writeStore(store);
}
