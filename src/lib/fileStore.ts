import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { EvidenceCard, HypothesisRecord, OpportunityObject, OpportunityStatusSnapshot } from "@/types/OpportunityObject";
import type {
  CalibrationRegistryEntry,
  CohortPatientRow,
  DrugDiscoveryAssessmentRecord,
  IndRegulatoryPackageRecord,
  PatientCohort,
  UndruggableTargetRecord,
} from "@/types/V3Pipeline";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

interface FileStoreData {
  opportunities: Record<string, OpportunityObject>;
  evidenceCards: Record<string, EvidenceCard[]>;
  hypotheses: Record<string, HypothesisRecord[]>;
  regulatoryPackages: Record<string, unknown>;
  cohorts: Record<string, PatientCohort>;
  cohortPatients: Record<string, CohortPatientRow[]>;
  drugAssessments: Record<string, DrugDiscoveryAssessmentRecord>;
  indPackagesV3: Record<string, IndRegulatoryPackageRecord>;
  undruggableTargets: Record<string, UndruggableTargetRecord>;
  calibrationRegistry: CalibrationRegistryEntry[];
}

const EMPTY_STORE: FileStoreData = {
  opportunities: {},
  evidenceCards: {},
  hypotheses: {},
  regulatoryPackages: {},
  cohorts: {},
  cohortPatients: {},
  drugAssessments: {},
  indPackagesV3: {},
  undruggableTargets: {},
  calibrationRegistry: [],
};

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readStore(): Promise<FileStoreData> {
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    return { ...EMPTY_STORE, ...JSON.parse(raw) } as FileStoreData;
  } catch {
    return { ...EMPTY_STORE };
  }
}

async function writeStore(data: FileStoreData): Promise<void> {
  await ensureDataDir();
  await writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function fileStoreGetOpportunity(
  id: string
): Promise<OpportunityObject | null> {
  const store = await readStore();
  const obj = store.opportunities[id];
  if (!obj) return null;
  const allCards = store.evidenceCards[id] ?? [];
  const schemaVersion = obj.schema_version ?? 1;
  const scopedCards =
    schemaVersion === 1
      ? allCards.filter((c) => !c.hypothesis_id)
      : allCards;
  const challenges = scopedCards
    .filter((c) => c.is_challenge)
    .map((c) => ({
      id: c.id,
      content: c.content,
      flagged_by: "regulatory" as const,
      evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
      score_impact: c.challenge_metadata?.score_impact ?? 0,
      dimension: c.challenge_metadata?.dimension ?? ("composite" as const),
    }));

  const hypotheses = (store.hypotheses[id] ?? []).map((h) => {
    const hCards = allCards.filter((c) => c.hypothesis_id === h.id);
    return {
      ...h,
      evidence_cards: hCards.filter((c) => !c.is_challenge),
      challenges: hCards
        .filter((c) => c.is_challenge)
        .map((c) => ({
          id: c.id,
          content: c.content,
          flagged_by: "regulatory" as const,
          evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
          score_impact: c.challenge_metadata?.score_impact ?? 0,
          dimension: c.challenge_metadata?.dimension ?? ("composite" as const),
        })),
    };
  });

  return {
    ...obj,
    evidence_cards: scopedCards.filter((c) => !c.is_challenge),
    challenges,
    hypotheses:
      schemaVersion === 2 || schemaVersion === 3 ? hypotheses : undefined,
  };
}

export async function fileStoreGetOpportunityStatus(
  id: string
): Promise<OpportunityStatusSnapshot | null> {
  const store = await readStore();
  const obj = store.opportunities[id];
  if (!obj) return null;

  const schemaVersion = obj.schema_version ?? 1;
  const cards = store.evidenceCards[id] ?? [];
  const hypotheses = store.hypotheses[id] ?? [];

  const { isBlackboardV2Complete } = await import("@/lib/blackboardRunV2");
  const { isBlackboardComplete } = await import("@/lib/blackboardRun");
  const state = obj.blackboard_state;
  const pipelineComplete =
    schemaVersion === 2
      ? isBlackboardV2Complete(state)
      : isBlackboardComplete(state);

  return {
    id: obj.id,
    status: obj.status,
    schema_version: schemaVersion as 1 | 2 | 3,
    search_query: obj.search_query,
    confidence_score: obj.confidence_score,
    actionability_zone: obj.actionability_zone,
    last_updated: obj.last_updated,
    top_hypothesis_id: obj.top_hypothesis_id ?? null,
    blackboard_state: state,
    hypothesis_count:
      schemaVersion === 2 || schemaVersion === 3 ? hypotheses.length : 0,
    evidence_card_count: cards.length,
    pipeline_complete: pipelineComplete,
  };
}

export async function fileStoreListOpportunities(): Promise<OpportunityObject[]> {
  const store = await readStore();
  const { applyTopHypothesisListSummary } = await import("@/lib/hypothesisContext");

  return Object.values(store.opportunities).map((obj) => {
    const allCards = store.evidenceCards[obj.id] ?? [];
    const cards = allCards.filter((c) => !c.is_challenge);
    const hypotheses = (store.hypotheses[obj.id] ?? []).map((h) => ({
      ...h,
      evidence_cards: allCards.filter(
        (c) => c.hypothesis_id === h.id && !c.is_challenge
      ),
      challenges: allCards
        .filter((c) => c.hypothesis_id === h.id && c.is_challenge)
        .map((c) => ({
          id: c.id,
          content: c.content,
          flagged_by: "regulatory" as const,
          evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
          score_impact: c.challenge_metadata?.score_impact ?? 0,
          dimension: c.challenge_metadata?.dimension ?? ("composite" as const),
        })),
    }));

    let enriched: OpportunityObject = { ...obj, evidence_cards: cards, hypotheses };
    if (
      ((obj.schema_version ?? 1) === 2 || (obj.schema_version ?? 1) === 3) &&
      hypotheses.length > 0
    ) {
      enriched = applyTopHypothesisListSummary(enriched, hypotheses);
    }
    return enriched;
  });
}

export async function fileStoreCreateOpportunity(
  obj: OpportunityObject
): Promise<void> {
  const store = await readStore();
  store.opportunities[obj.id] = { ...obj, evidence_cards: [] };
  store.evidenceCards[obj.id] = store.evidenceCards[obj.id] ?? [];
  await writeStore(store);
}

export async function fileStoreUpdateOpportunity(
  id: string,
  updates: Partial<OpportunityObject>
): Promise<void> {
  const store = await readStore();
  const obj = store.opportunities[id];
  if (!obj) return;
  store.opportunities[id] = { ...obj, ...updates };
  await writeStore(store);
}

export async function fileStoreInsertEvidenceCard(
  opportunityId: string,
  card: EvidenceCard
): Promise<void> {
  const store = await readStore();
  const cards = store.evidenceCards[opportunityId] ?? [];
  if (cards.some((c) => c.id === card.id)) return;
  cards.push(card);
  store.evidenceCards[opportunityId] = cards;
  await writeStore(store);
}

export async function fileStoreGetEvidenceCards(
  opportunityId: string
): Promise<EvidenceCard[]> {
  const store = await readStore();
  return store.evidenceCards[opportunityId] ?? [];
}

export async function fileStoreDeleteEvidenceCards(
  cardIds: string[]
): Promise<void> {
  if (cardIds.length === 0) return;
  const store = await readStore();
  const idSet = new Set(cardIds);
  for (const opportunityId of Object.keys(store.evidenceCards)) {
    store.evidenceCards[opportunityId] = (
      store.evidenceCards[opportunityId] ?? []
    ).filter((card) => !idSet.has(card.id));
  }
  await writeStore(store);
}

export async function fileStoreUpdateEvidenceCard(
  cardId: string,
  updates: Partial<Pick<EvidenceCard, "quality_scores" | "regulatory_weight">>
): Promise<void> {
  const store = await readStore();
  for (const opportunityId of Object.keys(store.evidenceCards)) {
    const cards = store.evidenceCards[opportunityId] ?? [];
    const index = cards.findIndex((card) => card.id === cardId);
    if (index === -1) continue;
    cards[index] = { ...cards[index], ...updates };
    store.evidenceCards[opportunityId] = cards;
    await writeStore(store);
    return;
  }
}

export async function fileStoreSaveRegulatoryPackage(
  id: string,
  pkg: unknown
): Promise<void> {
  const store = await readStore();
  store.regulatoryPackages[id] = pkg;
  await writeStore(store);
}

export async function fileStoreListHypotheses(
  opportunityId: string
): Promise<HypothesisRecord[]> {
  const store = await readStore();
  return store.hypotheses[opportunityId] ?? [];
}

export async function fileStoreCreateHypothesis(
  opportunityId: string,
  record: HypothesisRecord
): Promise<void> {
  const store = await readStore();
  const list = store.hypotheses[opportunityId] ?? [];
  list.push(record);
  store.hypotheses[opportunityId] = list;
  await writeStore(store);
}

export async function fileStoreUpdateHypothesis(
  hypothesisId: string,
  updates: Partial<HypothesisRecord>
): Promise<void> {
  const store = await readStore();
  for (const opportunityId of Object.keys(store.hypotheses)) {
    const list = store.hypotheses[opportunityId] ?? [];
    const idx = list.findIndex((h) => h.id === hypothesisId);
    if (idx === -1) continue;
    list[idx] = { ...list[idx], ...updates };
    store.hypotheses[opportunityId] = list;
    await writeStore(store);
    return;
  }
}

export async function fileStoreFindOpportunityIdForHypothesis(
  hypothesisId: string
): Promise<string | null> {
  const store = await readStore();
  for (const [opportunityId, list] of Object.entries(store.hypotheses)) {
    if (list.some((h) => h.id === hypothesisId)) return opportunityId;
  }
  return null;
}

export async function fileStoreClearHypotheses(opportunityId: string): Promise<void> {
  const store = await readStore();
  delete store.hypotheses[opportunityId];
  await writeStore(store);
}

export async function fileStoreGetEvidenceCardsForHypothesis(
  hypothesisId: string
): Promise<EvidenceCard[]> {
  const store = await readStore();
  for (const cards of Object.values(store.evidenceCards)) {
    const matched = cards.filter((c) => c.hypothesis_id === hypothesisId);
    if (matched.length > 0) return matched;
  }
  return [];
}

export async function fileStoreSaveCohort(
  cohort: PatientCohort,
  patients: CohortPatientRow[]
): Promise<void> {
  const store = await readStore();
  store.cohorts[cohort.id] = cohort;
  store.cohortPatients[cohort.id] = patients;
  await writeStore(store);
}

export async function fileStoreGetCohort(
  cohortId: string
): Promise<{ cohort: PatientCohort; patients: CohortPatientRow[] } | null> {
  const store = await readStore();
  const cohort = store.cohorts[cohortId];
  if (!cohort) return null;
  return {
    cohort,
    patients: store.cohortPatients[cohortId] ?? [],
  };
}

export async function fileStoreSaveDrugAssessment(
  record: DrugDiscoveryAssessmentRecord
): Promise<void> {
  const store = await readStore();
  store.drugAssessments[record.hypothesis_id] = record;
  await writeStore(store);
}

export async function fileStoreGetDrugAssessment(
  hypothesisId: string
): Promise<DrugDiscoveryAssessmentRecord | null> {
  const store = await readStore();
  return store.drugAssessments[hypothesisId] ?? null;
}

export async function fileStoreSaveIndPackageV3(
  record: IndRegulatoryPackageRecord
): Promise<void> {
  const store = await readStore();
  store.indPackagesV3[record.hypothesis_id] = record;
  await writeStore(store);
}

export async function fileStoreGetIndPackageV3(
  hypothesisId: string
): Promise<IndRegulatoryPackageRecord | null> {
  const store = await readStore();
  return store.indPackagesV3[hypothesisId] ?? null;
}

export async function fileStoreSaveUndruggableTarget(
  record: UndruggableTargetRecord
): Promise<void> {
  const store = await readStore();
  store.undruggableTargets[record.id] = record;
  await writeStore(store);
}

export async function fileStoreListUndruggableTargets(
  opportunityId?: string
): Promise<UndruggableTargetRecord[]> {
  const store = await readStore();
  const all = Object.values(store.undruggableTargets);
  if (!opportunityId) return all;
  return all.filter((t) => t.opportunity_object_id === opportunityId);
}

export async function fileStoreSaveCalibrationEntry(
  entry: CalibrationRegistryEntry
): Promise<void> {
  const store = await readStore();
  store.calibrationRegistry.push(entry);
  await writeStore(store);
}

export async function fileStoreListCalibrationRegistry(): Promise<
  CalibrationRegistryEntry[]
> {
  const store = await readStore();
  return store.calibrationRegistry;
}
