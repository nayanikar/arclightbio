"use client";

import { Panel } from "@/components/layout/Panel";
import type { MechanisticChain } from "@/types/MechanisticChain";
import { cn } from "@/lib/utils";

interface MechanisticChainPanelProps {
  chain: MechanisticChain;
  className?: string;
}

const NODE_TYPE_LABEL: Record<string, string> = {
  gene: "Gene",
  protein: "Protein",
  cell: "Cell",
  pathway: "Pathway",
  phenotype: "Phenotype",
};

export function MechanisticChainPanel({
  chain,
  className,
}: MechanisticChainPanelProps) {
  if (chain.nodes.length === 0 && chain.gaps.length === 0) return null;

  const nodeMap = new Map(chain.nodes.map((n) => [n.id, n]));

  return (
    <Panel title="Mechanistic chain" className={className}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-gray-600">Chain confidence</span>
          <span className="tabular-nums font-semibold text-gray-900">
            {(chain.overall_chain_confidence * 100).toFixed(0)}%
          </span>
        </div>

        {chain.edges.length > 0 && (
          <ol className="space-y-2 border-l-2 border-brand-purple/30 pl-4">
            {chain.edges.map((edge, i) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);
              return (
                <li key={i} className="relative text-xs">
                  <span className="absolute -left-[1.15rem] top-1 h-2 w-2 rounded-full bg-brand-purple/60" />
                  <p className="font-medium text-gray-800">
                    {from?.label ?? edge.from} → {to?.label ?? edge.to}
                  </p>
                  <p className="mt-0.5 text-gray-600">
                    <span
                      className={cn(
                        "mr-1.5 rounded px-1 py-0.5 text-[10px] uppercase",
                        edge.evidence_class === "intervention"
                          ? "bg-green-100 text-green-800"
                          : edge.evidence_class === "causation"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-700"
                      )}
                    >
                      {edge.evidence_class}
                    </span>
                    {(edge.confidence * 100).toFixed(0)}% — {edge.rationale}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {chain.nodes.length > 0 && chain.edges.length === 0 && (
          <ul className="flex flex-wrap gap-2">
            {chain.nodes.map((n) => (
              <li
                key={n.id}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700"
              >
                {NODE_TYPE_LABEL[n.type] ?? n.type}: {n.label}
              </li>
            ))}
          </ul>
        )}

        {chain.gaps.length > 0 && (
          <div className="rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-amber-800">
              Gaps
            </p>
            <ul className="space-y-1 text-xs text-amber-900">
              {chain.gaps.slice(0, 4).map((g, i) => (
                <li key={i}>• {g}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
