import { DEFAULT_ORG_CONTEXTS, getOrgContext } from "@/lib/db";
import { logBlackboardSeriousError } from "@/lib/blackboardRun";
import type { OrganizationContext } from "@/types/OrganizationContext";

export async function resolveOrgContext(
  orgContextId: string
): Promise<OrganizationContext | null> {
  const org = await getOrgContext(orgContextId);
  if (org) return org;

  const fallback =
    DEFAULT_ORG_CONTEXTS.find((o) => o.id === orgContextId) ??
    DEFAULT_ORG_CONTEXTS[0];
  await logBlackboardSeriousError(
    orgContextId,
    "refreshScores",
    new Error(`Org context ${orgContextId} not found — using demo fallback ${fallback.org_name}`),
    1
  );
  return fallback;
}
