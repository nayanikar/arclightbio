"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { homeCopy } from "../homeCopy";
import { staggerSlow, fadeUp } from "../homeMotion";

export function Phase2Pipeline() {
  const { pipelineTitle, steps } = homeCopy.phaseTwo;

  return (
    <div
      className="w-full rounded-xl border p-6 sm:p-8"
      style={{
        borderColor: "rgba(15, 26, 46, 0.1)",
        background:
          "linear-gradient(135deg, rgba(26,107,99,0.04) 0%, var(--v3-paper) 50%, rgba(196,132,45,0.05) 100%)",
      }}
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: "var(--v3-teal)" }}
      >
        {pipelineTitle}
      </p>

      <motion.div
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerSlow}
      >
        {steps.map((step, i) => (
          <motion.div key={step.label} variants={fadeUp} className="relative">
            <div
              className="h-full rounded-lg border bg-white/80 p-4"
              style={{ borderColor: "rgba(26, 107, 99, 0.2)" }}
            >
              <p
                className="font-mono text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--v3-amber)" }}
              >
                Step {i + 1}
              </p>
              <p
                className="font-display mt-2 text-sm font-semibold leading-snug"
                style={{ color: "var(--v3-navy)" }}
              >
                {step.label}
              </p>
              <p
                className="mt-2 text-xs leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {step.desc}
              </p>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight
                className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 lg:block"
                style={{ color: "var(--v3-teal-light)" }}
                aria-hidden
              />
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
