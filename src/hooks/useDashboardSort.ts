"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardSortKey } from "@/lib/dashboardDisplay";

const STORAGE_KEY = "arclight_dashboard_sort";

function readStoredSort(): DashboardSortKey {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored === "confidence" || stored === "recency" || stored === "phase") {
    return stored;
  }
  return "confidence";
}

export function useDashboardSort() {
  const [sortKey, setSortKeyState] = useState<DashboardSortKey>("confidence");

  useEffect(() => {
    setSortKeyState(readStoredSort());
  }, []);

  const setSortKey = useCallback((key: DashboardSortKey) => {
    setSortKeyState(key);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, key);
    }
  }, []);

  return { sortKey, setSortKey };
}
