import type { AgentName, EvidenceCard, OpportunityStatus } from "@/types/OpportunityObject";
import { AGENT_PIP_COLORS } from "@/lib/dashboardLayout";

export const BLACKBOARD_AGENT_ORDER: AgentName[] = [
  "literature",
  "mechanism",
  "modality",
  "clinical_trial",
  "commercial",
  "rwe_signal",
  "regulatory",
];

export const AGENT_SHORT_LABELS: Record<AgentName, string> = {
  literature: "Lit",
  mechanism: "Mech",
  clinical_trial: "Trial",
  commercial: "Comm",
  regulatory: "Reg",
  rwe_signal: "RWE",
  modality: "Mod",
};

export type AgentNodeState = "idle" | "running" | "complete";

export interface GraphAgentNode {
  id: AgentName;
  label: string;
  color: string;
  x: number;
  y: number;
  state: AgentNodeState;
  cardCount: number;
}

export interface GraphEvidenceNode {
  id: string;
  agent: AgentName;
  x: number;
  y: number;
}

export interface AgentGraphLayout {
  width: number;
  height: number;
  root: { x: number; y: number; label: string };
  agents: GraphAgentNode[];
  evidence: GraphEvidenceNode[];
}

function agentState(
  agent: AgentName,
  cards: EvidenceCard[],
  status: OpportunityStatus,
  isStreaming: boolean
): AgentNodeState {
  const count = cards.filter(
    (c) => c.contributing_agent === agent && !c.is_challenge
  ).length;
  if (count > 0) return "complete";
  if (isStreaming && status === "agents_running") return "running";
  return "idle";
}

export function buildAgentGraphLayout(
  hypothesisLabel: string,
  cards: EvidenceCard[],
  status: OpportunityStatus,
  isStreaming: boolean
): AgentGraphLayout {
  const width = 280;
  const height = 260;
  const cx = width / 2;
  const cy = height / 2 - 8;
  const agentRadius = 72;

  const feedCards = cards.filter(
    (c) =>
      !c.is_challenge &&
      !c.is_target_list &&
      !c.is_modality_card
  );

  const agents: GraphAgentNode[] = BLACKBOARD_AGENT_ORDER.map((agent, i) => {
    const angle = (i / BLACKBOARD_AGENT_ORDER.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + agentRadius * Math.cos(angle);
    const y = cy + agentRadius * Math.sin(angle);
    const agentCards = feedCards.filter((c) => c.contributing_agent === agent);
    return {
      id: agent,
      label: AGENT_SHORT_LABELS[agent],
      color: AGENT_PIP_COLORS[agent],
      x,
      y,
      state: agentState(agent, feedCards, status, isStreaming),
      cardCount: agentCards.length,
    };
  });

  const evidence: GraphEvidenceNode[] = [];
  for (const agentNode of agents) {
    const agentCards = feedCards
      .filter((c) => c.contributing_agent === agentNode.id)
      .slice(0, 3);
    agentCards.forEach((card, idx) => {
      const angle =
        Math.atan2(agentNode.y - cy, agentNode.x - cx) +
        (idx - 1) * 0.35;
      const leafRadius = agentRadius + 28 + idx * 6;
      evidence.push({
        id: card.id,
        agent: agentNode.id,
        x: cx + leafRadius * Math.cos(angle),
        y: cy + leafRadius * Math.sin(angle),
      });
    });
  }

  return {
    width,
    height,
    root: {
      x: cx,
      y: cy,
      label: hypothesisLabel.slice(0, 24) + (hypothesisLabel.length > 24 ? "…" : ""),
    },
    agents,
    evidence,
  };
}
