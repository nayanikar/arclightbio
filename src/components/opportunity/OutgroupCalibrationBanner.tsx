"use client";

import type { OutgroupValidation } from "@/types/OpportunityObject";

interface OutgroupCalibrationBannerProps {
  validation: OutgroupValidation | null | undefined;
}

export function OutgroupCalibrationBanner({
  validation,
}: OutgroupCalibrationBannerProps) {
  if (!validation) return null;

  const calibrated = validation.status === "calibrated";

  return (
    <div
      className={
        calibrated
          ? "rounded-lg border border-brand-teal/30 bg-brand-teal/5 px-4 py-3 text-sm text-brand-teal"
          : "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      }
    >
      <p className="font-medium">
        {calibrated ? "Outgroup calibration confirmed" : "Scoring scale warning"}
      </p>
      <p className="mt-1 text-xs opacity-90">{validation.message}</p>
      {validation.outgroup_confidence != null &&
        validation.novel_median_confidence != null && (
          <p className="mt-2 text-[11px] opacity-80">
            Outgroup confidence: {(validation.outgroup_confidence * 100).toFixed(0)}%
            · Top novel median:{" "}
            {(validation.novel_median_confidence * 100).toFixed(0)}%
          </p>
        )}
    </div>
  );
}
