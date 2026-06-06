"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent } from "@/components/layout/PageContent";
import { Panel, SectionLabel } from "@/components/layout/Panel";
import { OrgContextSelector } from "@/components/org/OrgContextSelector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { OrganizationContext } from "@/types/OrganizationContext";
import { Search, Loader2, Upload, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  appendOpportunityId,
  opportunitySnapshotKey,
} from "@/lib/opportunityCache";
import { pickDefaultOrgContext } from "@/lib/orgContext";
import { PARENT_DOMAIN_OPTIONS } from "@/lib/parentDomains";
import { parseCohortCsv } from "@/lib/cohortParser";
import type { InnovationLevel, ParentDomain } from "@/types/V3Pipeline";
import { innovationLevelLabel } from "@/lib/innovationProfile";
import type { CohortParseResult } from "@/types/V3Pipeline";

const COHORT_INPUT_ID = "cohort-csv-upload";

const INNOVATION_OPTIONS: Array<{
  value: InnovationLevel;
  description: string;
}> = [
  {
    value: "lowest",
    description:
      "Precedent-backed, clinically proximate mechanisms. Favors de-risked hypotheses experts would already consider.",
  },
  {
    value: "medium",
    description:
      "Balances novel cross-context associations with mechanistic plausibility and falsifiable experimental paths.",
  },
  {
    value: "highest",
    description:
      "Non-obvious, cross-domain hypotheses with weak literature support — surprising but falsifiable. Use when you explicitly want maximum novelty over precedent.",
  },
];

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-8 sm:px-6">
          <div className="mx-auto max-w-3xl animate-pulse space-y-4">
            <div className="h-8 w-48 rounded bg-black/5" />
            <div className="h-4 w-full max-w-md rounded bg-black/5" />
            <div className="mt-6 h-64 rounded-xl bg-black/5" />
          </div>
        </div>
      }
    >
      <DiscoverPageInner />
    </Suspense>
  );
}

function DiscoverPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviseId = searchParams.get("revise");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [parentDomain, setParentDomain] = useState<ParentDomain>("oncology");
  const [innovationLevel, setInnovationLevel] = useState<InnovationLevel>("medium");
  const [contexts, setContexts] = useState<OrganizationContext[]>([]);
  const [orgContextId, setOrgContextId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cohortCsv, setCohortCsv] = useState("");
  const [cohortFileName, setCohortFileName] = useState("");
  const [cohortPreview, setCohortPreview] = useState<CohortParseResult | null>(null);
  const [cohortError, setCohortError] = useState("");
  const [cohortReading, setCohortReading] = useState(false);
  const [reviseMode, setReviseMode] = useState(false);

  useEffect(() => {
    if (!reviseId) return;
    setReviseMode(true);
    fetch(`/api/opportunity/${reviseId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.search_query) setQuery(data.search_query);
        if (data.parent_domain) setParentDomain(data.parent_domain);
        if (data.org_context_id) setOrgContextId(data.org_context_id);
      })
      .catch(console.error);
  }, [reviseId]);

  useEffect(() => {
    fetch("/api/discover")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load org contexts (${r.status})`);
        return r.json();
      })
      .then((data) => {
        const loaded = data.orgContexts ?? [];
        setContexts(loaded);
        const defaultOrg = pickDefaultOrgContext(loaded);
        if (defaultOrg) {
          setOrgContextId(defaultOrg.id);
        }
      })
      .catch((err) => {
        console.error("Org context load failed:", err);
      });
  }, []);

  useEffect(() => {
    if (!cohortCsv.trim()) {
      setCohortPreview(null);
      setCohortError("");
      return;
    }
    try {
      const preview = parseCohortCsv(cohortCsv, {
        fileName: cohortFileName || "cohort.csv",
        parentDomain,
      });
      setCohortPreview(preview);
      setCohortError("");
    } catch (err) {
      setCohortPreview(null);
      setCohortError(err instanceof Error ? err.message : "Invalid CSV");
    }
  }, [cohortCsv, cohortFileName, parentDomain]);

  const handleFileUpload = (file: File) => {
    setCohortError("");
    setCohortReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCohortCsv(text);
      setCohortFileName(file.name);
      setCohortReading(false);
    };
    reader.onerror = () => {
      setCohortReading(false);
      setCohortError("Could not read the file — re-save as CSV and try again");
    };
    reader.readAsText(file);
  };

  const handleCohortFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = "";
  };

  const resetCohortFileInputs = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    document
      .querySelectorAll<HTMLInputElement>("[data-cohort-file-input]")
      .forEach((input) => {
        input.value = "";
      });
  };

  const handleCohortDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading || cohortReading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const clearCohort = () => {
    setCohortCsv("");
    setCohortFileName("");
    setCohortPreview(null);
    setCohortError("");
    resetCohortFileInputs();
  };

  const cohortFileInputClassName =
    "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (reviseMode && reviseId) {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/opportunity/${reviseId}/revise`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, parentDomain }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Revise failed");
        router.push(`/opportunity/${reviseId}`);
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Revise failed");
        setLoading(false);
        return;
      }
    }

    if (!cohortCsv.trim()) {
      setError("Patient cohort CSV is required to start discovery");
      return;
    }
    if (cohortError || !cohortPreview) {
      setError(cohortError || "Fix CSV errors before submitting");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          parentDomain,
          orgContextId: orgContextId || undefined,
          cohortCsv,
          fileName: cohortFileName || "cohort.csv",
          innovationLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");

      appendOpportunityId(data.id);
      localStorage.setItem(
        opportunitySnapshotKey(data.id),
        JSON.stringify({
          id: data.id,
          query,
          hypothesis_statement: query,
          confidence_score: 0,
          actionability_zone: "too_early",
          status: "initialising",
          evidence_card_count: 0,
          challenge_count: 0,
          last_updated: new Date().toISOString(),
          schema_version: 3,
          innovation_level: innovationLevel,
        })
      );

      router.push(`/opportunity/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
      setLoading(false);
    }
  };

  const domainEntries = cohortPreview
    ? Object.entries({
        ...cohortPreview.cohort.domain_summary.primary_diagnosis_counts,
      }).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <>
      <TopBar
        narrow
        title={reviseMode ? "Revise discovery query" : "New discovery"}
        subtitle={
          reviseMode
            ? "Update clinical question or parent domain; cohort is retained on the existing session"
            : "Define parent domain, upload patient cohort, and seed the hypothesis funnel"
        }
      />

      <PageContent narrow flush className="space-y-6">
        <Panel
          title="Configure discovery session"
          bodyClassName="space-y-6"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {contexts.length > 0 && (
              <OrgContextSelector
                contexts={contexts}
                value={orgContextId}
                onChange={setOrgContextId}
              />
            )}

            <div className="space-y-3">
              <SectionLabel>Parent domain</SectionLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {PARENT_DOMAIN_OPTIONS.map((domain) => (
                  <button
                    key={domain.value}
                    type="button"
                    onClick={() => setParentDomain(domain.value)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left text-sm transition-all",
                      parentDomain === domain.value
                        ? "border-[var(--v3-teal)] bg-[rgba(26,107,99,0.06)] ring-1 ring-[var(--v3-teal)]/20"
                        : "border-[var(--color-border-tertiary)] bg-white hover:border-[var(--v3-teal)]/30"
                    )}
                  >
                    <span
                      className="font-medium"
                      style={{
                        color:
                          parentDomain === domain.value
                            ? "var(--v3-teal)"
                            : "var(--color-text-primary)",
                      }}
                    >
                      {domain.label}
                    </span>
                    <p
                      className="mt-1 text-xs leading-relaxed"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {domain.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <SectionLabel>Innovation appetite</SectionLabel>
              <div className="grid gap-2">
                {INNOVATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setInnovationLevel(option.value)}
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left text-sm transition-all",
                      innovationLevel === option.value
                        ? "border-[var(--v3-amber)] bg-[rgba(196,132,45,0.08)] ring-1 ring-[var(--v3-amber)]/25"
                        : "border-[var(--color-border-tertiary)] bg-white hover:border-[var(--v3-amber)]/30"
                    )}
                  >
                    <span
                      className="font-medium"
                      style={{
                        color:
                          innovationLevel === option.value
                            ? "var(--v3-amber)"
                            : "var(--color-text-primary)",
                      }}
                    >
                      {innovationLevelLabel(option.value)}
                    </span>
                    <p
                      className="mt-1 text-xs leading-relaxed"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                style={{ color: "var(--color-text-primary)" }}
              >
                Discovery query
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--color-text-tertiary)" }}
                />
                <Input
                  className="h-12 border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)]/40 pl-10 text-base"
                  placeholder="e.g. resistance mechanism in anti-PD1 non-responders with elevated TGF-β"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                Seeds your discovery thesis — not keyword search alone
              </p>
            </div>

            <div className="space-y-3">
              <SectionLabel>Patient cohort CSV</SectionLabel>
              {!cohortCsv ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={handleCohortDrop}
                  className={cn(
                    "relative flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
                    "border-[rgba(15,26,46,0.15)] bg-[var(--v3-paper)] hover:border-[var(--v3-teal)]/40",
                    (loading || cohortReading) && "opacity-60"
                  )}
                >
                  <input
                    id={COHORT_INPUT_ID}
                    ref={fileInputRef}
                    data-cohort-file-input
                    type="file"
                    accept=".csv,text/csv,text/plain,application/vnd.ms-excel"
                    disabled={loading || cohortReading}
                    className={cohortFileInputClassName}
                    onChange={handleCohortFileChange}
                  />
                  <div className="pointer-events-none flex flex-col items-center gap-2">
                    {cohortReading ? (
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--v3-teal)" }} />
                    ) : (
                      <Upload className="h-8 w-8" style={{ color: "var(--v3-teal)" }} />
                    )}
                    <span className="text-sm font-medium" style={{ color: "var(--v3-navy)" }}>
                      {cohortReading ? "Reading CSV…" : "Upload cohort CSV"}
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                      Click to browse or drag and drop · Required columns: patient_id,
                      primary_diagnosis, comorbidities, biomarkers, resistance_status, notes
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-xl border px-4 py-4"
                  style={{
                    borderColor: cohortError
                      ? "rgba(216, 90, 48, 0.3)"
                      : "rgba(26, 107, 99, 0.25)",
                    background: "var(--v3-paper)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" style={{ color: "var(--v3-teal)" }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--v3-navy)" }}>
                          {cohortFileName || "cohort.csv"}
                        </p>
                        {cohortPreview && (
                          <p className="text-xs" style={{ color: "var(--v3-amber)" }}>
                            {cohortPreview.cohort.row_count} patients parsed
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className="relative inline-flex cursor-pointer rounded-md px-2 py-1 text-xs font-medium hover:bg-black/5"
                        style={{ color: "var(--v3-teal)" }}
                      >
                        <input
                          data-cohort-file-input
                          type="file"
                          accept=".csv,text/csv,text/plain,application/vnd.ms-excel"
                          disabled={loading || cohortReading}
                          className={cohortFileInputClassName}
                          onChange={handleCohortFileChange}
                        />
                        Replace
                      </span>
                      <button
                        type="button"
                        onClick={clearCohort}
                        className="rounded-md p-1 hover:bg-black/5"
                        aria-label="Remove CSV"
                      >
                        <X className="h-4 w-4" style={{ color: "var(--color-text-tertiary)" }} />
                      </button>
                    </div>
                  </div>

                  {cohortError && (
                    <p className="mt-3 text-sm text-brand-coral">{cohortError}</p>
                  )}

                  {cohortPreview && !cohortError && (
                    <div className="mt-4 space-y-3">
                      <p
                        className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em]"
                        style={{ color: "var(--v3-teal)" }}
                      >
                        Domain distribution
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {domainEntries.slice(0, 6).map(([domain, count]) => (
                          <div
                            key={domain}
                            className="flex items-center justify-between rounded-md border border-[rgba(15,26,46,0.08)] bg-white/70 px-3 py-2 text-xs"
                          >
                            <span
                              className="truncate capitalize"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {domain}
                            </span>
                            <span className="ml-2 font-mono tabular-nums" style={{ color: "var(--v3-amber)" }}>
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                      {cohortPreview.cohort.domain_summary.non_parent_domain_patterns.length > 0 && (
                        <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                          {cohortPreview.cohort.domain_summary.non_parent_domain_patterns.length}{" "}
                          cross-domain pattern
                          {cohortPreview.cohort.domain_summary.non_parent_domain_patterns.length === 1
                            ? ""
                            : "s"}{" "}
                          detected outside parent domain
                        </p>
                      )}
                      {cohortPreview.warnings.length > 0 && (
                        <p className="text-xs text-amber-700">
                          {cohortPreview.warnings.length} row warning
                          {cohortPreview.warnings.length === 1 ? "" : "s"} — review before launch
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-coral">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-12 w-full text-base text-white hover:opacity-90"
              style={{ background: "var(--v3-navy)" }}
              disabled={
                loading ||
                cohortReading ||
                !query.trim() ||
                (!reviseMode &&
                  (!cohortCsv.trim() || !!cohortError || !cohortPreview))
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {reviseMode ? "Revising…" : "Initialising discovery…"}
                </>
              ) : reviseMode ? (
                "Revise & resume"
              ) : (
                "Launch discovery"
              )}
            </Button>
          </form>
        </Panel>
      </PageContent>
    </>
  );
}
