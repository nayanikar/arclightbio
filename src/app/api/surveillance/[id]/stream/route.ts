import { NextRequest } from "next/server";
import { runSurveillanceScan } from "@/lib/surveillance";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        send("connected", { opportunityId: params.id });

        await runSurveillanceScan(params.id, (progress) => {
          if (progress.type === "step") send("step", progress.step);
          if (progress.type === "summary") send("summary", progress.summary);
          if (progress.type === "complete") send("complete", progress.result);
        });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Surveillance scan failed",
        });
      } finally {
        if (!closed) controller.close();
      }
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
