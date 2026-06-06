"use client";

import { useState } from "react";
import {
  normalizeStructuredProse,
  type StructuredProse,
} from "@/lib/structureProse";
import { cn } from "@/lib/utils";

export function V3StructuredProse({
  content,
  className,
  detailCollapsed = true,
}: {
  content: Partial<StructuredProse> | string | null | undefined;
  className?: string;
  detailCollapsed?: boolean;
}) {
  const [showDetail, setShowDetail] = useState(!detailCollapsed);
  const prose = normalizeStructuredProse(content);

  if (!prose.summary && prose.key_points.length === 0) return null;

  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {prose.summary && (
        <p className="font-medium" style={{ color: "var(--v3-navy)" }}>
          {prose.summary}
        </p>
      )}
      {prose.key_points.length > 0 && (
        <ul className="list-disc space-y-1.5 pl-5" style={{ color: "var(--color-text-secondary)" }}>
          {prose.key_points.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      )}
      {prose.detail && (
        <div>
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="text-xs font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--v3-teal)" }}
          >
            {showDetail ? "Hide detail" : "Show detail"}
          </button>
          {showDetail && (
            <p className="mt-2 leading-[1.7]" style={{ color: "var(--color-text-secondary)" }}>
              {prose.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
