"use client";

import { motion } from "framer-motion";
import type { ActionabilityZone } from "@/types/OpportunityObject";
import { confidenceBarColor } from "@/lib/dashboardLayout";

interface ConfidenceGaugeProps {
  score: number;
  zone?: ActionabilityZone;
  label?: string;
  preliminary?: boolean;
}

export function ConfidenceGauge({
  score,
  zone,
  label,
  preliminary,
}: ConfidenceGaugeProps) {
  const pct = Math.round(score * 100);
  const barColor = confidenceBarColor(score, zone);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {label ?? "Confidence Score"}
        </span>
        <div className="flex items-center gap-2">
          {preliminary && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              Preliminary
            </span>
          )}
          <motion.span
            key={pct}
            initial={{ scale: 1.2, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl font-bold text-gray-900"
          >
            {pct}%
          </motion.span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
