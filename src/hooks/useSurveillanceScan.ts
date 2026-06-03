"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SURVEILLANCE_POLL_INTERVAL_MS } from "@/config/surveillance";
import { useOpportunityStore } from "@/store/opportunityStore";
import type { SurveillanceScanResult } from "@/lib/surveillance";
import type {
  SurveillanceScanSummary,
  SurveillanceStep,
} from "@/types/surveillanceProgress";

export function useSurveillanceScan(
  opportunityId: string,
  enabled: boolean,
  paused: boolean
) {
  const applySurveillanceResult = useOpportunityStore(
    (s) => s.applySurveillanceResult
  );
  const scanningRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [steps, setSteps] = useState<SurveillanceStep[]>([]);
  const [summary, setSummary] = useState<SurveillanceScanSummary | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [countdown, setCountdown] = useState(
    Math.floor(SURVEILLANCE_POLL_INTERVAL_MS / 1000)
  );

  const closeStream = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  const runScan = useCallback(() => {
    if (scanningRef.current || paused || !enabled) return;

    scanningRef.current = true;
    setIsScanning(true);
    setSteps([]);
    setSummary(null);
    closeStream();

    const es = new EventSource(`/api/surveillance/${opportunityId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("step", (event) => {
      const step = JSON.parse(event.data) as SurveillanceStep;
      setSteps((prev) => {
        if (prev.some((s) => s.id === step.id)) return prev;
        return [...prev, step];
      });
    });

    es.addEventListener("summary", (event) => {
      setSummary(JSON.parse(event.data) as SurveillanceScanSummary);
    });

    es.addEventListener("complete", (event) => {
      const result = JSON.parse(event.data) as SurveillanceScanResult;
      applySurveillanceResult(result);
      setIsScanning(false);
      scanningRef.current = false;
      setCountdown(Math.floor(SURVEILLANCE_POLL_INTERVAL_MS / 1000));
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener("error", () => {
      setIsScanning(false);
      scanningRef.current = false;
      es.close();
      eventSourceRef.current = null;
    });
  }, [
    applySurveillanceResult,
    closeStream,
    enabled,
    opportunityId,
    paused,
  ]);

  useEffect(() => {
    if (!enabled || paused) {
      closeStream();
      setIsScanning(false);
      scanningRef.current = false;
      return;
    }

    runScan();
    const poll = window.setInterval(runScan, SURVEILLANCE_POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(poll);
      closeStream();
    };
  }, [enabled, paused, runScan, closeStream]);

  useEffect(() => {
    if (!enabled || paused || isScanning) return;

    const tick = window.setInterval(() => {
      setCountdown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);

    return () => window.clearInterval(tick);
  }, [enabled, paused, isScanning]);

  return { steps, summary, isScanning, countdown, runScan };
}
