import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import type { ModalityPathway } from "@/types/V3Pipeline";
import { loadAssessment } from "./helpers";
import { upsertIndRegulatoryPackage } from "@/lib/v3Db";

function modalityToPathway(modality: string | undefined): ModalityPathway {
  const m = (modality ?? "").toLowerCase();
  if (
    m.includes("antibody") ||
    m.includes("mab") ||
    m.includes("adc") ||
    m.includes("protein") ||
    m.includes("cell") ||
    m.includes("gene") ||
    m.includes("crispr") ||
    m.includes("biologic")
  ) {
    return "BLA";
  }
  return "NDA";
}

export async function modalityPathwayMapperAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<ModalityPathway> {
  const assessment = await loadAssessment(obj.id, hypothesis.id);
  const pathway = modalityToPathway(assessment.selected_modality);
  await upsertIndRegulatoryPackage(obj.id, hypothesis.id, {
    modality_pathway: pathway,
  });
  return pathway;
}
