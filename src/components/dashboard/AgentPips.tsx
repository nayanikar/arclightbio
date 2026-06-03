import type { AgentName } from "@/types/OpportunityObject";
import { AGENT_PIP_COLORS } from "@/lib/dashboardLayout";
import { cn } from "@/lib/utils";

interface AgentPipsProps {
  agents: AgentName[];
  pulsingAgents?: AgentName[];
  className?: string;
}

export function AgentPips({
  agents,
  pulsingAgents = [],
  className,
}: AgentPipsProps) {
  if (agents.length === 0) return null;

  const pulseSet = new Set(pulsingAgents);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {agents.map((agent) => (
        <span
          key={agent}
          title={agent.replace("_", " ")}
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            pulseSet.has(agent) && "animate-lp"
          )}
          style={{ background: AGENT_PIP_COLORS[agent] }}
        />
      ))}
    </div>
  );
}
