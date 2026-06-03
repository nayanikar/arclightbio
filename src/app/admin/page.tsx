"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyOpportunitiesUpdated, SESSIONS_UPDATED_EVENT } from "@/lib/events";
import type { ScoreBackfillRow } from "@/lib/scoreMaintenance";

function notifySessionsUpdated() {
  window.dispatchEvent(new CustomEvent(SESSIONS_UPDATED_EVENT));
  notifyOpportunitiesUpdated();
}

export default function AdminPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<"backfill" | "tags" | "stop" | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [backfillReport, setBackfillReport] = useState<ScoreBackfillRow[]>([]);
  const [tagsResult, setTagsResult] = useState<string | null>(null);
  const [stopResult, setStopResult] = useState<string | null>(null);

  const runBackfill = async () => {
    setBusy("backfill");
    setBackfillResult(null);
    setBackfillReport([]);
    try {
      const res = await fetch("/api/admin/backfill", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setBackfillResult(
          `Processed ${data.opportunitiesProcessed} opportunities, updated ${data.cardsUpdated} cards, removed ${data.challengesRemoved} excess challenges.`
        );
        if (Array.isArray(data.report)) {
          setBackfillReport(data.report);
          console.table(data.report);
        }
        notifySessionsUpdated();
      } else {
        setBackfillResult(data.error ?? "Backfill failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const runStopSurveillance = async () => {
    setBusy("stop");
    setStopResult(null);
    try {
      const res = await fetch("/api/admin/stop-surveillance", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStopResult(
          `Paused ${data.paused} session${data.paused === 1 ? "" : "s"} (${data.skipped} skipped).`
        );
        notifySessionsUpdated();
      } else {
        setStopResult(data.error ?? "Stop surveillance failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const runRegenerateTags = async () => {
    setBusy("tags");
    setTagsResult(null);
    try {
      const res = await fetch("/api/admin/regenerate-tags", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTagsResult(
          `Regenerated tags for ${data.tagsGenerated} of ${data.opportunitiesProcessed} opportunities.`
        );
        notifySessionsUpdated();
      } else {
        setTagsResult(data.error ?? "Tag regeneration failed");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="text-sm text-gray-500 hover:text-gray-800"
      >
        ← Back to dashboard
      </button>

      <h1 className="mt-4 text-xl font-semibold text-gray-900">Dev admin</h1>
      <p className="mt-1 text-sm text-gray-500">
        Hidden controls for development. Open with Shift+P from anywhere in the app.
      </p>

      <div className="mt-8 space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-900">Score backfill</h2>
          <p className="mt-1 text-xs text-gray-500">
            Recompute evidence card quality and prior-anchored confidence scores.
            Uses stored <code className="text-[10px]">query_tier</code> when set;
            runs Claude classifier only when <code className="text-[10px]">query_tier</code> is
            null. To re-classify all, run{" "}
            <code className="text-[10px]">UPDATE opportunity_objects SET query_tier = NULL;</code>{" "}
            in Supabase first.
          </p>
          <button
            type="button"
            onClick={runBackfill}
            disabled={busy !== null}
            className="mt-3 rounded-lg bg-brand-purple px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "backfill" ? "Running…" : "Run backfill"}
          </button>
          {backfillResult && (
            <p className="mt-2 text-xs text-gray-600">{backfillResult}</p>
          )}
          {backfillReport.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2 pr-3 font-medium">Query</th>
                    <th className="py-2 pr-3 font-medium">Tier</th>
                    <th className="py-2 pr-3 font-medium">Prior</th>
                    <th className="py-2 pr-3 font-medium">Old score</th>
                    <th className="py-2 pr-3 font-medium">New score</th>
                    <th className="py-2 font-medium">Zone change</th>
                  </tr>
                </thead>
                <tbody>
                  {backfillReport.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100">
                      <td className="max-w-[220px] truncate py-2 pr-3 text-gray-800">
                        {row.search_query ?? "—"}
                      </td>
                      <td className="py-2 pr-3 capitalize text-gray-700">
                        {row.query_tier}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-gray-700">
                        {Math.round(row.prior * 100)}%
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-gray-700">
                        {Math.round(row.old_confidence_score * 100)}%
                      </td>
                      <td className="py-2 pr-3 tabular-nums font-medium text-gray-900">
                        {Math.round(row.new_confidence_score * 100)}%
                      </td>
                      <td className="py-2 capitalize text-gray-700">
                        {row.old_actionability_zone.replace(/_/g, " ")} →{" "}
                        {row.new_actionability_zone.replace(/_/g, " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-900">Stop surveillance</h2>
          <p className="mt-1 text-xs text-gray-500">
            Pause all active surveillance sessions at once to stop API polling and
            scan jobs.
          </p>
          <button
            type="button"
            onClick={runStopSurveillance}
            disabled={busy !== null}
            className="mt-3 rounded-lg bg-[#D85A30] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "stop" ? "Stopping…" : "Stop all surveillance"}
          </button>
          {stopResult && (
            <p className="mt-2 text-xs text-gray-600">{stopResult}</p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-medium text-gray-900">Surveillance tags</h2>
          <p className="mt-1 text-xs text-gray-500">
            Regenerate Claude-powered concept and entity tags from each hypothesis.
          </p>
          <button
            type="button"
            onClick={runRegenerateTags}
            disabled={busy !== null}
            className="mt-3 rounded-lg bg-brand-purple px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "tags" ? "Generating…" : "Regenerate all tags"}
          </button>
          {tagsResult && (
            <p className="mt-2 text-xs text-gray-600">{tagsResult}</p>
          )}
        </section>
      </div>
    </div>
  );
}
