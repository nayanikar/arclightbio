"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { PageContent } from "@/components/layout/PageContent";
import { Panel, SectionLabel } from "@/components/layout/Panel";
import { OrgContextSelector } from "@/components/org/OrgContextSelector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { OrganizationContext } from "@/types/OrganizationContext";
import type { EvidenceTier } from "@/types/OpportunityObject";
import { tierDisplayLabel } from "@/lib/evidenceTier";
import { Search, Loader2, Zap, Microscope } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  appendOpportunityId,
  opportunitySnapshotKey,
} from "@/lib/opportunityCache";
import { pickDefaultOrgContext } from "@/lib/orgContext";

interface ClassificationPreview {
  tier: EvidenceTier;
  prior_score: number;
  reasoning: string;
}

export default function DiscoverPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"speed" | "depth">("speed");
  const [contexts, setContexts] = useState<OrganizationContext[]>([]);
  const [orgContextId, setOrgContextId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [classification, setClassification] = useState<ClassificationPreview | null>(
    null
  );
  const [classifying, setClassifying] = useState(false);

  useEffect(() => {
    fetch("/api/discover")
      .then((r) => r.json())
      .then((data) => {
        const loaded = data.orgContexts ?? [];
        setContexts(loaded);
        const defaultOrg = pickDefaultOrgContext(loaded);
        if (defaultOrg) {
          setOrgContextId(defaultOrg.id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      setClassification(null);
      setClassifying(false);
      return;
    }

    setClassifying(true);
    const timer = window.setTimeout(() => {
      fetch("/api/discover/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      })
        .then((r) => r.json())
        .then((data: ClassificationPreview & { error?: string }) => {
          if (data.error || !data.tier) {
            setClassification(null);
            return;
          }
          setClassification(data);
        })
        .catch(() => setClassification(null))
        .finally(() => setClassifying(false));
    }, 800);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, orgContextId, mode }),
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
        })
      );

      router.push(`/opportunity/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
      setLoading(false);
    }
  };

  return (
    <>
      <TopBar
        title="New discovery"
        subtitle="Search any drug, target, or indication — all data is live"
      />

      <PageContent narrow className="space-y-6">
        <section>
          <SectionLabel>Discovery mode</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                {
                  id: "speed" as const,
                  label: "Speed",
                  time: "2–5 min",
                  detail: "Top PubMed results · preliminary audit",
                  icon: Zap,
                },
                {
                  id: "depth" as const,
                  label: "Depth",
                  time: "15–30 min",
                  detail: "Semantic Scholar · full regulatory audit",
                  icon: Microscope,
                },
              ] as const
            ).map(({ id, label, time, detail, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "flex flex-col rounded-xl border p-4 text-left transition-all",
                  mode === id
                    ? "border-brand-purple bg-white shadow-sm ring-2 ring-brand-purple/20"
                    : "border-gray-200/80 bg-white hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      mode === id ? "text-brand-purple" : "text-gray-400"
                    )}
                  />
                  <span className="text-sm font-semibold text-gray-900">{label}</span>
                  <span className="ml-auto text-[11px] text-gray-400">{time}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">{detail}</p>
              </button>
            ))}
          </div>
        </section>

        <Panel title="Configure session">
          <form onSubmit={handleSubmit} className="space-y-5">
            <OrgContextSelector
              contexts={contexts}
              value={orgContextId}
              onChange={setOrgContextId}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Discovery query
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  className="h-11 border-gray-200 bg-gray-50/50 pl-9"
                  placeholder="e.g. TTR amyloidosis cardiac"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-400">
                PubMed · ClinicalTrials.gov · Open Targets · OpenFDA
              </p>
              {(classifying || classification) && (
                <p className="text-xs text-gray-600">
                  {classifying ? (
                    "Analysing field maturity…"
                  ) : classification ? (
                    <>
                      Field maturity:{" "}
                      <span className="font-medium text-gray-800">
                        {tierDisplayLabel(classification.tier)}
                      </span>
                      {" · "}
                      Starting confidence prior:{" "}
                      <span className="font-medium text-gray-800">
                        {Math.round(classification.prior_score * 100)}%
                      </span>
                    </>
                  ) : null}
                </p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-coral">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full bg-brand-purple hover:bg-brand-purple/90"
              disabled={loading || !query.trim() || !orgContextId}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initialising…
                </>
              ) : (
                `Launch ${mode === "depth" ? "depth" : "speed"} session`
              )}
            </Button>
          </form>
        </Panel>
      </PageContent>
    </>
  );
}
