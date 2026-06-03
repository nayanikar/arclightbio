"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface ChallengeCardProps {
  content: string;
  scoreImpact?: number;
  className?: string;
}

export function ChallengeCard({ content, scoreImpact, className }: ChallengeCardProps) {
  return (
    <article
      className={cn(
        "rounded-lg border border-brand-coral/20 bg-red-50/80 p-4",
        "border-l-[3px] border-l-brand-coral",
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-brand-coral" />
        <span className="text-xs font-semibold text-brand-coral">
          Regulatory challenge
        </span>
        {scoreImpact !== undefined && (
          <span className="ml-auto text-[11px] font-medium text-brand-coral">
            −{(scoreImpact * 100).toFixed(1)}% confidence
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-gray-800">{content}</p>
    </article>
  );
}
