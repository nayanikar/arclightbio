"use client";

import { useCallback } from "react";

export function useSurveillance() {
  const triggerScan = useCallback(async () => {
    const res = await fetch("/api/surveillance", { method: "POST" });
    return res.json();
  }, []);

  return { triggerScan };
}
