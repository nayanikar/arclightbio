"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Panel } from "@/components/layout/Panel";
import { useOpportunityStore } from "@/store/opportunityStore";
import { buildAgentGraphLayout } from "@/lib/agentGraph";
import type { AgentName } from "@/types/OpportunityObject";
import { cn } from "@/lib/utils";

export function AgentNodeGraph() {
  const {
    opportunity,
    streamingCards,
    status,
    isStreaming,
    selectedAgent,
    setSelectedAgent,
  } = useOpportunityStore();

  const hypothesisLabel =
    opportunity?.hypothesis.statement ?? opportunity?.search_query ?? "Hypothesis";

  const layout = useMemo(
    () =>
      buildAgentGraphLayout(
        hypothesisLabel,
        streamingCards,
        status,
        isStreaming
      ),
    [hypothesisLabel, streamingCards, status, isStreaming]
  );

  const [focusAgent, setFocusAgent] = useState<AgentName | null>(null);
  const activeFocus = focusAgent ?? selectedAgent;

  const handleAgentClick = (agent: AgentName) => {
    if (activeFocus === agent) {
      setFocusAgent(null);
      setSelectedAgent(null);
    } else {
      setFocusAgent(agent);
      setSelectedAgent(agent);
    }
  };

  const handleRootClick = () => {
    setFocusAgent(null);
    setSelectedAgent(null);
  };

  const transform = activeFocus
    ? (() => {
        const node = layout.agents.find((a) => a.id === activeFocus);
        if (!node) return undefined;
        const dx = layout.width / 2 - node.x;
        const dy = layout.height / 2 - node.y;
        return `translate(${dx}px, ${dy}px) scale(1.35)`;
      })()
    : undefined;

  return (
    <Panel title="Agent network" bodyClassName="p-0">
      <div className="relative h-[280px] overflow-hidden rounded-b-lg bg-[#FAFAF8]">
        <svg
          className="absolute inset-0 h-full w-full opacity-30"
          aria-hidden
        >
          <defs>
            <pattern
              id="graph-grid"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke="#E5DDD2"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#graph-grid)" />
        </svg>

        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ transform: transform ?? "translate(0px, 0px) scale(1)" }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="overflow-visible"
          >
            {layout.agents.map((agent) => (
              <line
                key={`edge-root-${agent.id}`}
                x1={layout.root.x}
                y1={layout.root.y}
                x2={agent.x}
                y2={agent.y}
                stroke="#D6D0C4"
                strokeWidth={1}
                opacity={activeFocus && activeFocus !== agent.id ? 0.2 : 0.8}
              />
            ))}

            {layout.evidence.map((leaf) => {
              const agentNode = layout.agents.find((a) => a.id === leaf.agent);
              if (!agentNode) return null;
              return (
                <line
                  key={`edge-${leaf.id}`}
                  x1={agentNode.x}
                  y1={agentNode.y}
                  x2={leaf.x}
                  y2={leaf.y}
                  stroke="#D6D0C4"
                  strokeWidth={0.75}
                  strokeDasharray="3 3"
                  opacity={
                    activeFocus && activeFocus !== leaf.agent ? 0.15 : 0.6
                  }
                />
              );
            })}

            {layout.evidence.map((leaf) => (
              <circle
                key={leaf.id}
                cx={leaf.x}
                cy={leaf.y}
                r={3}
                fill="#A8A29E"
                opacity={
                  activeFocus && activeFocus !== leaf.agent ? 0.2 : 0.7
                }
              />
            ))}

            <g
              className="cursor-pointer"
              onClick={handleRootClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleRootClick()}
            >
              <circle
                cx={layout.root.x}
                cy={layout.root.y}
                r={14}
                fill="#534AB7"
              />
              <text
                x={layout.root.x}
                y={layout.root.y + 26}
                textAnchor="middle"
                className="fill-gray-600 text-[9px] font-medium"
              >
                {layout.root.label}
              </text>
            </g>

            {layout.agents.map((agent) => (
              <g
                key={agent.id}
                className="cursor-pointer"
                onClick={() => handleAgentClick(agent.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleAgentClick(agent.id)
                }
              >
                <circle
                  cx={agent.x}
                  cy={agent.y}
                  r={activeFocus === agent.id ? 13 : 11}
                  fill="white"
                  stroke={agent.color}
                  strokeWidth={activeFocus === agent.id ? 3 : 2}
                  className={cn(
                    agent.state === "running" && "animate-pulse",
                    activeFocus && activeFocus !== agent.id && "opacity-30"
                  )}
                />
                {agent.state === "complete" && (
                  <circle
                    cx={agent.x}
                    cy={agent.y}
                    r={5}
                    fill={agent.color}
                    className={
                      activeFocus && activeFocus !== agent.id
                        ? "opacity-30"
                        : undefined
                    }
                  />
                )}
                {agent.state === "running" && (
                  <circle
                    cx={agent.x}
                    cy={agent.y}
                    r={4}
                    fill="#BA7517"
                    className="animate-pulse"
                  />
                )}
                <text
                  x={agent.x}
                  y={agent.y + (activeFocus === agent.id ? 22 : 20)}
                  textAnchor="middle"
                  className={cn(
                    "fill-gray-600 text-[8px] font-semibold",
                    activeFocus && activeFocus !== agent.id && "opacity-30"
                  )}
                >
                  {agent.label}
                </text>
              </g>
            ))}
          </svg>
        </motion.div>
      </div>
    </Panel>
  );
}
