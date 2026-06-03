import { NextRequest } from "next/server";
import { getOpportunityObject, getEvidenceCardsSince } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  let lastTimestamp = new Date(0).toISOString();
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

            send("score", {
              confidence_score: obj.confidence_score,
              actionability_score: obj.actionability_score,
              actionability_zone: obj.actionability_zone,
              status: obj.status,
            });

            if (obj.status === "complete" || obj.status === "surveillance" || obj.status === "paused") {
              send("complete", {
                status: obj.status,
                surveillance_tags: obj.surveillance_tags,
              });
              break;
            }
          } catch (err) {
            send("error", {
              message: err instanceof Error ? err.message : "Stream error",
            });
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
