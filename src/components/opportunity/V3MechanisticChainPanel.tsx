"use client";

import type { MechanisticChain } from "@/types/MechanisticChain";
import { V3Panel } from "@/components/opportunity/v3/V3Panel";
import { cn } from "@/lib/utils";

interface V3MechanisticChainPanelProps {
  chain: MechanisticChain | null | undefined;
  className?: string;
}

const EVIDENCE_STYLES = {
  association: {
    bg: "rgba(26, 107, 99, 0.1)",
    color: "var(--v3-teal)",
    label: "ASSOCIATION",
  },
  causation: {
    bg: "var(--v3-amber-glow)",
    color: "var(--v3-amber)",
    label: "CAUSATION",
  },
  intervention: {
    bg: "rgba(15, 26, 46, 0.08)",
    color: "var(--v3-navy)",
    label: "INTERVENTION",
  },
} as const;

export function V3MechanisticChainPanel({
  chain,
  className,
}: V3MechanisticChainPanelProps) {
  if (!chain || (chain.nodes.length === 0 && chain.edges.length === 0)) {
    return (
      <V3Panel
        title="Mechanistic chain"
        description="Association → causation evidence ladder"
        className={className}
      >
        <p className="text-sm" style={{ color: "var(--color-text-tertiary)" }}>
          Chain builds as literature and mechanism agents link entities
        </p>
      </V3Panel>
    );
  }

  const nodeMap = new Map(chain.nodes.map((n) => [n.id, n]));
  const associationEdges = chain.edges.filter((e) => e.evidence_class === "association");
  const causationEdges = chain.edges.filter((e) => e.evidence_class === "causation");
  const otherEdges = chain.edges.filter(
    (e) => e.evidence_class !== "association" && e.evidence_class !== "causation"
  );

  return (
    <V3Panel
      title="Mechanistic chain"
      description={`${(chain.overall_chain_confidence * 100).toFixed(0)}% chain confidence`}
      className={className}
      accent
    >
      <div className="space-y-5">
        {associationEdges.length > 0 && (
          <ChainSection title="Association links" edges={associationEdges} nodeMap={nodeMap} />
        )}
        {causationEdges.length > 0 && (
          <ChainSection title="Causation links" edges={causationEdges} nodeMap={nodeMap} />
        )}
        {otherEdges.length > 0 && (
          <ChainSection title="Intervention links" edges={otherEdges} nodeMap={nodeMap} />
        )}
        {chain.gaps.length > 0 && (
          <div
            className="rounded-lg border px-3 py-2.5 text-xs"
            style={{
              borderColor: "rgba(196, 132, 45, 0.25)",
              background: "var(--v3-amber-glow)",
              color: "var(--color-text-secondary)",
            }}
          >
            <p className="font-medium" style={{ color: "var(--v3-amber)" }}>
              Evidence gaps
            </p>
            <ul className="mt-1 space-y-0.5">
              {chain.gaps.slice(0, 4).map((g, i) => (
                <li key={i}>· {g}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </V3Panel>
  );
}

function ChainSection({
  title,
  edges,
  nodeMap,
}: {
  title: string;
  edges: MechanisticChain["edges"];
  nodeMap: Map<string, { label: string }>;
}) {
  return (
    <div>
      <p
        className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.15em]"
        style={{ color: "var(--v3-teal)" }}
      >
        {title}
      </p>
      <ol className="space-y-2 border-l-2 pl-4" style={{ borderColor: "rgba(26, 107, 99, 0.2)" }}>
        {edges.map((edge, i) => {
          const style = EVIDENCE_STYLES[edge.evidence_class] ?? EVIDENCE_STYLES.association;
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          return (
            <li key={i} className="relative text-xs">
              <span
                className="absolute -left-[1.2rem] top-1.5 h-2 w-2 rounded-full"
                style={{ background: style.color }}
              />
              <p className="font-medium" style={{ color: "var(--v3-navy)" }}>
                {from?.label ?? edge.from} → {to?.label ?? edge.to}
              </p>
              <p className="mt-0.5 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                <span
                  className={cn("mr-1.5 rounded px-1 py-0.5 text-[9px] font-semibold tracking-wide")}
                  style={{ background: style.bg, color: style.color }}
                >
                  {style.label}
                </span>
                {(edge.confidence * 100).toFixed(0)}% — {edge.rationale}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
