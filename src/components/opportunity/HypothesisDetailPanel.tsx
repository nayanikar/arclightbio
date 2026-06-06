"use client";

import type { HypothesisRecord } from "@/types/OpportunityObject";
import { HypothesisPanel } from "@/components/opportunity/HypothesisPanel";
import type { OpportunityStatus, EvidenceTier } from "@/types/OpportunityObject";

interface HypothesisDetailPanelProps {
  hypothesis: HypothesisRecord;
  status: OpportunityStatus;
  evidenceTier?: EvidenceTier;
}

export function HypothesisDetailPanel({
  hypothesis,
  status,
  evidenceTier,
}: HypothesisDetailPanelProps) {
  return (
    <HypothesisPanel
      hypothesis={{
        statement: hypothesis.statement,
        patient_population: hypothesis.patient_population,
        unmet_need: hypothesis.unmet_need,
        org_positioning: hypothesis.org_positioning,
        source: hypothesis.source,
      }}
      status={status}
      evidenceTier={evidenceTier}
    />
  );
}
