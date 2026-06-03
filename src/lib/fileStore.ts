import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { EvidenceCard, OpportunityObject } from "@/types/OpportunityObject";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

interface FileStoreData {
  opportunities: Record<string, OpportunityObject>;
  evidenceCards: Record<string, EvidenceCard[]>;
  regulatoryPackages: Record<string, unknown>;
}

const EMPTY_STORE: FileStoreData = {
  opportunities: {},
  evidenceCards: {},
  regulatoryPackages: {},
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
  const challenges = allCards
    .filter((c) => c.is_challenge)
    .map((c) => ({
      id: c.id,
      content: c.content,
      flagged_by: "regulatory" as const,
      evidence_card_ref: c.challenge_metadata?.evidence_card_ref ?? "",
      score_impact: c.challenge_metadata?.score_impact ?? 0,
      dimension: c.challenge_metadata?.dimension ?? ("composite" as const),
    }));

  return {
    ...obj,
    evidence_cards: allCards.filter((c) => !c.is_challenge),
    challenges,
  };
}

export async function fileStoreListOpportunities(): Promise<OpportunityObject[]> {
  const store = await readStore();
  return Object.values(store.opportunities).map((obj) => ({
    ...obj,
    evidence_cards: (store.evidenceCards[obj.id] ?? []).filter((c) => !c.is_challenge),
  }));
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
