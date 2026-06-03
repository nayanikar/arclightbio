import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getOpportunityObject, saveRegulatoryPackage } from "@/lib/db";
import { buildProvenanceTrail, versionLockHash } from "@/lib/provenance";
import { callAgentJson } from "@/api/anthropic";
import type { RegulatoryPackage } from "@/types/RegulatoryPackage";

const COMPLIANCE_CHECKER_SYSTEM = `You are the Compliance Checker for Arclight Bio's regulatory assembly pipeline.
Map evidence against FDA January 2025 draft guidance on AI in drug submissions.
Return JSON: {
  ai_role_declaration: string,
  evidence_sections: [{ section, ai_generated_items, human_validated_items, average_regulatory_weight, credibility_rating }],
  gap_report: [{ gap_description, required_action, blocking }]
}`;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetAgency = (body.targetAgency as "FDA" | "EMA" | "both") ?? "FDA";

    const obj = await getOpportunityObject(params.id);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (obj.actionability_zone !== "act_now") {
      return NextResponse.json(
        { error: "Regulatory assembly only available in Act Now zone" },
        { status: 400 }
      );
    }

    const allCards = [...obj.evidence_cards, ...obj.challenges.map((c) => ({
      id: c.id,
      content: c.content,
      source_url: "",
      source_type: "fda" as const,
      contributing_agent: "regulatory" as const,
      timestamp: new Date().toISOString(),
      quality_scores: { sample_size: 0.5, study_design: 0.5, source_credibility: 0.5, replication: 0.5, recency: 0.5, composite: 0.5 },
      regulatory_weight: 0.5,
      raw_source_metadata: {},
      is_challenge: true,
    }))];

    const provenance_trail = buildProvenanceTrail(allCards);
    const version_lock_hash = versionLockHash(obj);

    let compliance: Partial<RegulatoryPackage["credibility_report"]> & {
      gap_report?: RegulatoryPackage["gap_report"];
    } = {};

    try {
      compliance = await callAgentJson(COMPLIANCE_CHECKER_SYSTEM, JSON.stringify({
        hypothesis: obj.hypothesis,
        evidence_cards: obj.evidence_cards.slice(0, 20),
        confidence_score: obj.confidence_score,
      }));
    } catch {
      compliance = {
        ai_role_declaration:
          "Arclight Bio Opportunity Space autonomously generated evidence cards via live API queries. Human validation required before submission.",
        evidence_sections: [
          {
            section: "Discovery Hypothesis",
            ai_generated_items: 1,
            human_validated_items: 0,
            average_regulatory_weight: obj.confidence_score,
            credibility_rating: obj.confidence_score > 0.6 ? "moderate" : "low",
          },
        ],
        gap_report: [
          {
            gap_description: "All AI-generated evidence requires human expert review",
            required_action: "Commission independent validation study",
            blocking: true,
          },
        ],
      };
    }

    const pkg: RegulatoryPackage = {
      id: randomUUID(),
      opportunity_object_id: obj.id,
      opportunity_object_version: obj.version,
      assembly_timestamp: new Date().toISOString(),
      target_agency: targetAgency,
      credibility_report: {
        ai_role_declaration:
          compliance.ai_role_declaration ??
          "AI-assisted discovery by Arclight Bio Opportunity Space",
        evidence_sections: compliance.evidence_sections ?? [],
      },
      gap_report: compliance.gap_report ?? [],
      provenance_trail,
      version_lock_hash,
    };

    await saveRegulatoryPackage({
      id: pkg.id,
      opportunity_object_id: pkg.opportunity_object_id,
      opportunity_object_version: pkg.opportunity_object_version,
      target_agency: pkg.target_agency,
      credibility_report: pkg.credibility_report,
      gap_report: pkg.gap_report,
      provenance_trail: pkg.provenance_trail,
      version_lock_hash: pkg.version_lock_hash,
    });

    return NextResponse.json({ package: pkg });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Assembly failed" },
      { status: 500 }
    );
  }
}
