import { getOpportunityObject, updateOpportunityObject, getOrgContext } from "@/lib/db";
import {
  computeConfidenceScore,
  computeActionabilityScore,
  getActionabilityZoneFromConfidence,
} from "@/lib/scoring";
import { getAllEvidenceCards } from "@/lib/db";
import { literatureAgent } from "@/agents/literatureAgent";
import { mechanismAgent } from "@/agents/mechanismAgent";
import { clinicalTrialAgent } from "@/agents/clinicalTrialAgent";
import { commercialAgent } from "@/agents/commercialAgent";
import { regulatoryAgent } from "@/agents/regulatoryAgent";
import { rweSignalAgent } from "@/agents/rweSignalAgent";
import { generateSurveillanceTags } from "@/lib/surveillanceTags";
import { broadcastIntentSpaceEvent } from "@/lib/intentSpace/broadcaster";
import type { IntentSpaceAgent } from "@/lib/intentSpace/types";

async function isPaused(opportunityId: string): Promise<boolean> {
  const obj = await getOpportunityObject(opportunityId);
  return obj?.status === "paused";
}

async function refreshScores(opportunityId: string): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) return;

  const allCards = await getAllEvidenceCards(opportunityId);
  const evidenceCards = allCards.filter((c) => !c.is_challenge);
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

  const org = await getOrgContext(obj.org_context_id);
  if (!org) return;

  const confidence_score = computeConfidenceScore(
    evidenceCards,
    challenges,
    obj.query_tier ?? "clinical"
  );
  const actionability = computeActionabilityScore(evidenceCards, org);
  const actionability_zone = getActionabilityZoneFromConfidence(
    confidence_score,
    org
  );

  const lastEntry = obj.change_log[obj.change_log.length - 1];
  const shouldLogModifier =
    actionability.modifierSummary != null &&
    lastEntry?.summary !== actionability.modifierSummary;

  await updateOpportunityObject(opportunityId, {
    confidence_score,
    actionability_score: actionability.score,
    actionability_zone,
    ...(shouldLogModifier
      ? {
          change_log: [
            ...obj.change_log,
            {
              timestamp: new Date().toISOString(),
              trigger: "actionability_modifier",
              agents_reinitiated: [],
              summary: actionability.modifierSummary!,
            },
          ],
        }
      : {}),
  });
}

async function runTrackedAgent(
  opportunityId: string,
  agent: IntentSpaceAgent,
  runner: () => Promise<void>,
  phase?: "early" | "full"
): Promise<void> {
  const startedAt = Date.now();
  broadcastIntentSpaceEvent({
    type: "agent_started",
    opportunityId,
    agent,
    ...(phase ? { phase } : {}),
  });

  try {
    await runner();
    broadcastIntentSpaceEvent({
      type: "agent_completed",
      opportunityId,
      agent,
      ...(phase ? { phase } : {}),
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("Agent failed:", err);
    broadcastIntentSpaceEvent({
      type: "agent_failed",
      opportunityId,
      agent,
      ...(phase ? { phase } : {}),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function runBlackboard(opportunityId: string): Promise<void> {
  const obj = await getOpportunityObject(opportunityId);
  if (!obj) throw new Error(`Opportunity ${opportunityId} not found`);
  if (obj.status === "paused") return;

  broadcastIntentSpaceEvent({
    type: "session_started",
    opportunityId,
    searchQuery: obj.search_query,
    tier: obj.evidence_tier,
  });

  await updateOpportunityObject(opportunityId, { status: "agents_running" });

  if (await isPaused(opportunityId)) return;

  await runTrackedAgent(
    opportunityId,
    "regulatory",
    () => regulatoryAgent(obj, "early"),
    "early"
  );
  await refreshScores(opportunityId);

  if (await isPaused(opportunityId)) return;

  const agentRunners: Array<{
    agent: IntentSpaceAgent;
    run: () => Promise<void>;
  }> = [
    { agent: "literature", run: () => literatureAgent(obj) },
    { agent: "mechanism", run: () => mechanismAgent(obj) },
    { agent: "clinical_trial", run: () => clinicalTrialAgent(obj) },
    { agent: "commercial", run: () => commercialAgent(obj) },
    { agent: "rwe_signal", run: () => rweSignalAgent(obj) },
  ];

  for (const { agent, run } of agentRunners) {
    if (await isPaused(opportunityId)) return;

    await runTrackedAgent(opportunityId, agent, run);
    await refreshScores(opportunityId);
  }

  if (await isPaused(opportunityId)) return;

  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (await isPaused(opportunityId)) return;

  const updatedObj = await getOpportunityObject(opportunityId);
  if (updatedObj) {
    await runTrackedAgent(
      opportunityId,
      "regulatory",
      () => regulatoryAgent(updatedObj, "full"),
      "full"
    );
  }

  await refreshScores(opportunityId);

  if (await isPaused(opportunityId)) return;

  const finalObj = await getOpportunityObject(opportunityId);
  if (finalObj) {
    const tags = await generateSurveillanceTags(finalObj.hypothesis);
    await updateOpportunityObject(opportunityId, {
      status: "surveillance",
      surveillance_tags: tags,
    });

    broadcastIntentSpaceEvent({
      type: "blackboard_completed",
      opportunityId,
      confidence: finalObj.confidence_score,
      zone: finalObj.actionability_zone,
    });
  }
}

export { refreshScores };
