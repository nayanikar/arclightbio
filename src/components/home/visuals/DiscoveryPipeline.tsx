"use client";

import { motion } from "framer-motion";
import { homeCopy } from "../homeCopy";
import { staggerSlow, fadeUp } from "../homeMotion";

export function DiscoveryPipeline() {
  const { pipelineTitle, pipelineSteps } = homeCopy.problemStatement;

  return (
    <div
      className="rounded-2xl border p-6 sm:p-8"
      style={{
        borderColor: "rgba(15, 26, 46, 0.1)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, var(--v3-paper) 100%)",
      }}
    >
      <p
        className="text-center text-[11px] font-medium uppercase tracking-[0.18em]"
        style={{ color: "var(--v3-teal)" }}
      >
        {pipelineTitle}
      </p>

      <motion.ol
        className="mt-6 grid gap-4 sm:grid-cols-5"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={staggerSlow}
      >
        {pipelineSteps.map((item) => (
          <motion.li
            key={item.label}
            variants={fadeUp}
            className="flex flex-col items-center rounded-xl border bg-white/70 p-4 text-center"
            style={{ borderColor: "rgba(26, 107, 99, 0.15)" }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: "var(--v3-teal)" }}
            >
              {item.step}
            </span>
            <p
              className="font-display mt-3 text-sm font-semibold"
              style={{ color: "var(--v3-navy)" }}
            >
              {item.label}
            </p>
            <p
              className="mt-1.5 text-xs leading-relaxed"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {item.desc}
            </p>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}
