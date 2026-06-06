"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { viewportOnce } from "../homeMotion";

const BIOLOGY = {
  label: "Biology anchor",
  statement:
    "Anti-PD1 non-responders with elevated TGF-β drive resistance via immunosuppressive stroma.",
  population: "Stage IV melanoma, PD1-refractory, TGF-β high",
  market: "$4.2B",
};

const RESISTANCE = {
  label: "Resistance anchor",
  statement:
    "TGF-β signaling in the tumor microenvironment limits checkpoint response.",
  population: "Post-PD1 progression, TME TGF-β signature",
  market: "$2.8B",
};

function AnchorCard({
  label,
  statement,
  population,
  market,
  accent,
  delay,
  inView,
}: {
  label: string;
  statement: string;
  population: string;
  market: string;
  accent: "biology" | "resistance";
  delay: number;
  inView: boolean;
}) {
  const borderColor =
    accent === "biology" ? "rgba(26, 107, 99, 0.25)" : "rgba(196, 132, 45, 0.3)";
  const labelColor =
    accent === "biology" ? "var(--v3-teal)" : "var(--v3-amber)";

  return (
    <motion.article
      className="rounded-lg border bg-white/80 p-4 sm:p-5"
      style={{ borderColor }}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.4 }}
    >
      <p
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: labelColor }}
      >
        {label}
      </p>
      <p
        className="font-display mt-2 text-sm font-semibold leading-relaxed"
        style={{ color: "var(--v3-navy)" }}
      >
        {statement}
      </p>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Population
          </dt>
          <dd className="mt-1 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {population}
          </dd>
        </div>
        <div>
          <dt className="font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Market size
          </dt>
          <dd className="mt-1 font-display text-sm font-semibold tabular-nums" style={{ color: "var(--v3-navy)" }}>
            {market}
          </dd>
        </div>
      </dl>
    </motion.article>
  );
}

export function AnchorDualCard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, viewportOnce);

  return (
    <div ref={ref} className="grid gap-4 sm:grid-cols-2">
      <AnchorCard {...BIOLOGY} accent="biology" delay={0.1} inView={inView} />
      <AnchorCard {...RESISTANCE} accent="resistance" delay={0.2} inView={inView} />
    </div>
  );
}
