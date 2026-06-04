"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import type { DeriskRecommendation } from "@/types/OpportunityObject";

interface ChallengeCardProps {
  content: string;
  scoreImpact?: number;
  deriskRecommendation?: DeriskRecommendation;
  className?: string;
}

export function ChallengeCard({
  content,
  scoreImpact,
  deriskRecommendation,
  className,
}: ChallengeCardProps) {
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
      {deriskRecommendation && (
        <div className="mt-3 rounded-md border border-brand-teal/20 bg-brand-teal/[0.04] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-teal">
            De-risking recommendation
          </p>
          <dl className="mt-2 space-y-1 text-xs text-gray-700">
            <div>
              <dt className="inline font-medium">Study: </dt>
              <dd className="inline">{deriskRecommendation.study_type}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Objective: </dt>
              <dd className="inline">{deriskRecommendation.primary_objective}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Population: </dt>
              <dd className="inline">{deriskRecommendation.patient_population}</dd>
            </div>
            <div>
              <dt className="inline font-medium">N≥: </dt>
              <dd className="inline">{deriskRecommendation.n_required}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Endpoint: </dt>
              <dd className="inline">{deriskRecommendation.primary_endpoint}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Timeline: </dt>
              <dd className="inline">{deriskRecommendation.estimated_timeline}</dd>
            </div>
          </dl>
        </div>
      )}
    </article>
  );
}
