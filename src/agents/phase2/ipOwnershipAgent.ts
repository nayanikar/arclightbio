import type { HypothesisRecord, OpportunityObject } from "@/types/OpportunityObject";
import { callAgentJson } from "@/api/anthropic";
import { searchPatents } from "@/api/lens";
import { discoverySystemPrompt, narrativeTemperature } from "@/lib/innovationProfile";
import { buildPhase2Context, contextPrompt, mergeAssessment } from "./helpers";

const SYSTEM = `You are an IP analyst for biopharma. Summarize patent ownership landscape for a therapeutic target and modality.
Return valid JSON: { "ip_summary": string, "key_assignees": string[], "freedom_to_operate_concerns": string[] }`;

export async function ipOwnershipAgent(
  obj: OpportunityObject,
  hypothesis: HypothesisRecord
): Promise<void> {
  const ctx = buildPhase2Context(obj, hypothesis);
  let patents: Awaited<ReturnType<typeof searchPatents>> = [];

  try {
    patents = await searchPatents(ctx.primaryTarget, 12);
  } catch {
    // non-fatal
  }

  let ip_summary: string;
  try {
    const result = await callAgentJson<{
      ip_summary: string;
      key_assignees: string[];
    }>(
      discoverySystemPrompt(SYSTEM, obj),
      `${contextPrompt(ctx)}
Patents found: ${patents.length}
Top titles: ${patents.slice(0, 5).map((p) => `${p.title} (${p.assignee})`).join("; ") || "none"}`,
      { temperature: narrativeTemperature(obj) }
    );
    ip_summary = result.ip_summary;
  } catch {
    const assignees = Array.from(new Set(patents.map((p) => p.assignee))).slice(0, 5);
    ip_summary =
      patents.length > 0
        ? `${patents.length} patents identified. Key assignees: ${assignees.join(", ")}.`
        : "No patent data retrieved — IP landscape requires manual review.";
  }

  await mergeAssessment(obj.id, hypothesis.id, { ip_summary });
}
