import { NextRequest } from "next/server";
import { getOpportunityObject, getEvidenceCardsSince } from "@/lib/db";
import { isBlackboardPausedMidRun } from "@/lib/blackboardRun";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  let lastTimestamp = new Date(0).toISOString();
  let lastAgentEventAt: string | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      send("connected", { opportunityId: params.id });

      const poll = async () => {
        while (!closed) {
          try {
            const obj = await getOpportunityObject(params.id);
            if (!obj) {
              send("error", { message: "Opportunity not found" });
              break;
            }

            const newCards = await getEvidenceCardsSince(params.id, lastTimestamp);
            for (const card of newCards) {
              lastTimestamp = card.timestamp;
              send("card", card);
            }

            const lastEvent = obj.blackboard_state?.lastEvent;
            if (lastEvent && lastEvent.at !== lastAgentEventAt) {
              lastAgentEventAt = lastEvent.at;
              send("agent_status", lastEvent);
            }

            send("score", {
              confidence_score: obj.confidence_score,
              actionability_score: obj.actionability_score,
              actionability_zone: obj.actionability_zone,
              status: obj.status,
              blackboard_error: obj.blackboard_state?.lastError,
            });

            if (obj.status === "agents_failed") {
              send("failed", {
                status: obj.status,
                message:
                  obj.blackboard_state?.lastError ??
                  "Discovery pipeline failed after retry",
              });
              break;
            }

            if (obj.status === "complete" || obj.status === "surveillance") {
              send("complete", {
                status: obj.status,
                surveillance_tags: obj.surveillance_tags,
              });
              break;
            }

            if (obj.status === "paused") {
              if (isBlackboardPausedMidRun(obj.blackboard_state)) {
                send("paused", {
                  status: obj.status,
                  phase: "agents",
                  completedSteps: obj.blackboard_state?.completedSteps ?? [],
                });
              } else {
                send("complete", {
                  status: obj.status,
                  phase: "surveillance",
                  surveillance_tags: obj.surveillance_tags,
                });
                break;
              }
            }
          } catch (err) {
            send("error", {
              message: err instanceof Error ? err.message : "Stream error",
            });
            break;
          }

          await new Promise((r) => setTimeout(r, 1500));
        }

        if (!closed) controller.close();
      };

      poll();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
