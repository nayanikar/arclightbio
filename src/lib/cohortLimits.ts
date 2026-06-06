/** Demo-safe caps — well above typical hackathon cohorts, blocks abuse. */
export const MAX_COHORT_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_COHORT_ROWS = 10_000;

export function assertCohortCsvWithinLimits(csvText: string): void {
  const bytes = new TextEncoder().encode(csvText).byteLength;
  if (bytes > MAX_COHORT_CSV_BYTES) {
    throw new Error(
      `Cohort CSV exceeds ${MAX_COHORT_CSV_BYTES / (1024 * 1024)} MB limit`
    );
  }

  const dataRows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  if (dataRows > MAX_COHORT_ROWS + 1) {
    throw new Error(`Cohort CSV exceeds ${MAX_COHORT_ROWS} patient row limit`);
  }
}

export function isCohortFileWithinLimits(sizeBytes: number): boolean {
  return sizeBytes <= MAX_COHORT_CSV_BYTES;
}
