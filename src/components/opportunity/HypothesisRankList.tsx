"use client";

import type { HypothesisRecord } from "@/types/OpportunityObject";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HypothesisRankListProps {
  hypotheses: HypothesisRecord[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function HypothesisRankList({
  hypotheses,
  selectedId,
  onSelect,
}: HypothesisRankListProps) {
  const sorted = [...hypotheses].sort((a, b) => {
    if (a.is_outgroup !== b.is_outgroup) return a.is_outgroup ? 1 : -1;
    return (a.rank ?? 99) - (b.rank ?? 99);
  });

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Ranked hypotheses
      </p>
      <div className="space-y-2">
        {sorted.map((h) => {
          const selected = h.id === selectedId;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect(h.id)}
              className={cn(
                "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                selected
                  ? "border-brand-purple bg-brand-purple/5"
                  : "border-[#EDE8E0] bg-white hover:border-brand-purple/30"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {h.is_outgroup ? (
                  <Badge className="border-0 bg-gray-100 text-xs text-gray-600">
                    Calibration control
                  </Badge>
                ) : (
                  <Badge className="border-0 bg-brand-purple/10 text-xs text-brand-purple">
                    #{h.rank ?? "—"}
                  </Badge>
                )}
                {h.declared_modality && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {h.declared_modality.replace(/_/g, " ")}
                  </Badge>
                )}
                {h.regulatory_pathway && (
                  <Badge variant="outline" className="text-[10px]">
                    {h.regulatory_pathway}
                  </Badge>
                )}
                {h.confidence_score != null && (
                  <span className="ml-auto text-xs font-medium text-gray-600">
                    {(h.confidence_score * 100).toFixed(0)}% conf
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">
                {h.statement}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
