import type { OrganizationContext } from "@/types/OrganizationContext";

/** Prefer Pfizer when present — list order from DB is not reliable. */
export function pickDefaultOrgContext(
  contexts: OrganizationContext[]
): OrganizationContext | null {
  if (contexts.length === 0) return null;
  return (
    contexts.find((c) => /pfizer/i.test(c.org_name)) ?? contexts[0]
  );
}

export function formatOrgContextForPrompt(org: OrganizationContext): string {
  const { portfolio } = org;
  return `Organization: ${org.org_name}
Type: ${org.org_type.replace(/_/g, " ")}
Approved assets: ${portfolio.approved_assets.join(", ") || "none"}
Pipeline assets: ${portfolio.pipeline_assets.join(", ") || "none"}
Platforms: ${portfolio.platforms.join(", ") || "none"}
Therapeutic areas: ${portfolio.therapeutic_areas.join(", ")}
Discovery horizons: ${org.discovery_horizons.join(", ")}`;
}
