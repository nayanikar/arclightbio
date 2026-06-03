import { NextResponse } from "next/server";
import { fetchDashboardMetricRows } from "@/lib/db";
import { summarizeDashboardMetrics } from "@/lib/scoreMaintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await fetchDashboardMetricRows();
    return NextResponse.json({
      rows,
      metrics: summarizeDashboardMetrics(rows),
    });
  } catch (err) {
    console.error("[metrics]", err);
    return NextResponse.json(
      { error: "Failed to load dashboard metrics" },
      { status: 500 }
    );
  }
}
