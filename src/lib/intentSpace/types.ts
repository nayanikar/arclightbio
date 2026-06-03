import type { AgentName, EvidenceTier } from "@/types/OpportunityObject";

export type IntentSpaceAgent = AgentName | "regulatory";

export type IntentSpaceEvent =
  | {
      type: "session_started";
      opportunityId: string;
      searchQuery?: string;
      tier?: EvidenceTier;
    }
  | {
      type: "agent_started";
      opportunityId: string;
      agent: IntentSpaceAgent;
      phase?: "early" | "full";
    }
  | {
      type: "agent_completed";
      opportunityId: string;
      agent: IntentSpaceAgent;
      phase?: "early" | "full";
      durationMs?: number;
    }
  | {
      type: "agent_failed";
      opportunityId: string;
      agent: IntentSpaceAgent;
      phase?: "early" | "full";
      error?: string;
    }
  | {
      type: "blackboard_completed";
      opportunityId: string;
      confidence?: number;
      zone?: string;
    }
  | {
      type: "surveillance_started";
      opportunityId: string;
    }
  | {
      type: "surveillance_completed";
      opportunityId: string;
      newSignals?: number;
    };
