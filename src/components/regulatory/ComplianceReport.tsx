"use client";

import type { RegulatoryPackage } from "@/types/RegulatoryPackage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ComplianceReportProps {
  credibilityReport: RegulatoryPackage["credibility_report"];
  gapReport: RegulatoryPackage["gap_report"];
}

export function ComplianceReport({
  credibilityReport,
  gapReport,
}: ComplianceReportProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold">AI Role Declaration</h3>
        <p className="text-sm text-gray-700">
          {credibilityReport.ai_role_declaration}
        </p>
      </div>

      {credibilityReport.evidence_sections.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Evidence Sections</h3>
          <div className="space-y-2">
            {credibilityReport.evidence_sections.map((section) => (
              <div
                key={section.section}
                className="flex items-center justify-between rounded border border-gray-100 px-3 py-2"
              >
                <span className="text-sm">{section.section}</span>
                <Badge
                  className={cn(
                    section.credibility_rating === "high"
                      ? "bg-brand-teal text-white"
                      : section.credibility_rating === "moderate"
                        ? "bg-brand-amber text-white"
                        : "bg-brand-coral text-white"
                  )}
                >
                  {section.credibility_rating}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {gapReport.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Compliance Gaps</h3>
          <div className="space-y-2">
            {gapReport.map((gap, i) => (
              <div
                key={i}
                className={cn(
                  "rounded border-l-4 px-3 py-2",
                  gap.blocking
                    ? "border-l-brand-coral bg-red-50"
                    : "border-l-brand-amber bg-amber-50"
                )}
              >
                <p className="text-sm font-medium">{gap.gap_description}</p>
                <p className="text-xs text-gray-600">{gap.required_action}</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  {gap.blocking ? "Blocking" : "Non-blocking"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
