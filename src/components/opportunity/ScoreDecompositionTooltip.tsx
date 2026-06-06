"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { ScoreDecomposition } from "@/lib/scoreDecomposition";

interface ScoreDecompositionTooltipProps {
  decomposition?: ScoreDecomposition | null;
  confidenceScore: number;
}

export function ScoreDecompositionTooltip({
  decomposition,
  confidenceScore,
}: ScoreDecompositionTooltipProps) {
  const [open, setOpen] = useState(false);

  const interpretation =
    decomposition?.interpretation ??
    `${(confidenceScore * 100).toFixed(0)}% reflects weighted evidence quality minus regulatory challenges. Not probability of clinical success.`;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-background-secondary)]"
        style={{ color: "var(--color-text-tertiary)" }}
        aria-label="Score interpretation"
        title="Score interpretation"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close score interpretation"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border bg-white p-3 text-xs shadow-lg"
            style={{
              borderColor: "var(--color-border-tertiary)",
              color: "var(--color-text-secondary)",
            }}
          >
            <p className="leading-relaxed">{interpretation}</p>
            {decomposition && (
              <ul className="mt-2 space-y-0.5 text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                <li>Evidence weight: {(decomposition.evidence_weight * 100).toFixed(0)}%</li>
                {decomposition.challenge_penalty > 0 && (
                  <li>Challenge penalty: −{(decomposition.challenge_penalty * 100).toFixed(0)}%</li>
                )}
                {decomposition.genetics_boost > 0 && (
                  <li>Genetics boost: +{(decomposition.genetics_boost * 100).toFixed(0)}%</li>
                )}
                {decomposition.weak_ot_penalty > 0 && (
                  <li>Weak OT / mismatch: −{(decomposition.weak_ot_penalty * 100).toFixed(0)}%</li>
                )}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
