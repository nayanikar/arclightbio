import type { UndruggableTargetRecord } from "@/types/V3Pipeline";

export type UndruggableScopeFilter = "all" | "global" | "session" | "rescan";

export interface UndruggableRegistryStats {
  total: number;
  uniqueTargets: number;
  globalCount: number;
  sessionCount: number;
  rescanEligible: number;
}

export interface UndruggableTargetGroup {
  targetName: string;
  entries: UndruggableTargetRecord[];
}

export function computeUndruggableStats(
  records: UndruggableTargetRecord[]
): UndruggableRegistryStats {
  const names = new Set(records.map((r) => r.target_name.toLowerCase().trim()));
  return {
    total: records.length,
    uniqueTargets: names.size,
    globalCount: records.filter((r) => !r.opportunity_object_id).length,
    sessionCount: records.filter((r) => Boolean(r.opportunity_object_id)).length,
    rescanEligible: records.filter((r) => r.rescan_eligible !== false).length,
  };
}

export function filterUndruggableRecords(
  records: UndruggableTargetRecord[],
  query: string,
  scope: UndruggableScopeFilter
): UndruggableTargetRecord[] {
  const q = query.trim().toLowerCase();
  return records.filter((r) => {
    if (scope === "global" && r.opportunity_object_id) return false;
    if (scope === "session" && !r.opportunity_object_id) return false;
    if (scope === "rescan" && r.rescan_eligible === false) return false;
    if (!q) return true;
    const haystack = [
      r.target_name,
      r.reasoning,
      r.intervention_point,
      r.alternate_intervention,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function groupUndruggableByTarget(
  records: UndruggableTargetRecord[]
): UndruggableTargetGroup[] {
  const map = new Map<string, UndruggableTargetRecord[]>();

  for (const record of records) {
    const key = record.target_name.trim();
    const list = map.get(key) ?? [];
    list.push(record);
    map.set(key, list);
  }

  return Array.from(map.entries())
    .map(([targetName, entries]) => ({
      targetName,
      entries: entries.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    }))
    .sort((a, b) => a.targetName.localeCompare(b.targetName));
}

export function formatModalitySummary(interventionPoint?: string | null): string {
  if (!interventionPoint?.trim()) return "All modality classes screened";
  return interventionPoint
    .split(",")
    .map((s) => s.trim().replace(/_/g, " "))
    .filter(Boolean)
    .join(" · ");
}
