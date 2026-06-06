import { NextRequest, NextResponse } from "next/server";

/**
 * Optional admin gate. When ADMIN_API_KEY is unset, routes behave as before (open demo).
 * Set ADMIN_API_KEY in production to require `x-admin-api-key` or `Authorization: Bearer`.
 */
export function enforceAdminAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_API_KEY?.trim();
  if (!expected) return null;

  const headerKey = request.headers.get("x-admin-api-key")?.trim();
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const provided = headerKey ?? bearer;

  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
