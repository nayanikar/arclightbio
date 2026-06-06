"use client";

import { motion } from "framer-motion";
import { homeCopy } from "../homeCopy";
import { staggerSlow, fadeUp } from "../homeMotion";

export function FunnelDiagram() {
  const stages = homeCopy.funnel.stages;

  return (
    <div
      className="w-full rounded-xl border p-6 sm:p-8"
      style={{
        borderColor: "rgba(15, 26, 46, 0.1)",
        background:
          "linear-gradient(180deg, rgba(26,107,99,0.05) 0%, var(--v3-paper) 100%)",
      }}
    >
      <p
        className="text-center text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: "var(--v3-teal)" }}
      >
        Progressive selectivity filter
      </p>

      <motion.div
        className="mt-6 grid gap-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={staggerSlow}
      >
        {stages.map((stage, i) => (
          <motion.div
            key={stage.key}
            variants={fadeUp}
            className="relative flex items-center gap-4 rounded-lg border bg-white/80 p-4"
            style={{
              borderColor: "rgba(26, 107, 99, 0.2)",
              marginLeft: `${i * 12}px`,
              maxWidth: `${100 - i * 8}%`,
            }}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg font-mono text-lg font-semibold tabular-nums text-white"
              style={{ background: "var(--v3-teal)" }}
            >
              {stage.count}
            </span>
            <div className="min-w-0">
              <p
                className="font-display text-sm font-semibold"
                style={{ color: "var(--v3-navy)" }}
              >
                {stage.label}
              </p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {stage.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
