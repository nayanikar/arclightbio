import {
  getEvidenceCardsForHypothesis,
  getSharedStage1LiteratureCards,
  insertEvidenceCard,
  updateEvidenceCard,
  updateHypothesis,
} from "@/lib/db";
import { mechanisticChainAgent } from "@/agents/mechanisticChainAgent";
import {
  evaluateTargetAlignment,
  extractDeclaredEntities,
} from "@/lib/hypothesisTargetAlign";
import {
  findTargetListCard,
  parseRankedTargetsFromCard,
} from "@/lib/targetList";
import {
  inferEvidenceClass,
  summarizeEvidenceClasses,
} from "@/lib/evidenceClass";
import { auditInterventionDirection } from "@/lib/interventionDirection";
import { computeScoreDecomposition } from "@/lib/scoreDecomposition";
import { challengesFromCards } from "@/lib/hypothesisRanking";
import { evidenceCardsForHypothesisScoring } from "@/lib/hypothesisCards";
import {
  computeConfidenceScore,
  computeActionabilityScore,
  getActionabilityZoneFromConfidence,
} from "@/lib/scoring";
import { resolveOrgContext } from "@/lib/blackboardRunV2Helpers";
import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";

export async function runScientificRigorForHypothesis(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const hypothesisCards = await getEvidenceCardsForHypothesis(hypothesis.id);
  const sharedLiterature = await getSharedStage1LiteratureCards(obj.id);
  const allCards = [...sharedLiterature, ...hypothesisCards];

  for (const card of allCards) {
    if (card.is_challenge || card.contributing_agent === "regulatory") continue;
    const evidenceClass = inferEvidenceClass(card);
    if (card.raw_source_metadata?.evidence_class === evidenceClass) continue;
    await updateEvidenceCard(card.id, {
      raw_source_metadata: {
        ...card.raw_source_metadata,
        evidence_class: evidenceClass,
      },
    });
  }

  const refreshedCards = await getEvidenceCardsForHypothesis(hypothesis.id);
  const refreshedAll = [...sharedLiterature, ...refreshedCards];
  const evidenceSummary = summarizeEvidenceClasses(refreshedAll);

  const chain = await mechanisticChainAgent(hypothesis, refreshedAll);

  const targetList = findTargetListCard(refreshedCards);
  const rankedTargets = parseRankedTargetsFromCard(targetList);
  const targetAlignment = evaluateTargetAlignment(
    hypothesis.statement,
    rankedTargets
  );

  const directionAudit = auditInterventionDirection(
    hypothesis.statement,
    refreshedAll
  );

  if (directionAudit.has_contradiction) {
    const existing = refreshedCards.find(
      (c) => c.raw_source_metadata?.wave5 === "direction_contradiction"
    );
    if (!existing) {
      await insertEvidenceCard(
        obj.id,
        {
          content: `REGULATORY CHALLENGE — Interventional direction contradiction: thesis claims ${directionAudit.claimed_direction} but evidence suggests opposing direction. ${directionAudit.contradicting_evidence[0]?.slice(0, 200) ?? ""}`,
          source_url: "",
          source_type: "fda",
          contributing_agent: "regulatory",
          is_challenge: true,
          quality_scores: {
            sample_size: 0.5,
            study_design: 0.5,
            source_credibility: 0.9,
            replication: 0.5,
            recency: 0.9,
            composite: 0.6,
          },
          regulatory_weight: 0.6,
          challenge_metadata: {
            evidence_card_ref: "",
            score_impact: 0.1,
            dimension: "composite",
          },
          raw_source_metadata: {
            wave5: "direction_contradiction",
            direction_audit: directionAudit,
          },
        },
        { hypothesisId: hypothesis.id }
      );
    }
  }

  const scoringCards = evidenceCardsForHypothesisScoring(
    refreshedAll,
    hypothesis.is_outgroup
  );
  const challenges = challengesFromCards(refreshedAll);
  const org = await resolveOrgContext(obj.org_context_id);

  const scoreDecomposition = computeScoreDecomposition(
    scoringCards,
    challenges,
    {
      opportunityTier: obj.query_tier ?? "clinical",
      indicationType: obj.indication_type,
      targetMismatch: targetAlignment.status === "mismatch",
    }
  );

  if (org) {
    const confidence_score = computeConfidenceScore(
      scoringCards,
      challenges,
      obj.query_tier ?? "clinical"
    );
    const mismatchPenalty =
      targetAlignment.status === "mismatch" ? 0.15 : 0;
    const adjustedConfidence = Math.max(
      0.1,
      confidence_score - mismatchPenalty
    );
    const actionability = computeActionabilityScore(scoringCards, org);
    const actionability_zone = getActionabilityZoneFromConfidence(
      adjustedConfidence,
      org,
      obj.indication_type
    );

    await updateHypothesis(hypothesis.id, {
      confidence_score: Math.round(adjustedConfidence * 10000) / 10000,
      actionability_score: actionability.score,
      actionability_zone,
      mechanistic_chain: chain,
      target_alignment: targetAlignment,
      evidence_summary: evidenceSummary,
      score_decomposition: scoreDecomposition,
    });
  } else {
    await updateHypothesis(hypothesis.id, {
      mechanistic_chain: chain,
      target_alignment: targetAlignment,
      evidence_summary: evidenceSummary,
      score_decomposition: scoreDecomposition,
    });
  }

  if (
    chain.gaps.length > 0 &&
    extractDeclaredEntities(hypothesis.statement).length > 0
  ) {
    // gaps persisted on chain artifact for brief synthesis
  }
}

export function scientificRigorStepKey(hypothesisId: string): string {
  return `stage3.5:scientific_rigor:${hypothesisId}`;
}
