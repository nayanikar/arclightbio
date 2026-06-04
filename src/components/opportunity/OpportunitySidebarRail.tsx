"use client";

import { EvidenceStreamRail } from "./EvidenceStreamRail";
import { SurveillanceRail } from "./SurveillanceRail";

export function OpportunitySidebarRail({
  onResume,
  resuming,
}: {
  onResume?: () => void;
  resuming?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white/10">
      <EvidenceStreamRail className="min-h-0 flex-1" />
      <SurveillanceRail onResume={onResume} resuming={resuming} />
    </div>
  );
}
