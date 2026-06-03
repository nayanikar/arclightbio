import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

function readObservatoryUrl(): string | null {
  const envUrl = process.env.SPACEBASE_OBSERVATORY_URL?.trim();
  if (envUrl) return envUrl;

  const workspace = path.resolve(
    process.cwd(),
    process.env.SPACEBASE_WORKSPACE ?? ".spacebase/arclightbio"
  );
  const metaPath = path.join(workspace, "observatory.json");
  if (!fs.existsSync(metaPath)) return null;

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as {
      observatory_url?: string;
    };
    return meta.observatory_url ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const url = readObservatoryUrl();
  if (!url) {
    return NextResponse.json({ url: null }, { status: 404 });
  }
  return NextResponse.json({ url });
}
