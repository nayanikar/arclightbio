import type {
  CohortDomainSummary,
  CohortParseResult,
} from "@/types/V3Pipeline";
import type { ParentDomain } from "@/types/V3Pipeline";
import { assertCohortCsvWithinLimits } from "@/lib/cohortLimits";

const REQUIRED_COLUMNS = [
  "patient_id",
  "primary_diagnosis",
  "comorbidities",
  "biomarkers",
  "resistance_status",
  "notes",
] as const;

type CsvRow = Record<(typeof REQUIRED_COLUMNS)[number], string>;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function splitList(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function incrementCount(map: Record<string, number>, key: string): void {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return;
  map[normalized] = (map[normalized] ?? 0) + 1;
}

function buildDomainSummary(
  rows: CsvRow[],
  parentDomain: ParentDomain
): CohortDomainSummary {
  const primary_diagnosis_counts: Record<string, number> = {};
  const comorbidity_counts: Record<string, number> = {};
  const biomarker_counts: Record<string, number> = {};
  const resistance_status_counts: Record<string, number> = {};
  const nonParentCounts: Record<string, number> = {};

  for (const row of rows) {
    incrementCount(primary_diagnosis_counts, row.primary_diagnosis);
    for (const comorbidity of splitList(row.comorbidities)) {
      incrementCount(comorbidity_counts, comorbidity);
      if (comorbidity.toLowerCase() !== parentDomain) {
        incrementCount(nonParentCounts, comorbidity);
      }
    }
    for (const biomarker of splitList(row.biomarkers)) {
      incrementCount(biomarker_counts, biomarker);
    }
    if (row.resistance_status) {
      incrementCount(resistance_status_counts, row.resistance_status);
    }
    if (
      row.primary_diagnosis &&
      row.primary_diagnosis.toLowerCase() !== parentDomain
    ) {
      incrementCount(nonParentCounts, row.primary_diagnosis);
    }
  }

  const total = rows.length || 1;
  const non_parent_domain_patterns = Object.entries(nonParentCounts)
    .map(([domain, patient_count]) => ({
      domain,
      patient_count,
      recurrence_rate: patient_count / total,
    }))
    .filter((p) => p.recurrence_rate > 0)
    .sort((a, b) => b.recurrence_rate - a.recurrence_rate);

  return {
    primary_diagnosis_counts,
    comorbidity_counts,
    biomarker_counts,
    resistance_status_counts,
    non_parent_domain_patterns,
  };
}

export function parseCohortCsv(
  csvText: string,
  options: {
    fileName: string;
    parentDomain: ParentDomain;
    cohortName?: string;
  }
): CohortParseResult {
  assertCohortCsvWithinLimits(csvText);

  const warnings: string[] = [];
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one patient row");
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) {
      throw new Error(`Missing required column: ${col}`);
    }
  }

  const rows: CsvRow[] = [];
  const seenPatientIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.every((v) => !v)) continue;

    const row: Partial<CsvRow> = {};
    for (const col of REQUIRED_COLUMNS) {
      const idx = header.indexOf(col);
      row[col] = values[idx] ?? "";
    }

    if (!row.patient_id) {
      warnings.push(`Row ${i + 1}: missing patient_id — skipped`);
      continue;
    }
    if (!row.primary_diagnosis) {
      warnings.push(`Row ${i + 1}: missing primary_diagnosis — skipped`);
      continue;
    }
    if (seenPatientIds.has(row.patient_id)) {
      warnings.push(`Row ${i + 1}: duplicate patient_id ${row.patient_id} — skipped`);
      continue;
    }
    seenPatientIds.add(row.patient_id);
    rows.push(row as CsvRow);
  }

  if (rows.length === 0) {
    throw new Error("No valid patient rows found in CSV");
  }

  const domain_summary = buildDomainSummary(rows, options.parentDomain);

  return {
    cohort: {
      name: options.cohortName ?? null,
      file_name: options.fileName,
      row_count: rows.length,
      domain_summary,
    },
    patients: rows.map((row) => ({
      patient_id: row.patient_id,
      primary_diagnosis: row.primary_diagnosis,
      comorbidities: splitList(row.comorbidities),
      biomarkers: row.biomarkers || null,
      resistance_status: row.resistance_status || null,
      notes: row.notes || null,
    })),
    warnings,
  };
}
