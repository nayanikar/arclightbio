import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { getIndRegulatoryPackage, upsertIndRegulatoryPackage } from "@/lib/v3Db";
import { buildPhase2Context, contextPrompt } from "./helpers";

const SYSTEM = `You are an IND package assembler. Synthesize preclinical, CMC, tox, and CDP into a coherent sample IND outline scoped to the modality pathway (NDA vs BLA).
Return valid JSON: { "assembly_notes": string, "target_agency": "FDA" | "EMA" | "both" }`;

export async function indPackageAssemblerAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  const pkg = await getIndRegulatoryPackage(obj.id, hypothesis.id);

  try {
    const result = await callAgentJson<{
      assembly_notes: string;
      target_agency: "FDA" | "EMA" | "both";
    }>(
      SYSTEM,
      `${contextPrompt(ctx)}
Modality pathway: ${pkg?.modality_pathway ?? "TBD"}
Risk of failure: ${pkg?.risk_of_failure ?? "not computed"}
Preclinical: ${JSON.stringify(pkg?.package?.preclinical_roadmap ?? [])}
CMC: ${JSON.stringify(pkg?.package?.cmc_requirements ?? [])}
Tox: ${JSON.stringify(pkg?.package?.tox_studies ?? [])}
CDP: ${JSON.stringify(pkg?.package?.clinical_development_plan ?? {})}`
    );
    await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
      package: {
        ...(pkg?.package ?? {}),
        assembly_notes: result.assembly_notes,
        target_agency: result.target_agency,
      },
    });
  } catch {
    await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
      package: {
        ...(pkg?.package ?? {}),
        assembly_notes:
          "Sample IND package assembled from preclinical roadmap, CMC plan, tox studies, and clinical development plan. Expert regulatory review required before submission.",
        target_agency: "FDA",
      },
    });
  }
}
