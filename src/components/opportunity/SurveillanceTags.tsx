"use client";

import type { SurveillanceTags } from "@/types/OpportunityObject";
import { Panel } from "@/components/layout/Panel";
import { formatLastChecked } from "@/components/opportunity/ChangeLogSection";
import { useEffect, useState } from "react";

interface SurveillanceTagsProps {
  tags: SurveillanceTags;
  lastCheckedAt?: string | null;
}

function TagGroup({
  label,
  tags,
  variant,
}: {
  label: string;
  tags: string[];
  variant: "default" | "teal" | "purple";
}) {
  if (tags.length === 0) return null;

  const styles = {
    default: "bg-gray-100 text-gray-700",
    teal: "bg-brand-teal/10 text-brand-teal",
    purple: "bg-brand-purple/10 text-brand-purple",
  };

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`rounded-md px-2 py-0.5 text-xs font-medium ${styles[variant]}`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SurveillanceTagsDisplay({
  tags,
  lastCheckedAt,
}: SurveillanceTagsProps) {
  const [lastCheckedLabel, setLastCheckedLabel] = useState(
    formatLastChecked(lastCheckedAt ?? tags.last_checked_at ?? null)
  );

  useEffect(() => {
    setLastCheckedLabel(
      formatLastChecked(lastCheckedAt ?? tags.last_checked_at ?? null)
    );
    const interval = window.setInterval(() => {
      setLastCheckedLabel(
        formatLastChecked(lastCheckedAt ?? tags.last_checked_at ?? null)
      );
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [lastCheckedAt, tags.last_checked_at]);

  const hasTags =
    tags.concept_tags.length > 0 ||
    tags.entity_tags.length > 0 ||
    tags.signal_tags.length > 0;

  if (!hasTags) return null;

  return (
    <Panel title="Surveillance tags" description="Active monitoring concepts">
      <div className="space-y-3">
        <TagGroup label="Concepts" tags={tags.concept_tags} variant="default" />
        <TagGroup label="Entities" tags={tags.entity_tags} variant="teal" />
        <TagGroup label="Signals" tags={tags.signal_tags} variant="purple" />
        <p className="border-t border-gray-100 pt-3 text-[11px] text-gray-400">
          {lastCheckedLabel}
        </p>
      </div>
    </Panel>
  );
}
