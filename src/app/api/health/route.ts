import { NextRequest, NextResponse } from "next/server";
import { searchPubMed } from "@/api/pubmed";
import { searchTrials } from "@/api/clinicalTrials";
import { findRelatedPapers } from "@/api/semanticScholar";
import { getTargetDiseaseAssociations } from "@/api/openTargets";
import { getAdverseEvents } from "@/api/openFda";
import { searchPatents } from "@/api/lens";
import { callAgent } from "@/api/anthropic";
import { ApiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service");
  const q = searchParams.get("q") ?? "cardiac amyloidosis";

  try {
    switch (service) {
      case "pubmed": {
        const papers = await searchPubMed(q, 5);
        return NextResponse.json({
          ok: true,
          count: papers.length,
          sample: papers.map((p) => ({ pmid: p.pmid, title: p.title, source_url: p.source_url })),
        });
      }
      case "clinicaltrials": {
        const trials = await searchTrials(q, "");
        return NextResponse.json({
          ok: true,
          count: trials.length,
          sample: trials.slice(0, 3).map((t) => ({ nctId: t.nctId, title: t.title, phase: t.phase })),
        });
      }
      case "semantic_scholar": {
        const papers = await searchPubMed(q, 1);
        const related = papers[0] ? await findRelatedPapers(`PMID:${papers[0].pmid}`, 3) : [];
        return NextResponse.json({ ok: true, count: related.length, sample: related.slice(0, 3) });
      }
      case "opentargets": {
        const assocs = await getTargetDiseaseAssociations(q.split(" ")[0]);
        return NextResponse.json({ ok: true, count: assocs.length, sample: assocs.slice(0, 3) });
      }
      case "openfda": {
        const events = await getAdverseEvents(q.split(" ")[0], 10);
        return NextResponse.json({ ok: true, count: events.length, sample: events.slice(0, 3) });
      }
      case "lens": {
        const patents = await searchPatents(q.split(" ")[0], 3);
        return NextResponse.json({ ok: true, count: patents.length, sample: patents });
      }
      case "anthropic": {
        const text = await callAgent(
          "Respond with a JSON object: { ok: true, message: string }",
          "Say hello from Arclight Bio Discovery Program."
        );
        return NextResponse.json({ ok: true, response: text.slice(0, 200) });
      }
      default:
        return NextResponse.json({
          services: ["pubmed", "clinicaltrials", "semantic_scholar", "opentargets", "openfda", "lens", "anthropic"],
          usage: "/api/health?service=pubmed&q=your+query",
        });
    }
  } catch (err) {
    const message = err instanceof ApiError ? err.message : String(err);
    const code = err instanceof ApiError ? err.code : "HTTP_ERROR";
    return NextResponse.json({ ok: false, error: message, code }, { status: 200 });
  }
}
