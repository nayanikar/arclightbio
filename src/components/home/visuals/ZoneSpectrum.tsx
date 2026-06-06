"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { confidenceBarColor } from "@/lib/dashboardLayout";
import type { ActionabilityZone } from "@/types/OpportunityObject";
import { homeCopy } from "../homeCopy";
import { viewportOnce } from "../homeMotion";

export function ZoneSpectrum() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, viewportOnce);

  return (
    <div ref={ref} className="space-y-4" aria-label="Portfolio actionability zones">
      {homeCopy.portfolio.zones.map((zone, i) => (
        <div key={zone.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span
              className="font-medium uppercase tracking-wider"
              style={{ color: "var(--v3-navy)" }}
            >
              {zone.label}
            </span>
            <span style={{ color: "var(--color-text-tertiary)" }}>
              {zone.width}%
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full"
            style={{ background: "rgba(15, 26, 46, 0.08)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundColor: confidenceBarColor(
                  0,
                  zone.zone as ActionabilityZone
                ),
              }}
              initial={{ width: 0 }}
              animate={inView ? { width: `${zone.width}%` } : {}}
              transition={{
                delay: 0.15 + i * 0.12,
                duration: 0.55,
                ease: "easeOut",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
