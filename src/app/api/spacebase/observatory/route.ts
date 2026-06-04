import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

function workspacePath(): string {
  return path.resolve(
    process.cwd(),
    process.env.SPACEBASE_WORKSPACE ?? ".spacebase/arclightbio"
  );
}

function readObservatoryMeta(): { observatory_url?: string } | null {
  const metaPath = path.join(workspacePath(), "observatory.json");
  if (!fs.existsSync(metaPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as {
      observatory_url?: string;
    };
  } catch {
    return null;
  }
}

function readEnrollmentObservatoryUrl(): string | null {
  const enrollmentPath = path.join(
    workspacePath(),
    ".intent-space",
    "state",
    "station-enrollment.json"
  );
  if (!fs.existsSync(enrollmentPath)) return null;

  try {
    const enrollment = JSON.parse(
      fs.readFileSync(enrollmentPath, "utf-8")
    ) as { observatory_url?: string };
    return enrollment.observatory_url ?? null;
  } catch {
    return null;
  }
}

function readObservatoryUrl(): string | null {
  // Prefer claim output files — .env cannot store URL hash fragments (# is a comment).
  const fromMeta = readObservatoryMeta()?.observatory_url;
  if (fromMeta?.includes("space=")) return fromMeta;

  const fromEnrollment = readEnrollmentObservatoryUrl();
  if (fromEnrollment?.includes("space=")) return fromEnrollment;

  const envUrl = process.env.SPACEBASE_OBSERVATORY_URL?.trim();
  if (envUrl?.includes("space=")) return envUrl;

  return fromMeta ?? fromEnrollment ?? envUrl ?? null;
}

export async function GET() {
  const url = readObservatoryUrl();
  if (!url) {
    return NextResponse.json({ url: null }, { status: 404 });
  }
  return NextResponse.json({ url });
}
