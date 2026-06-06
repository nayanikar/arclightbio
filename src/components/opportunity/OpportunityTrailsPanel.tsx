"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Panel } from "@/components/layout/Panel";
import { EvidenceStreamRail } from "./EvidenceStreamRail";
import { SurveillanceRail } from "./SurveillanceRail";

interface OpportunityTrailsPanelProps {
  onResume?: () => void;
  resuming?: boolean;
  hypothesisIdFilter?: string;
}

const TRAIL_HEIGHT = "h-[min(72vh,780px)]";

function TrailColumnHeader({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div
      id={id}
      className="shrink-0 border-b border-[#EDE8E0] bg-white px-4 py-3 lg:px-5"
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        {title}
      </h3>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
    </div>
  );
}

export function OpportunityTrailsPanel({
  onResume,
  resuming,
  hypothesisIdFilter,
}: OpportunityTrailsPanelProps) {
  return (
    <Panel
      title="Discovery trails"
      description="Evidence from blackboard agents and ongoing surveillance — two parallel views of the session."
      noPadding
      bodyClassName="p-0"
    >
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-[#EDE8E0] ${TRAIL_HEIGHT}`}
      >
        <section
          aria-labelledby="evidence-trail-heading"
          className="flex min-h-0 flex-col border-b border-[#EDE8E0] lg:border-b-0"
        >
          <TrailColumnHeader
            id="evidence-trail-heading"
            title="Evidence trail"
            description="Agent cards and regulatory challenges, newest first"
          />
          <ScrollArea className="min-h-0 flex-1">
            <EvidenceStreamRail
              variant="main"
              embedded
              hypothesisIdFilter={hypothesisIdFilter}
            />
          </ScrollArea>
        </section>

        <section
          aria-labelledby="surveillance-trail-heading"
          className="flex min-h-0 flex-col"
        >
          <TrailColumnHeader
            id="surveillance-trail-heading"
            title="Surveillance trail"
            description="Live PubMed and tag scans after discovery completes"
          />
          <ScrollArea className="min-h-0 flex-1">
            <SurveillanceRail
              variant="main"
              embedded
              onResume={onResume}
              resuming={resuming}
            />
          </ScrollArea>
        </section>
      </div>
    </Panel>
  );
}
