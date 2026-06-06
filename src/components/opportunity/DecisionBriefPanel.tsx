"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Panel } from "@/components/layout/Panel";
import type { DecisionBrief, DecisionRecommendation } from "@/types/DecisionBrief";
import {
  buildDecisionBriefPdfFilename,
  generateDecisionBriefPdf,
} from "@/lib/decisionBriefPdf";
import { cn } from "@/lib/utils";

const RECOMMENDATION_STYLES: Record<
  DecisionRecommendation,
  { label: string; bg: string; text: string }
> = {
  pursue: { label: "Pursue", bg: "rgba(29, 158, 117, 0.12)", text: "#1D9E75" },
  watch: { label: "Watch", bg: "rgba(55, 138, 221, 0.12)", text: "#378ADD" },
  partner: { label: "Partner", bg: "rgba(83, 74, 183, 0.12)", text: "#534AB7" },
  kill: { label: "Kill", bg: "rgba(216, 90, 48, 0.12)", text: "#D85A30" },
};

interface DecisionBriefPanelProps {
  brief: DecisionBrief;
  searchQuery?: string;
  className?: string;
  onEvidenceCardClick?: (cardId: string) => void;
}

export function DecisionBriefPanel({
  brief,
  searchQuery = "Opportunity",
  className,
  onEvidenceCardClick,
}: DecisionBriefPanelProps) {
  const [exporting, setExporting] = useState(false);
  const style = RECOMMENDATION_STYLES[brief.recommendation];

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await generateDecisionBriefPdf({ brief, searchQuery });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildDecisionBriefPdfFilename(searchQuery);
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Panel
      title="Decision brief"
      className={className}
      action={
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {exporting ? "Exporting…" : "Export PDF"}
        </button>
      }
    >
      <div className="space-y-4">
        {brief.top_hypothesis_statement && (
          <p className="text-sm font-medium leading-relaxed text-gray-900 border-l-2 border-brand-purple/40 pl-3">
            {brief.top_hypothesis_statement}
          </p>
        )}

        <div className="flex flex-wrap items-start gap-3">
          <span
            className="rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide"
            style={{ background: style.bg, color: style.text }}
          >
            {style.label}
          </span>
          {brief.calibration_caveat && (
            <p className="text-xs leading-relaxed text-amber-800 bg-amber-50 rounded-md px-2.5 py-1.5 border border-amber-200/80">
              {brief.calibration_caveat}
            </p>
          )}
        </div>

        {brief.score_interpretation && (
          <p className="text-xs leading-relaxed text-gray-600 bg-gray-50 rounded-md px-2.5 py-2 border border-gray-100">
            {brief.score_interpretation}
          </p>
        )}

        {brief.interventional_direction &&
          brief.interventional_direction.claimed_direction !== "unknown" && (
            <div className="rounded-md border border-gray-200 px-3 py-2 text-xs">
              <p className="font-medium text-gray-700">
                Interventional direction: {brief.interventional_direction.claimed_direction}
              </p>
              {brief.interventional_direction.has_contradiction && (
                <p className="mt-1 text-amber-800">
                  Contradicting evidence detected — direction not fully supported.
                </p>
              )}
            </div>
          )}

        <p className="text-sm leading-relaxed text-gray-800">
          {brief.recommendation_rationale}
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {(["minimum", "base", "aspirational"] as const).map((tier) => (
            <div
              key={tier}
              className="rounded-lg border border-gray-200/80 bg-gray-50/50 px-3 py-2.5"
            >
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                TPP — {tier}
              </p>
              <p className="text-xs leading-relaxed text-gray-700">
                {brief.tpp[tier]}
              </p>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Differentiation</p>
          <p className="text-sm leading-relaxed text-gray-700">
            {brief.differentiation}
          </p>
        </div>

        {brief.competitive_landscape && (
          <div className="rounded-lg border border-gray-200/80 px-3 py-2.5 text-xs">
            <p className="mb-1 font-medium text-gray-600">Competitive landscape</p>
            <p className="text-gray-700">{brief.competitive_landscape.differentiation_summary}</p>
            <p className="mt-1 text-gray-500">
              Approved: {brief.competitive_landscape.approved.length} · Active trials:{" "}
              {brief.competitive_landscape.active.length} · Failed/discontinued:{" "}
              {brief.competitive_landscape.failed.length} · Patents:{" "}
              {brief.competitive_landscape.patent_density}
            </p>
          </div>
        )}

        <div className="rounded-lg border border-brand-purple/20 bg-brand-purple/[0.04] px-3.5 py-3">
          <p className="mb-1.5 text-xs font-medium text-brand-purple">
            Next proof point
          </p>
          <p className="text-sm font-medium text-gray-900">
            {brief.next_proof_point.study_type}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            {brief.next_proof_point.primary_endpoint} · N=
            {brief.next_proof_point.n_required} ·{" "}
            {brief.next_proof_point.estimated_timeline} ·{" "}
            {brief.next_proof_point.estimated_cost_range}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
            {brief.next_proof_point.closes_gap}
          </p>
        </div>

        {brief.recommended_biomarkers &&
          (brief.recommended_biomarkers.efficacy.length > 0 ||
            brief.recommended_biomarkers.safety.length > 0) && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">Recommended biomarkers</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ...brief.recommended_biomarkers.efficacy,
                  ...brief.recommended_biomarkers.engagement,
                ].map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[11px] text-brand-teal"
                  >
                    {b}
                  </span>
                ))}
                {brief.recommended_biomarkers.safety.map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800"
                  >
                    {b} (safety)
                  </span>
                ))}
              </div>
            </div>
          )}

        {brief.recommended_models && brief.recommended_models.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Recommended disease models</p>
            <ul className="space-y-1.5 text-xs text-gray-700">
              {brief.recommended_models.slice(0, 4).map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.model}</span> — {m.rationale}
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.derisk_plan.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">De-risk plan</p>
            <ul className="space-y-2">
              {brief.derisk_plan.map((d, i) => (
                <li
                  key={i}
                  className="rounded-md border border-gray-200/80 bg-gray-50/50 px-2.5 py-2 text-xs text-gray-700"
                >
                  <span className="font-medium">{d.study_type}</span> · N={d.n_required} ·{" "}
                  {d.estimated_timeline}
                  {d.biomarkers_of_efficacy.length > 0 && (
                    <p className="mt-1 text-gray-500">
                      Biomarkers: {d.biomarkers_of_efficacy.slice(0, 4).join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.critical_risks.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">Critical risks</p>
            <ul className="space-y-2">
              {brief.critical_risks.slice(0, 5).map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-xs leading-relaxed rounded-md px-2.5 py-2 border",
                    r.severity === "high"
                      ? "border-red-200/80 bg-red-50/50 text-red-900"
                      : "border-amber-200/80 bg-amber-50/50 text-amber-900"
                  )}
                >
                  <span className="font-medium uppercase">{r.severity}</span>
                  {" — "}
                  {r.risk}
                  {r.evidence_card_ids.length > 0 && onEvidenceCardClick && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {r.evidence_card_ids.slice(0, 3).map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onEvidenceCardClick(id)}
                          className="rounded border border-current/30 px-1 py-0.5 text-[10px] hover:bg-white/50"
                        >
                          Card {id.slice(0, 8)}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Portfolio fit: {brief.portfolio_fit.summary}
        </p>

        <p className="text-xs leading-relaxed text-gray-500 border-t border-gray-100 pt-3">
          {brief.hypothesis_ranking_summary}
        </p>
      </div>
    </Panel>
  );
}
