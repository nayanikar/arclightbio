"use client";

import type { EvidenceCard } from "@/types/OpportunityObject";
import type { ModalityAssessment } from "@/lib/modalityTypes";
import { Panel } from "@/components/layout/Panel";

function findModalityCard(cards: EvidenceCard[]): EvidenceCard | undefined {
  return cards.find((c) => c.is_modality_card && c.contributing_agent === "modality");
}

function complexityDots(level: number): string {
  const filled = "●".repeat(Math.min(5, Math.max(0, level)));
  const empty = "○".repeat(Math.max(0, 5 - level));
  return `${filled}${empty}`;
}

export function ModalityPanel({ cards }: { cards: EvidenceCard[] }) {
  const modalityCard = findModalityCard(cards);
  if (!modalityCard) return null;

  const assessments = (modalityCard.raw_source_metadata?.modality_assessments ??
    []) as ModalityAssessment[];

  if (assessments.length === 0) {
    return (
      <Panel title="Modality recommendation">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
          {modalityCard.content}
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Modality recommendation">
      <div className="space-y-3">
        {assessments.map((a) => (
          <div
            key={a.target}
            className="rounded-lg border border-violet-100 bg-violet-50/30 p-3"
          >
            <p className="text-sm font-semibold text-gray-900">
              {a.target}{" "}
              <span className="font-normal text-agent-modality">→ {a.recommended_modality}</span>
            </p>
            <dl className="mt-2 space-y-1 text-xs text-gray-600">
              <div>
                <dt className="inline font-medium">Timeline: </dt>
                <dd className="inline">{a.estimated_timeline_to_IND}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Manufacturing: </dt>
                <dd className="inline">
                  {complexityDots(a.manufacturing_complexity)} ({a.manufacturing_complexity}/5)
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Org fit: </dt>
                <dd className="inline">
                  {a.org_fit_score >= 0.7 ? "High" : a.org_fit_score >= 0.4 ? "Moderate" : "Low"}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Infrastructure: </dt>
                <dd className="inline">{a.key_infrastructure_requirement}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </Panel>
  );
}
