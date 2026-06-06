"use client";

import { motion } from "framer-motion";
import { staggerSlow, fadeUp } from "../homeMotion";

export function ExpertDomainMerger() {
  return (
    <div
      className="w-full rounded-xl border p-6 sm:p-8"
      style={{
        borderColor: "rgba(15, 26, 46, 0.1)",
        background:
          "linear-gradient(180deg, var(--v3-paper) 0%, rgba(26,107,99,0.05) 100%)",
      }}
    >
      <p
        className="text-center text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: "var(--v3-teal)" }}
      >
        Domain discovery pipeline
      </p>

      <motion.div
        className="mt-6 space-y-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerSlow}
      >
        <motion.div variants={fadeUp} className="flex justify-center">
          <span
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
            style={{
              borderColor: "rgba(26, 107, 99, 0.3)",
              color: "var(--v3-navy)",
              background: "white",
            }}
          >
            Parent domain
          </span>
        </motion.div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { label: "CD1 · Cohort patterns", desc: "Recurrence from patient data" },
            { label: "CD2 · Literature", desc: "PubMed & target associations" },
          ].map((item) => (
            <motion.div
              key={item.label}
              variants={fadeUp}
              className="rounded-lg border bg-white/80 p-4"
              style={{ borderColor: "rgba(26, 107, 99, 0.2)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--v3-navy)" }}>
                {item.label}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div variants={fadeUp} className="flex justify-center">
          <span
            className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
            style={{
              borderColor: "var(--v3-amber)",
              color: "var(--v3-navy)",
              background: "rgba(196, 132, 45, 0.1)",
            }}
          >
            Expert domains → Hypothesis funnel
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
