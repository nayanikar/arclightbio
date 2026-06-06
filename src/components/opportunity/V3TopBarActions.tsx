"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Pencil, OctagonPause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurveillancePauseButton } from "@/components/opportunity/SurveillancePanel";
import { PARENT_DOMAIN_OPTIONS } from "@/lib/parentDomains";
import type { OpportunityStatus } from "@/types/OpportunityObject";
import type { ParentDomain } from "@/types/V3Pipeline";

interface V3TopBarActionsProps {
  id: string;
  status: OpportunityStatus;
  parentDomain?: ParentDomain | null;
  searchQuery?: string | null;
  pausing: boolean;
  resuming: boolean;
  onPause: () => void;
  onResume: () => void;
  onWorkflowComplete?: () => void;
}

export function V3TopBarActions({
  id,
  status,
  parentDomain,
  searchQuery,
  pausing,
  resuming,
  onPause,
  onResume,
  onWorkflowComplete,
}: V3TopBarActionsProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseQuery, setReviseQuery] = useState(searchQuery ?? "");
  const [reviseDomain, setReviseDomain] = useState<ParentDomain>(
    parentDomain ?? "oncology"
  );
  const [busy, setBusy] = useState(false);
  const [workflowError, setWorkflowError] = useState("");

  const canStopAgents = status === "agents_running";

  const handleAddData = async (file: File) => {
    setBusy(true);
    setWorkflowError("");
    try {
      const form = new FormData();
      form.append("cohortCsv", file);
      const res = await fetch(`/api/opportunity/${id}/add-data`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Add data failed");
      setAddOpen(false);
      onWorkflowComplete?.();
      router.refresh();
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : "Add data failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRevise = async () => {
    setBusy(true);
    setWorkflowError("");
    try {
      const res = await fetch(`/api/opportunity/${id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: reviseQuery.trim() || undefined,
          parentDomain: reviseDomain !== parentDomain ? reviseDomain : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revise failed");
      setReviseOpen(false);
      onWorkflowComplete?.();
      router.refresh();
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : "Revise failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-[rgba(15,26,46,0.12)] text-xs"
          style={{ color: "var(--v3-navy)" }}
          onClick={() => {
            setWorkflowError("");
            setAddOpen(true);
          }}
        >
          <Database className="h-3.5 w-3.5" />
          Add data
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-[rgba(15,26,46,0.12)] text-xs"
          style={{ color: "var(--v3-navy)" }}
          onClick={() => {
            setReviseQuery(searchQuery ?? "");
            setReviseDomain(parentDomain ?? "oncology");
            setWorkflowError("");
            setReviseOpen(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
          Revise query
        </Button>
        <SurveillancePauseButton
          status={status}
          pausing={pausing}
          resuming={resuming}
          onPause={onPause}
          onResume={onResume}
          showResume
        />
        {canStopAgents && (
          <Button
            size="sm"
            variant="destructive"
            className="h-8 shrink-0 bg-brand-coral hover:bg-brand-coral/90"
            onClick={onPause}
            disabled={pausing}
          >
            <OctagonPause className="mr-1.5 h-3.5 w-3.5" />
            {pausing ? "Stopping…" : "Stop agents"}
          </Button>
        )}
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-data-title"
        >
          <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-xl">
            <h2 id="add-data-title" className="font-display text-sm font-semibold">
              Add cohort data
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              Upload additional patient CSV rows. Pipeline resumes from population definition.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="mt-4 block w-full text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAddData(file);
              }}
            />
            {workflowError && (
              <p className="mt-2 text-xs text-red-600">{workflowError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {reviseOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revise-title"
        >
          <div className="w-full max-w-md rounded-xl border bg-white p-5 shadow-xl">
            <h2 id="revise-title" className="font-display text-sm font-semibold">
              Revise discovery query
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              Updates query and/or parent domain; pipeline resumes from anchor profiling.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                value={reviseQuery}
                onChange={(e) => setReviseQuery(e.target.value)}
                placeholder="Clinical question"
                className="text-sm"
              />
              <select
                value={reviseDomain}
                onChange={(e) => setReviseDomain(e.target.value as ParentDomain)}
                className="h-9 w-full rounded-md border px-2 text-sm"
              >
                {PARENT_DOMAIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {workflowError && (
              <p className="mt-2 text-xs text-red-600">{workflowError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setReviseOpen(false)}
              >
                Cancel
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void handleRevise()}>
                {busy ? "Saving…" : "Revise & resume"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
