"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import { ProvenanceTree } from "@/components/regulatory/ProvenanceTree";
import { ComplianceReport } from "@/components/regulatory/ComplianceReport";
import { PackageDownload } from "@/components/regulatory/PackageDownload";
import { buildProvenanceGraph } from "@/lib/provenance";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { RegulatoryPackage } from "@/types/RegulatoryPackage";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function RegulatoryPage() {
  const params = useParams();
  const id = params.id as string;
  const [obj, setObj] = useState<OpportunityObject | null>(null);
  const [pkg, setPkg] = useState<RegulatoryPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/opportunity/${id}`)
      .then((r) => r.json())
      .then(setObj)
      .catch(console.error);
  }, [id]);

  const handleAssemble = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/regulatory/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetAgency: "FDA" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPkg(data.package);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assembly failed");
    } finally {
      setLoading(false);
    }
  };

  if (!obj) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    );
  }

  const provenanceNodes = buildProvenanceGraph(obj.evidence_cards);

  return (
    <div>
      <TopBar
        title="Regulatory Assembly"
        subtitle="Stage 3 — FDA/EMA-ready documentation"
        badge={
          <Link href={`/opportunity/${id}`}>
            <Button variant="outline" size="sm">
              Back to program
            </Button>
          </Link>
        }
      />

      <div className="space-y-6 p-6">
        {!pkg ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Assemble Regulatory Package
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Version-lock this discovery program and generate a provenance trail
              mapped to FDA January 2025 AI guidance.
            </p>
            {error && <p className="mt-2 text-sm text-brand-coral">{error}</p>}
            <Button
              className="mt-4 bg-brand-purple hover:bg-brand-purple/90"
              onClick={handleAssemble}
              disabled={loading || obj.actionability_zone !== "act_now"}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assembling...
                </>
              ) : (
                "Assemble Package"
              )}
            </Button>
            {obj.actionability_zone !== "act_now" && (
              <p className="mt-2 text-xs text-gray-400">
                Available only in Act Now zone (current: {obj.actionability_zone})
              </p>
            )}
          </div>
        ) : (
          <>
            <PackageDownload
              pkg={pkg}
              hypothesisStatement={obj.hypothesis.statement}
              searchQuery={obj.search_query ?? "unknown"}
            />
            <ComplianceReport
              credibilityReport={pkg.credibility_report}
              gapReport={pkg.gap_report}
            />
          </>
        )}

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Provenance Graph
          </h3>
          <ProvenanceTree nodes={provenanceNodes} />
        </div>
      </div>
    </div>
  );
}
