import type { DecisionBrief } from "@/types/DecisionBrief";

export interface DecisionBriefPdfInput {
  brief: DecisionBrief;
  searchQuery: string;
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 10;
const BODY_LINE = 5;
const HEADING_SIZE = 14;

const RECOMMENDATION_LABEL: Record<DecisionBrief["recommendation"], string> = {
  pursue: "Pursue",
  watch: "Watch",
  partner: "Partner",
  kill: "Kill",
};

export function buildDecisionBriefPdfFilename(
  searchQuery: string,
  date = new Date()
): string {
  const slug = searchQuery
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const d = date.toISOString().slice(0, 10);
  return `arclight-decision-brief-${slug || "opportunity"}-${d}.pdf`;
}

export async function generateDecisionBriefPdf(
  input: DecisionBriefPdfInput
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { brief, searchQuery } = input;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;
  let pageIndex = 1;

  const newPage = () => {
    doc.addPage();
    pageIndex += 1;
    y = MARGIN;
    if (pageIndex > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Arclight Bio — Decision Brief — ${searchQuery.slice(0, 40)}`,
        MARGIN,
        12
      );
      doc.setTextColor(0, 0, 0);
    }
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) newPage();
  };

  const addWrapped = (
    text: string,
    opts?: { bold?: boolean; size?: number; lineHeight?: number }
  ) => {
    const size = opts?.size ?? BODY_SIZE;
    const lineHeight = opts?.lineHeight ?? BODY_LINE;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, MARGIN, y);
      y += lineHeight;
    }
  };

  const addSectionHeading = (title: string) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(HEADING_SIZE);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 6;
    doc.setLineWidth(0.35);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 8;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ARCLIGHT BIO — DECISION BRIEF", PAGE_WIDTH / 2, y, {
    align: "center",
  });
  y += 10;
  doc.setFontSize(11);
  doc.text(searchQuery, PAGE_WIDTH / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(BODY_SIZE);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated ${new Date(brief.generated_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    PAGE_WIDTH / 2,
    y,
    { align: "center" }
  );
  y += 12;

  addSectionHeading("Recommendation");
  addWrapped(
    `${RECOMMENDATION_LABEL[brief.recommendation].toUpperCase()}`,
    { bold: true, size: 12 }
  );
  y += 2;
  addWrapped(brief.recommendation_rationale);
  if (brief.calibration_caveat) {
    y += 3;
    addWrapped(`Calibration: ${brief.calibration_caveat}`);
  }

  addSectionHeading("Target Product Profile");
  for (const tier of ["minimum", "base", "aspirational"] as const) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text(tier.charAt(0).toUpperCase() + tier.slice(1), MARGIN, y);
    y += BODY_LINE;
    doc.setFont("helvetica", "normal");
    addWrapped(brief.tpp[tier]);
    y += 3;
  }

  addSectionHeading("Differentiation");
  addWrapped(brief.differentiation);

  if (brief.score_interpretation) {
    addSectionHeading("Score calibration");
    addWrapped(brief.score_interpretation);
  }

  if (brief.recommended_biomarkers) {
    addSectionHeading("Recommended biomarkers");
    if (brief.recommended_biomarkers.efficacy.length > 0) {
      addWrapped(`Efficacy: ${brief.recommended_biomarkers.efficacy.join(", ")}`);
    }
    if (brief.recommended_biomarkers.safety.length > 0) {
      addWrapped(`Safety: ${brief.recommended_biomarkers.safety.join(", ")}`);
    }
  }

  if (brief.recommended_models && brief.recommended_models.length > 0) {
    addSectionHeading("Recommended disease models");
    for (const m of brief.recommended_models.slice(0, 4)) {
      addWrapped(`${m.model}: ${m.rationale}`);
    }
  }

  if (brief.competitive_landscape) {
    addSectionHeading("Competitive landscape");
    addWrapped(brief.competitive_landscape.differentiation_summary);
    addWrapped(
      `Approved: ${brief.competitive_landscape.approved.join("; ") || "none"}`
    );
    addWrapped(
      `Failed/discontinued: ${brief.competitive_landscape.failed.join("; ") || "none"}`
    );
  }

  addSectionHeading("Next proof point");
  const np = brief.next_proof_point;
  addWrapped(np.study_type, { bold: true });
  addWrapped(
    `${np.primary_endpoint} · N=${np.n_required} · ${np.estimated_timeline} · ${np.estimated_cost_range}`
  );
  addWrapped(np.closes_gap);

  if (brief.critical_risks.length > 0) {
    addSectionHeading("Critical risks");
    for (const risk of brief.critical_risks.slice(0, 5)) {
      addWrapped(`[${risk.severity.toUpperCase()}] ${risk.risk}`);
      y += 2;
    }
  }

  if (brief.derisk_plan.length > 0) {
    addSectionHeading("De-risk plan");
    brief.derisk_plan.forEach((step, i) => {
      addWrapped(
        `${i + 1}. ${step.study_type} — N=${step.n_required}, ${step.estimated_timeline}, ${step.estimated_cost_range}`
      );
      addWrapped(step.closes_gap, { size: 9 });
      y += 2;
    });
  }

  addSectionHeading("Portfolio fit");
  addWrapped(brief.portfolio_fit.summary);

  addSectionHeading("Hypothesis ranking");
  addWrapped(brief.hypothesis_ranking_summary);

  y += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "CONFIDENTIAL — Arclight Bio · Discovery Program",
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - MARGIN,
    { align: "center" }
  );

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
  }

  return doc.output("blob");
}
