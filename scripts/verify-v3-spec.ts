/**
 * Static V3 spec compliance checks (no live server required).
 * Run: npx tsx scripts/verify-v3-spec.ts
 */
import { readFileSync, existsSync } from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

const checks: Check[] = [];

function check(name: string, pass: boolean, detail?: string) {
  checks.push({ name, pass, detail });
}

function fileExists(rel: string): boolean {
  return existsSync(path.join(ROOT, rel));
}

function fileContains(rel: string, needle: string): boolean {
  if (!fileExists(rel)) return false;
  return readFileSync(path.join(ROOT, rel), "utf-8").includes(needle);
}

// Phase 1 agents
const phase1Agents = [
  "patientPopulationAgent",
  "anchorPopulationAgent",
  "marketSizeAgent",
  "cd1PatternAgent",
  "cd2AssociationAgent",
  "expertDomainMergerAgent",
  "biologyRecurrenceScorerAgent",
  "crossDomainAssociationFilterAgent",
  "crossDomainLiteratureAgent",
  "crossContextHypothesisMinerAgent",
  "associationHypothesisGeneratorAgent",
  "causationFilterAgent",
  "selectivityFilterAgent",
  "selectivityRankerAgent",
  "selectivityTargetRankerAgent",
  "targetFamilyContextAgent",
  "falsificationExperimentDesignerAgent",
];

for (const agent of phase1Agents) {
  check(`Phase 1 agent: ${agent}`, fileContains("src/lib/blackboardRunV3.ts", agent));
}

// Phase 2 agents
const phase2Agents = [
  "existingDrugCheckerAgent",
  "ipOwnershipAgent",
  "ftoAnalysisAgent",
  "drugRedesignFeasibilityAgent",
  "adcPathAgent",
  "druggabilityAssessmentAgent",
  "modalitySelectorAgent",
  "tppGeneratorAgent",
  "indPackageAssemblerAgent",
  "undruggableTargetRegistryAgent",
  "targetSelectionGuardAgent",
  "riskOfFailureAggregatorAgent",
];

for (const agent of phase2Agents) {
  check(`Phase 2 agent: ${agent}`, fileContains("src/lib/blackboardRunV3.ts", agent));
}

// Schema
check("Migration 016 cohorts", fileExists("supabase/migrations/016_v3_pipeline.sql"));
check("Migration 017 V3 fields", fileExists("supabase/migrations/017_v3_opportunity_fields.sql"));
check(
  "population_definition column",
  fileContains("supabase/migrations/017_v3_opportunity_fields.sql", "population_definition")
);

// Hydration
check(
  "V3 hydration on GET",
  fileContains("src/lib/db.ts", "hydrateV3OpportunityObject")
);

// Biology filter
check(
  "Biology 30-50% filter",
  fileContains("src/agents/phase1/biologyRecurrenceScorerAgent.ts", "inRecurrenceBand")
);

// Funnel counts
check(
  "Funnel count normalization",
  fileContains("src/lib/v3Db.ts", "normalizeFunnelRecords")
);

// Undruggable guard
check(
  "Global undruggable guard in ranker",
  fileContains("src/agents/phase1/selectivityTargetRankerAgent.ts", "listGlobalUndruggableTargets")
);

// UI biomarkers
check(
  "TPP surrogate biomarkers",
  fileContains("src/components/opportunity/TppBlueprintPanel.tsx", "Surrogate")
);
check(
  "Risk other dimension",
  fileContains("src/components/opportunity/RiskOfFailurePanel.tsx", '"other"')
);
check(
  "IND CDP biomarkers",
  fileContains("src/components/opportunity/IndPackagePanel.tsx", "BiomarkerGroup")
);

// Workflows
check("Add data API", fileExists("src/app/api/opportunity/[id]/add-data/route.ts"));
check("Revise query API", fileExists("src/app/api/opportunity/[id]/revise/route.ts"));
check(
  "Add data UI wired",
  fileContains("src/components/opportunity/V3TopBarActions.tsx", "/add-data")
);
check(
  "Revise discover param",
  fileContains("src/app/discover/page.tsx", "reviseId")
);

// V3 page routing
check(
  "OpportunityPageV3",
  fileContains("src/app/opportunity/[id]/page.tsx", "OpportunityPageV3")
);

const failed = checks.filter((c) => !c.pass);
const passed = checks.filter((c) => c.pass);

console.log(`\nV3 spec verification: ${passed.length}/${checks.length} passed\n`);
for (const c of checks) {
  console.log(`${c.pass ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}

if (failed.length > 0) {
  console.log(`\n${failed.length} check(s) failed.\n`);
  process.exit(1);
}

console.log("\nAll static spec checks passed.\n");
