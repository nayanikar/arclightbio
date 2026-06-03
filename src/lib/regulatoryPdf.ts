import type { AgentName } from "@/types/OpportunityObject";
import type {
  CredibilityRating,
  RegulatoryPackage,
} from "@/types/RegulatoryPackage";

export interface RegulatoryPdfInput {
  pkg: RegulatoryPackage;
  searchQuery: string;
  hypothesisStatement: string;
}

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 10;
const BODY_LINE = 5;
const HEADING_SIZE = 14;

const AGENT_ROWS: Array<{
  key: AgentName;
  label: string;
  dataSource: string;
  sectionMatch: string[];
}> = [
  {
    key: "literature",
    label: "Literature",
    dataSource: "PubMed, Europe PMC",
    sectionMatch: ["literature", "pubmed"],
  },
  {
    key: "mechanism",
    label: "Mechanism",
    dataSource: "Open Targets Platform",
    sectionMatch: ["mechanism", "open targets"],
  },
  {
    key: "clinical_trial",
    label: "Clinical Trial",
    dataSource: "ClinicalTrials.gov",
    sectionMatch: ["clinical", "trial"],
  },
  {
    key: "commercial",
    label: "Commercial",
    dataSource: "OpenFDA, Patents",
    sectionMatch: ["commercial", "market"],
  },
  {
    key: "rwe_signal",
    label: "RWE Signal",
    dataSource: "OpenFDA FAERS",
    sectionMatch: ["rwe", "real world", "faers"],
  },
  {
    key: "regulatory",
    label: "Regulatory",
    dataSource: "Internal audit",
    sectionMatch: ["regulatory", "compliance", "audit"],
  },
];

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function gapTitle(description: string): string {
  const first = description.split(/[.!?]/)[0]?.trim();
  if (first && first.length <= 80) return first;
  return truncate(description, 80);
}

function ratingLabel(rating: CredibilityRating): string {
  return rating.charAt(0).toUpperCase() + rating.slice(1);
}

function matchSection(
  sections: RegulatoryPackage["credibility_report"]["evidence_sections"],
  agent: (typeof AGENT_ROWS)[number]
) {
  const lower = (s: string) => s.toLowerCase();
  return sections.find((sec) =>
    agent.sectionMatch.some((m) => lower(sec.section).includes(m))
  );
}

function countByAgent(
  trail: RegulatoryPackage["provenance_trail"]
): Record<AgentName, number> {
  const counts: Record<string, number> = {};
  for (const row of AGENT_ROWS) counts[row.key] = 0;
  for (const entry of trail) {
    counts[entry.agent] = (counts[entry.agent] ?? 0) + 1;
  }
  return counts as Record<AgentName, number>;
}

export function buildRegulatoryPdfFilename(
  searchQuery: string,
  date = new Date()
): string {
  const slug = searchQuery
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const d = date.toISOString().slice(0, 10);
  return `arclight-regulatory-${slug || "package"}-${d}.pdf`;
}

export async function generateRegulatoryPdf(
  input: RegulatoryPdfInput
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { pkg, searchQuery, hypothesisStatement } = input;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;
  let pageIndex = 1;
  const headerQuery = truncate(searchQuery, 30);
  const agentCounts = countByAgent(pkg.provenance_trail);
  const assemblyDate = new Date(pkg.assembly_timestamp).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const drawRunningHeader = () => {
    if (pageIndex === 1) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Arclight Bio — Regulatory Package — ${headerQuery}`,
      MARGIN,
      12
    );
    doc.setTextColor(0, 0, 0);
  };

  const newPage = () => {
    doc.addPage();
    pageIndex += 1;
    y = MARGIN;
    drawRunningHeader();
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      newPage();
    }
  };

  const addWrapped = (
    text: string,
    opts?: { bold?: boolean; size?: number; lineHeight?: number; indent?: number }
  ) => {
    const size = opts?.size ?? BODY_SIZE;
    const lineHeight = opts?.lineHeight ?? BODY_LINE;
    const indent = opts?.indent ?? 0;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, MARGIN + indent, y);
      y += lineHeight;
    }
  };

  const addSectionHeading = (title: string) => {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(HEADING_SIZE);
    doc.text(title.toUpperCase(), MARGIN, y);
    y += 6;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 8;
  };

  const addHorizontalRule = () => {
    ensureSpace(6);
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 6;
  };

  // --- PAGE 1: COVER ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ARCLIGHT BIO — OPPORTUNITY SPACE", PAGE_WIDTH / 2, y, {
    align: "center",
  });
  y += 10;
  doc.setFontSize(13);
  doc.text("Regulatory Intelligence Package", PAGE_WIDTH / 2, y, {
    align: "center",
  });
  y += 12;
  addHorizontalRule();

  addWrapped(`Opportunity: ${searchQuery}`, { bold: true });
  y += 2;
  addWrapped(`Hypothesis: ${hypothesisStatement}`);
  y += 2;
  addWrapped(`Assembly date: ${assemblyDate}`);
  addWrapped(`Target agency: ${pkg.target_agency}`);
  addWrapped(`Version lock: ${pkg.version_lock_hash}`);
  y += 4;
  addWrapped(
    "Prepared under FDA Draft Guidance: Considerations for Use of AI to Support Regulatory Decision-Making (January 2025)"
  );

  y = PAGE_HEIGHT - MARGIN - 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "CONFIDENTIAL — Arclight Bio · Opportunity Space",
    PAGE_WIDTH / 2,
    y,
    { align: "center" }
  );

  // --- PAGE 2: AI ROLE DECLARATION ---
  newPage();
  addSectionHeading("AI Role Declaration");
  addWrapped(pkg.credibility_report.ai_role_declaration);
  y += 6;

  ensureSpace(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(BODY_SIZE);
  doc.text("Agent", MARGIN, y);
  doc.text("Data source", MARGIN + 52, y);
  doc.text("Items retrieved", MARGIN + 130, y);
  y += BODY_LINE;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y - 2, PAGE_WIDTH - MARGIN, y - 2);
  y += 2;

  doc.setFont("helvetica", "normal");
  for (const agent of AGENT_ROWS) {
    ensureSpace(BODY_LINE + 2);
    doc.text(agent.label, MARGIN, y);
    doc.text(agent.dataSource, MARGIN + 52, y);
    doc.text(String(agentCounts[agent.key] ?? 0), MARGIN + 130, y);
    y += BODY_LINE + 1;
  }

  // --- PAGE 3: CREDIBILITY REPORT ---
  newPage();
  addSectionHeading("Evidence Credibility Report");

  const summaryRows: Array<{
    section: string;
    items: number;
    avgQuality: number;
    rating: string;
  }> = [];

  for (const agent of AGENT_ROWS) {
    const section = matchSection(
      pkg.credibility_report.evidence_sections,
      agent
    );
    const items = section?.ai_generated_items ?? agentCounts[agent.key] ?? 0;
    const avgQuality =
      section?.average_regulatory_weight ??
      (items > 0 ? 0.55 : 0);
    const rating: CredibilityRating =
      section?.credibility_rating ??
      (avgQuality >= 0.65 ? "high" : avgQuality >= 0.45 ? "moderate" : "low");

    const firstClaim = pkg.provenance_trail.find(
      (p) => p.agent === agent.key
    )?.claim;

    ensureSpace(36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text(`${agent.label} — ${ratingLabel(rating)}`, MARGIN, y);
    y += BODY_LINE;
    doc.setFont("helvetica", "normal");
    addWrapped(
      `Items: ${items} · Avg quality score: ${(avgQuality * 100).toFixed(0)}% · Human validated: ${section?.human_validated_items ?? 0}`
    );
    addWrapped(
      firstClaim
        ? truncate(firstClaim, 300)
        : `No ${agent.label.toLowerCase()} evidence items in this package.`
    );
    y += 4;

    summaryRows.push({
      section: agent.label,
      items,
      avgQuality,
      rating: ratingLabel(rating),
    });
  }

  y += 4;
  ensureSpace(30);
  doc.setFont("helvetica", "bold");
  doc.text("Section", MARGIN, y);
  doc.text("Items", MARGIN + 55, y);
  doc.text("Avg quality", MARGIN + 85, y);
  doc.text("Rating", MARGIN + 130, y);
  y += BODY_LINE;
  doc.line(MARGIN, y - 2, PAGE_WIDTH - MARGIN, y - 2);
  y += 2;
  doc.setFont("helvetica", "normal");
  for (const row of summaryRows) {
    ensureSpace(BODY_LINE + 1);
    doc.text(row.section, MARGIN, y);
    doc.text(String(row.items), MARGIN + 55, y);
    doc.text(`${(row.avgQuality * 100).toFixed(0)}%`, MARGIN + 85, y);
    doc.text(row.rating, MARGIN + 130, y);
    y += BODY_LINE + 1;
  }

  // --- PAGE 4+: GAP REPORT ---
  newPage();
  addSectionHeading("Compliance Gap Analysis");
  addWrapped(
    "Reference: Per FDA Draft Guidance January 2025 — Risk-Based Credibility Framework"
  );
  y += 4;

  const blocking = pkg.gap_report.filter((g) => g.blocking);
  const advisory = pkg.gap_report.filter((g) => !g.blocking);

  const renderGap = (
    gap: (typeof pkg.gap_report)[number],
    kind: "blocking" | "advisory"
  ) => {
    const boxHeight = 38;
    ensureSpace(boxHeight + 6);
    const boxY = y;
    if (kind === "blocking") {
      doc.setFillColor(254, 226, 226);
      doc.setTextColor(127, 29, 29);
    } else {
      doc.setFillColor(254, 243, 199);
      doc.setTextColor(120, 53, 15);
    }
    doc.roundedRect(MARGIN, boxY, CONTENT_WIDTH, boxHeight, 2, 2, "F");
    doc.setTextColor(0, 0, 0);

    y = boxY + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text(kind === "blocking" ? "[BLOCKING]" : "[ADVISORY]", MARGIN + 3, y);
    y += BODY_LINE;
    doc.text(gapTitle(gap.gap_description), MARGIN + 3, y);
    y += BODY_LINE;
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(
      gap.gap_description,
      CONTENT_WIDTH - 6
    );
    for (const line of descLines.slice(0, 2)) {
      doc.text(line, MARGIN + 3, y);
      y += BODY_LINE - 1;
    }
    y += 1;
    doc.setFont("helvetica", "bold");
    doc.text(
      kind === "blocking" ? "Required action:" : "Recommended action:",
      MARGIN + 3,
      y
    );
    y += BODY_LINE - 1;
    doc.setFont("helvetica", "normal");
    const actionLines = doc.splitTextToSize(
      gap.required_action,
      CONTENT_WIDTH - 6
    );
    for (const line of actionLines.slice(0, 2)) {
      doc.text(line, MARGIN + 3, y);
      y += BODY_LINE - 1;
    }
    y = boxY + boxHeight + 6;
  };

  if (blocking.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    addWrapped("BLOCKING GAPS", { bold: true });
    y += 2;
    for (const gap of blocking) renderGap(gap, "blocking");
  }

  if (advisory.length > 0) {
    doc.setFont("helvetica", "bold");
    addWrapped("ADVISORY GAPS", { bold: true });
    y += 2;
    for (const gap of advisory) renderGap(gap, "advisory");
  }

  if (blocking.length === 0 && advisory.length === 0) {
    addWrapped("No compliance gaps identified in this package.");
  }

  // --- PAGE 5+: PROVENANCE TRAIL ---
  newPage();
  addSectionHeading("Evidence Provenance Trail");
  addWrapped(
    `All items version-locked at ${pkg.version_lock_hash}`
  );
  y += 4;

  pkg.provenance_trail.forEach((entry, index) => {
    ensureSpace(32);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(BODY_SIZE);
    doc.text(`[${index + 1}] ${entry.agent.toUpperCase().replace(/_/g, " ")}`, MARGIN, y);
    y += BODY_LINE;
    doc.setFont("helvetica", "normal");
    addWrapped(`Claim: ${truncate(entry.claim, 200)}`);
    const source = entry.source_chain[0] ?? "—";
    addWrapped(`Source: ${source}`);
    addWrapped(`Retrieved: ${new Date(entry.timestamp).toLocaleString()}`);
    addWrapped(`Hash: ${entry.raw_api_response_hash}`);
    addHorizontalRule();
  });

  if (pkg.provenance_trail.length === 0) {
    addWrapped("No provenance entries in this package.");
  }

  // --- FINAL PAGE: CERTIFICATION ---
  newPage();
  addSectionHeading("Certification of AI-Assisted Submission");
  addWrapped(
    "This package was assembled by Opportunity Space, an AI-native discovery platform developed by Arclight Bio. All evidence items are traceable to their original public data sources via the provenance hashes above. This package has been reviewed by a qualified human expert prior to use in any regulatory context."
  );
  y += 16;
  addWrapped("Expert review: _______________");
  y += 8;
  addWrapped("Date: _______________");
  y += 16;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "Arclight Bio · Opportunity Space · Nucleate NY BioHack 2026",
    PAGE_WIDTH / 2,
    y,
    { align: "center" }
  );

  // Page numbers
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
