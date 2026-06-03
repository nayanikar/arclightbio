import { listOpportunityObjects, updateOpportunityObject } from "@/lib/db";
import { generateSurveillanceTags } from "@/lib/surveillanceTags";

export async function regenerateAllSurveillanceTags(): Promise<{
  opportunitiesProcessed: number;
  tagsGenerated: number;
}> {
  const opportunities = await listOpportunityObjects();
  let tagsGenerated = 0;

  for (const opp of opportunities) {
    if (opp.status === "archived") continue;

    const tags = await generateSurveillanceTags(opp.hypothesis);
    await updateOpportunityObject(opp.id, {
      surveillance_tags: {
        ...tags,
        last_checked_at: opp.surveillance_tags.last_checked_at,
      },
    });

    if (tags.concept_tags.length > 0) tagsGenerated += 1;
  }

  return {
    opportunitiesProcessed: opportunities.filter((o) => o.status !== "archived")
      .length,
    tagsGenerated,
  };
}
