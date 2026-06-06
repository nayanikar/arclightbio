# Arclight Bio — Agent Upgrade Specification
### Closing gaps for first-in-class therapeutic discovery
**Version:** 2.0 · June 2026
**Context:** Natasha's use cases exposed six structural gaps in the current agent architecture. This spec closes all six and adds two new agents. Give this entire file to Cursor before making any changes.

---

## Overview of gaps being closed

| Gap | Current state | After upgrade |
|---|---|---|
| Multi-domain literature search | Searches one domain per query | Searches 3-4 adjacent domains simultaneously, detects cross-citations |
| Target prioritization | Lists pathway associations | Ranks drug targets with rationale and druggability score |
| Modality recommendation | Not present | New 7th agent: recommends drug modality per target |
| De-risking steps | Identifies gaps only | Generates specific study design to close each gap |
| Sex-specific biology | Not aware | Domain context flag shapes hypothesis and agent priorities |
| First-in-class novelty check | Not present | Explicit absence search before declaring novel |

---

## Part 1 — Upgrade: Literature Agent

**File:** `/src/agents/literatureAgent.ts`

### What changes

The Literature Agent currently searches PubMed with the raw query string in a single domain. Natasha's use cases require reading two or more adjacent fields simultaneously and detecting where they co-cite the same mechanism. This is the highest-value upgrade — it is the capability that finds "the mechanism nobody has formally targeted."

### Implementation

**Step 1 — Domain expansion before search**

Before running any PubMed query, call Claude to expand the anchor into 3-4 adjacent search domains:

```typescript
const DOMAIN_EXPANSION_PROMPT = `
You are a biomedical domain mapper for a cross-domain discovery system.

Given this research anchor: "${anchor}"
And this domain context flag: "${domainContext}" 
// e.g. "sex-specific biology", "oncology first-in-class", "autoimmune chronic"

Generate 3-4 adjacent scientific domains that are rarely read 
simultaneously with the primary domain but may contain mechanistic 
insights directly relevant to the anchor.

For each domain generate:
1. A specific PubMed search query (MeSH terms preferred)
2. Why this domain is mechanistically adjacent
3. What type of cross-domain signal to look for

Examples of good cross-domain pairs:
- Lupus + menstrual cycle biology → hormonal immune modulation
- Cancer resistance + innate immunity + microbiome → TLR pathway
- ATTR cardiomyopathy + skeletal muscle biology → TTR in non-cardiac tissue
- ALS + gut-brain axis + neuroinflammation → systemic mechanism

Return as JSON array:
[{
  domain: string,
  pubmed_query: string,
  adjacency_rationale: string,
  signal_type: "mechanism_overlap" | "pathway_shared" | "biomarker_shared" | "population_overlap"
}]

Maximum 4 domains. Quality over quantity.
`
```

**Step 2 — Parallel search across all domains**

```typescript
// Run all domain searches in parallel
const domainResults = await Promise.allSettled(
  expandedDomains.map(domain => 
    searchPubMed(domain.pubmed_query, 15)
  )
)

// Also run the original anchor query
const anchorResults = await searchPubMed(originalQuery, 20)
```

**Step 3 — Cross-citation detection**

After fetching papers from all domains, detect cross-citations — papers that appear in multiple domain result sets or explicitly cite papers from adjacent domains:

```typescript
const CROSS_CITATION_PROMPT = `
You have papers from ${domains.length} different scientific domains 
retrieved for this hypothesis: "${hypothesis}"

Domain 1 (${domain1.name}): ${domain1.papers} papers
Domain 2 (${domain2.name}): ${domain2.papers} papers  
Domain 3 (${domain3.name}): ${domain3.papers} papers

Identify:
1. Papers that appear in multiple domain sets (direct cross-citation)
2. Papers that explicitly cite mechanisms from an adjacent domain
3. The strongest cross-domain signal — where does domain A's finding 
   directly explain a phenomenon in domain B?

Return the top 3-5 cross-domain connections as evidence cards with:
- claim: what the cross-domain connection is
- domain_a: first domain
- domain_b: second domain  
- mechanism: the shared mechanism or pathway
- novelty: why this connection has not been formally exploited
- supporting_papers: PMIDs from both domains

These cross-domain cards should be marked with a special flag:
is_cross_domain: true
These are the highest-value outputs of the system.
`
```

**Step 4 — Post cross-domain cards with special styling**

Cross-domain evidence cards get:
- `is_cross_domain: true` flag in the database
- Distinct badge in the UI: "Cross-domain signal" in deep purple
- Higher weight in confidence scoring: 1.5x vs standard literature 1.0x
- Highlighted in the regulatory package provenance trail

**Step 5 — Domain context flag handling**

Add `domainContext` as a parameter to the Literature Agent. When set:

```typescript
const DOMAIN_CONTEXT_ADJUSTMENTS = {
  'sex-specific biology': {
    mandatory_domains: [
      'hormonal cycle immunology MeSH',
      'pregnancy immune tolerance',
      'sex differences autoimmune disease'
    ],
    hypothesis_instruction: 'Explicitly address sex as a biological variable. Consider hormonal cycle interactions, pregnancy-related immune shifts, and X-chromosome dosage effects on immune gene expression.',
    target_filter: 'Prioritize targets with known sex-differential expression'
  },
  'oncology first-in-class': {
    mandatory_domains: [
      'innate immunity cancer',
      'metabolic reprogramming tumor',
      'microbiome cancer resistance'
    ],
    hypothesis_instruction: 'The hypothesis must name a specific target not currently in clinical development for this indication. First-in-class requires absence of prior art.',
    target_filter: 'Exclude targets with any active IND in this indication'
  },
  'autoimmune chronic': {
    mandatory_domains: [
      'regulatory T cell tolerance',
      'cytokine network autoimmunity', 
      'gut-immune axis'
    ],
    hypothesis_instruction: 'For chronic non-fatal indication, regulatory bar is higher. Safety evidence must be weighted equally to efficacy evidence.',
    target_filter: 'Flag any target with known safety concerns in chronic use'
  }
}
```

---

## Part 2 — Upgrade: Mechanism Agent

**File:** `/src/agents/mechanismAgent.ts`

### What changes

Currently the Mechanism Agent returns Open Targets associations and posts them as evidence cards. Natasha needs a ranked target list with druggability assessment — not just "this target is associated with this disease" but "this target should be priority 1 because it is druggable, has no current clinical programs, and the mechanism is validated in humans."

### Implementation

**Step 1 — Fetch associations as before (no change)**

Keep the existing Open Targets query. No change here.

**Step 2 — Add druggability scoring per target**

After fetching associations, score each target across four druggability dimensions:

```typescript
const DRUGGABILITY_PROMPT = `
You are a drug discovery scientist evaluating targets for first-in-class 
therapeutic development.

For each target below, score druggability across four dimensions (0-1):

1. structural_druggability: Does this target have a well-defined binding 
   pocket? Has it been successfully drugged in any indication?
   1.0 = approved drug exists for this target in any indication
   0.7 = tool compound or preclinical drug validated binding
   0.4 = predicted druggable pocket, no validated compound
   0.1 = historically undruggable (transcription factor, PPI, etc.)

2. pathway_confidence: How well validated is this target's role in the 
   disease mechanism?
   1.0 = human genetic validation (GWAS hit, Mendelian disease gene)
   0.7 = validated in human tissue or patient samples
   0.4 = validated in animal models only
   0.1 = computational prediction only

3. clinical_novelty: Is this target being pursued in this indication?
   1.0 = no IND filed, no patent in this indication
   0.7 = patents exist but no clinical program
   0.4 = Phase 1 only, mechanism not validated clinically
   0.0 = active Phase 2/3 or approved — not first-in-class

4. safety_precedent: What is the safety track record of modulating 
   this target?
   1.0 = target modulated safely in approved drug (any indication)
   0.7 = preclinical safety profile acceptable
   0.4 = known on-target toxicity risks, manageable
   0.1 = known serious safety concern (e.g. essential gene)

Targets: ${targets_json}
Indication context: ${indication}
Domain context: ${domainContext}

Return ranked list, highest druggability_composite first:
[{
  target_name: string,
  gene_symbol: string,
  structural_druggability: float,
  pathway_confidence: float,
  clinical_novelty: float,
  safety_precedent: float,
  druggability_composite: float, // weighted average
  priority_rank: integer,
  rationale: string, // 2 sentences explaining the rank
  recommended_modality: string, // see Modality Agent below
  key_risk: string // one sentence on biggest development risk
}]
`
```

**Step 3 — Post ranked target list as a special card**

```typescript
// Post the full ranked list as a single card
const targetListCard = {
  contributing_agent: 'mechanism',
  content: formatTargetList(rankedTargets),
  is_target_list: true, // new flag
  quality_scores: { composite: topTarget.druggability_composite }
}
```

**Step 4 — Display in UI**

Add a "Prioritized targets" panel to the Opportunity Object detail page, below the hypothesis and above the evidence stream. Shows the ranked list with colored druggability bars. Clicking a target expands to show all four dimension scores and the key risk.

---

## Part 3 — New Agent: Modality Agent (7th agent)

**File:** `/src/agents/modalityAgent.ts` (new file)

### What it does

Reads the top-ranked targets from the Mechanism Agent and recommends the right drug modality for each. This directly addresses Natasha's "manufacturing/infrastructure feasibility based modality recommendation."

### Implementation

```typescript
export async function modalityAgent(opportunityObject: OpportunityObject): Promise<void> {

  // Read ranked targets posted by Mechanism Agent
  const targetListCard = opportunityObject.evidence_cards.find(
    c => c.is_target_list && c.contributing_agent === 'mechanism'
  )
  if (!targetListCard) return // wait for Mechanism Agent

  const MODALITY_PROMPT = `
You are a drug modality expert advising on first-in-class therapeutic 
development. For each prioritized target below, recommend the optimal 
drug modality and assess manufacturing/infrastructure feasibility.

Targets: ${targetListCard.content}
Indication: ${opportunityObject.hypothesis.patient_population}
Org context: ${orgContext.platforms} // e.g. ["ADC manufacturing", "small molecule", "mRNA"]

For each target, evaluate these modalities:
- Small molecule (oral, broad access, established manufacturing)
- Biologic / monoclonal antibody (IV/SC, high specificity, complex manufacturing)
- ADC (antibody-drug conjugate, tumor targeting, specialized linker chemistry)
- RNA therapy (ASO, siRNA, mRNA — tissue delivery is key challenge)
- Cell therapy (CAR-T, TIL — autologous vs allogeneic manufacturing)
- Gene therapy (AAV, lentiviral — one-time dosing, high manufacturing complexity)
- Protein degrader (PROTAC, molecular glue — emerging, oral possible)

Score each modality for this target across:
1. target_compatibility: Is this modality technically feasible for this target class?
2. indication_fit: Is this modality appropriate for this patient population and disease?
3. org_fit: Does the org's existing platform support this modality?
4. manufacturing_complexity: 1=simple, 5=highly complex (affects cost and timeline)
5. regulatory_precedent: Has FDA approved this modality in adjacent indications?

Return:
[{
  target: string,
  recommended_modality: string,
  modality_rationale: string,
  manufacturing_complexity: 1-5,
  estimated_timeline_to_IND: string, // e.g. "3-4 years"
  org_fit_score: float,
  key_infrastructure_requirement: string,
  alternative_modality: string,
  alternative_rationale: string
}]
`

  const modalityAssessment = await callClaude(MODALITY_PROMPT)
  
  // Post as evidence card
  await postEvidenceCard(opportunityObject.id, {
    contributing_agent: 'modality',
    content: formatModalityAssessment(modalityAssessment),
    source_type: 'internal_reasoning',
    quality_scores: { composite: 0.75 }, // expert reasoning, no external source
    is_modality_card: true
  })
}
```

**Add 'modality' to TypeScript types:**

```typescript
// In /src/types/OpportunityObject.ts
export type AgentName = 
  'literature' | 'mechanism' | 'clinical_trial' | 
  'commercial' | 'regulatory' | 'rwe_signal' | 'modality' // new
```

**Add to blackboard orchestration:**

```typescript
// In /src/lib/blackboard.ts
await Promise.allSettled([
  literatureAgent(obj),
  mechanismAgent(obj),
  clinicalTrialAgent(obj),
  commercialAgent(obj),
  regulatoryAgent(obj),
  rweSignalAgent(obj),
  modalityAgent(obj), // new — runs after mechanism agent posts targets
])
```

**UI — agent pip color for modality:**
```
modality → #8B5CF6 (violet — distinct from existing agents)
```

---

## Part 4 — Upgrade: Regulatory Agent

**File:** `/src/agents/regulatoryAgent.ts`

### What changes

Currently identifies gaps but doesn't prescribe solutions. Natasha needs "essential de-risking steps and clinical biomarkers of efficacy and toxicity" — specific study designs to close each gap.

### Implementation

**Add de-risking step generation after each challenge card:**

```typescript
const DERISK_PROMPT = `
You are a regulatory strategy expert. A gap has been identified in 
the evidence for this hypothesis:

Hypothesis: ${hypothesis.statement}
Gap: ${challenge.content}
Indication type: ${domainContext} // oncology vs autoimmune chronic vs rare disease

Generate a specific de-risking study recommendation:

{
  study_type: string, // e.g. "Retrospective cohort", "Prospective biomarker study", "IIT Phase 1b"
  primary_objective: string,
  patient_population: string, // specific inclusion criteria
  n_required: integer, // minimum sample size for meaningful signal
  primary_endpoint: string,
  biomarkers_of_efficacy: string[], // specific measurable markers
  biomarkers_of_safety: string[], // toxicity monitoring markers
  estimated_timeline: string, // e.g. "12-18 months"
  estimated_cost_range: string, // e.g. "$500K-$2M"
  closes_gap: string // which specific regulatory concern this addresses
}
`
```

**Indication-specific risk calibration:**

```typescript
const INDICATION_RISK_WEIGHTS = {
  'oncology': {
    // FDA accepts higher toxicity for life-threatening disease
    safety_weight: 0.3,
    efficacy_weight: 0.7,
    minimum_confidence_for_act_now: 0.35
  },
  'autoimmune_chronic': {
    // Chronic non-fatal: safety evidence weighted equally to efficacy
    safety_weight: 0.5,
    efficacy_weight: 0.5,
    minimum_confidence_for_act_now: 0.50 // higher bar
  },
  'rare_disease': {
    // FDA allows lower evidence bar; accelerated approval pathways
    safety_weight: 0.4,
    efficacy_weight: 0.6,
    minimum_confidence_for_act_now: 0.28 // lower bar
  }
}

// Read indication type from domainContext and adjust scoring
const riskWeights = INDICATION_RISK_WEIGHTS[indicationType] 
  ?? INDICATION_RISK_WEIGHTS['oncology']
```

---

## Part 5 — New capability: First-in-class novelty check

**File:** `/src/agents/clinicalTrialAgent.ts` (add to existing)

### What it does

Explicitly searches for the absence of prior art before the system can declare a hypothesis as first-in-class. This is critical for Natasha's use cases — "first-in-class" is a regulatory and commercial claim that must be verified, not assumed.

### Implementation

Add as a second pass within the Clinical Trial Agent, after the standard trial search:

```typescript
async function firstInClassNoveltyCheck(
  hypothesis: Hypothesis,
  topTargets: Target[]
): Promise<NoveltyCheckResult> {

  const checks = await Promise.allSettled([
    
    // Check 1: FDA approved drugs for this target-indication pair
    searchFDAApprovals(topTargets, hypothesis.patient_population),
    
    // Check 2: Active INDs (Phase 1-3 trials) for this mechanism
    searchClinicalTrials(
      `${topTargets[0].gene_symbol} ${hypothesis.patient_population}`,
      { status: ['RECRUITING', 'ACTIVE', 'NOT_YET_RECRUITING'] }
    ),
    
    // Check 3: Patents filed in last 5 years on this target-indication
    searchPatents(
      `${topTargets[0].target_name} ${hypothesis.patient_population}`,
      { years: 5 }
    ),
    
    // Check 4: Recent acquisitions/deals for this mechanism
    // (OpenFDA + manual check)
    searchCommercialActivity(topTargets[0].target_name)
  ])

  const noveltyVerdict = await callClaude(`
    Based on these search results, assess first-in-class status 
    for target ${topTargets[0].target_name} in indication 
    ${hypothesis.patient_population}:
    
    FDA approvals found: ${fdaResults}
    Active trials found: ${trialResults}  
    Patents found: ${patentResults}
    Commercial activity: ${dealResults}
    
    Return:
    {
      is_first_in_class: boolean,
      confidence: float, // how confident in this assessment
      verdict: "confirmed" | "likely" | "uncertain" | "not_first_in_class",
      prior_art_found: string[], // what exists
      differentiation_angle: string, // if not fully novel, where is the white space
      novelty_statement: string // one sentence suitable for regulatory submission
    }
  `)

  return noveltyVerdict
}
```

**Post as a special novelty card:**

```typescript
const noveltyCard = {
  contributing_agent: 'clinical_trial',
  is_novelty_check: true,
  content: formatNoveltyVerdict(noveltyVerdict),
  // Special UI treatment: 
  // "First-in-class: CONFIRMED" in teal
  // "First-in-class: UNCERTAIN" in amber
  // "NOT first-in-class" in coral
}
```

---

## Part 6 — Add domain context flag to Discover page

**File:** `/src/app/discover/page.tsx`

Add a domain context selector below the search input, before the user clicks Discover:

```tsx
const DOMAIN_CONTEXTS = [
  { value: 'general', label: 'General discovery', description: 'Standard agent configuration' },
  { value: 'oncology first-in-class', label: 'Oncology — first-in-class', description: 'Cross-domain search, target ranking, novelty check, modality recommendation' },
  { value: 'autoimmune chronic', label: 'Autoimmune / chronic disease', description: 'Higher safety bar, sex-specific biology flag, de-risking steps' },
  { value: 'sex-specific biology', label: "Women's health", description: 'Immunology × reproductive health cross-domain, hormonal mechanism search' },
  { value: 'rare disease', label: 'Rare disease', description: 'Lower evidence bar, orphan drug pathway assessment, smaller population sizing' },
]

// Show as pill selector below search input
// Selected context is passed to all agents as domainContext parameter
// Also shown as a badge on the Opportunity Object
```

Store `domain_context` on the opportunity_object:

```sql
ALTER TABLE opportunity_objects 
ADD COLUMN IF NOT EXISTS domain_context text DEFAULT 'general';
```

---

## Part 7 — UI changes for new agent outputs

### Opportunity Object detail page

**New panel: Prioritized targets** (between hypothesis and evidence stream)

Only shows when Mechanism Agent has posted a target list card (`is_target_list: true`).

```
PRIORITIZED TARGETS
─────────────────────────────────────────────────────
#1  PTPN22     Druggability: ████████░░ 0.82   First-in-class: Confirmed
    Structural: ██████░░░░  Pathway: █████████░  Novel: ██████████  Safety: ████████░░
    Rationale: PTPN22 R620W variant is the strongest GWAS hit for lupus with no approved
    therapeutic. Tool compounds validated in mouse models. Recommended modality: small molecule.
    Key risk: selectivity over related phosphatases.

#2  IRF5       Druggability: ████████░░ 0.71   First-in-class: Likely
    ...
─────────────────────────────────────────────────────
```

**New panel: Modality assessment** (in right sidebar, below surveillance tags)

Shows recommended modality per top target:

```
MODALITY RECOMMENDATION
─────────────────────────
PTPN22 → Small molecule
Timeline to IND: 3-4 years
Manufacturing complexity: ●●○○○ (2/5)
Org fit: High (existing small molecule platform)
Key infrastructure: Standard medicinal chemistry
```

**Updated evidence stream — new card types:**

Cross-domain cards: purple left border + "Cross-domain signal" badge
Novelty check card: teal if confirmed, amber if uncertain, coral if not first-in-class
Modality card: violet badge matching agent pip color

---

## Part 8 — Testing use cases

Run these after all upgrades are deployed. Each is designed to exercise specific new capabilities.

---

### Test A — Natasha Use Case 1: First-in-class oncology

```
Org: Pfizer (Demo)
Domain context: Oncology — first-in-class
Query: toll-like receptor innate immunity solid tumor checkpoint resistance
```

**Expected behavior:**

Literature Agent should search: (1) TLR biology, (2) tumor microenvironment, (3) microbiome-cancer interaction, (4) innate-adaptive immune crosstalk — four domains simultaneously.

Cross-domain signal expected: TLR4 signaling in gut microbiome papers co-cited with checkpoint resistance papers in NSCLC. This connection exists in the literature but has not been formally exploited as a drug target.

Mechanism Agent should rank targets: TLR4, TLR9, STING pathway — with druggability scores. TLR9 agonists have Phase 1 data in oncology (not first-in-class) — Novelty check should flag this. STING agonists have more open space — should confirm as higher novelty.

Modality Agent should recommend: small molecule STING agonist or TLR4 antagonist depending on target rank.

Regulatory Agent de-risking step: "Conduct a retrospective biomarker study in existing checkpoint-treated cohort, measuring TLR4 expression vs response rate, N≥100, primary endpoint: correlation between TLR4 activation signature and PD-1 responder status."

**What to verify:**
- [ ] Cross-domain signal cards appear with purple left border
- [ ] Target list card appears above evidence stream
- [ ] Novelty check card shows "TLR9: Not first-in-class" and "STING: Likely first-in-class"
- [ ] Modality card appears in right sidebar
- [ ] De-risking step appears in regulatory gap report
- [ ] Confidence score reflects oncology risk weights (lower bar for Act Now)

---

### Test B — Natasha Use Case 2: Women's autoimmune, first-in-class

```
Org: Horizon Ventures (Demo)
Domain context: Women's health
Query: estrogen receptor autoimmune lupus flare mechanism
```

**Expected behavior:**

Literature Agent should search: (1) lupus flare mechanism, (2) estrogen receptor immunology, (3) menstrual cycle immune shifts, (4) pregnancy-related immune tolerance — four domains simultaneously. This is the "almost never read simultaneously" cross-domain Natasha described.

Cross-domain signal expected: estrogen-driven expansion of specific B cell subsets during follicular phase co-cited with lupus flare timing papers. This connection is in the literature but no drug formally targets this mechanism.

Mechanism Agent should rank: ESR1 (estrogen receptor alpha), FOXP3 (Treg differentiation), IRF5 (lupus GWAS hit) — with sex-specific pathway confidence scores.

Novelty check: ESR1 as a lupus target has no approved therapy and no active IND — should confirm first-in-class.

Modality Agent: selective estrogen receptor modulator (SERM) or small molecule FOXP3 stabilizer — with note on sex-specific safety monitoring requirements.

Regulatory Agent: autoimmune chronic weights apply. Safety evidence weighted equally to efficacy. De-risking step: "Prospective longitudinal study tracking immune biomarkers (CD19+CD10+ B cells, FOXP3+ Tregs) across menstrual cycles in lupus patients vs controls, N≥50, 6-month follow-up."

**What to verify:**
- [ ] Four domain searches run (check agent trace log)
- [ ] Cross-domain signal card appears: estrogen cycle × lupus flare mechanism
- [ ] Hypothesis explicitly mentions sex as biological variable
- [ ] Target list shows sex-specific pathway confidence scores
- [ ] Novelty check confirms ESR1 in lupus as first-in-class
- [ ] Regulatory scoring uses autoimmune_chronic weights (higher bar for Act Now)
- [ ] De-risking step includes sex-specific biomarker monitoring
- [ ] Commercial Agent notes large market: "80M+ women with autoimmune disease in US+EU"
- [ ] Confidence score: expect 0.35-0.50 (Act Now) not Too Early — real signal exists

---

### Test C — Validation: confirm existing zones still work

Run after A and B to confirm upgrades didn't break existing calibration:

```
Org: Pfizer (Demo)
Domain context: General discovery
Query: pembrolizumab PD-L1 NSCLC first line
```

Should still hit Crowded (>0.75). If it doesn't, the domain context upgrade broke the prior scoring.

```
Org: Horizon Ventures (Demo)
Domain context: General discovery  
Query: exosome microRNA ALS early diagnosis
```

Should still hit Too Early (<0.30). Regression check.

---

### Test D — Modality agent standalone test

```
Org: Pfizer (Demo)
Domain context: Oncology — first-in-class
Query: KRAS G12C colorectal cancer acquired resistance mechanism
```

KRAS G12C inhibitors are approved in NSCLC (sotorasib, adagrasib) but resistance is emerging. In colorectal cancer, KRAS G12C inhibitors have shown limited efficacy due to feedback reactivation.

**Expected:** Mechanism Agent should rank combination approaches. Modality Agent should recommend: KRAS G12C inhibitor + SOS1 inhibitor combination (small molecule, both components exist) OR KRAS-targeted PROTAC (degrader). Novelty check should confirm KRAS PROTAC in CRC as first-in-class. De-risking step should recommend ex vivo patient-derived organoid study.

---

## Part 9 — Database migrations

Run these in Supabase SQL editor before deploying:

```sql
-- Domain context on opportunities
ALTER TABLE opportunity_objects 
ADD COLUMN IF NOT EXISTS domain_context text DEFAULT 'general';

-- Cross-domain flag on evidence cards
ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS is_cross_domain boolean DEFAULT false;

-- Target list flag
ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS is_target_list boolean DEFAULT false;

-- Modality card flag
ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS is_modality_card boolean DEFAULT false;

-- Novelty check flag
ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS is_novelty_check boolean DEFAULT false;

-- De-risking steps (stored per challenge card)
ALTER TABLE evidence_cards
ADD COLUMN IF NOT EXISTS derisk_recommendation jsonb;

-- Indication type for regulatory calibration
ALTER TABLE opportunity_objects
ADD COLUMN IF NOT EXISTS indication_type text DEFAULT 'oncology';
```

---

## Part 10 — Cursor build order

Run these prompts in order. Each one depends on the previous.

**Prompt 1:** Add domain_context column to Supabase and domain context selector UI to Discover page. Wire selected context to opportunity_objects on creation.

**Prompt 2:** Upgrade Literature Agent with domain expansion — the Claude call that generates 3-4 adjacent search domains from the anchor + domain context. Add parallel PubMed search across all domains.

**Prompt 3:** Add cross-citation detection to Literature Agent. The Claude call that identifies cross-domain co-citations and posts them as special evidence cards with is_cross_domain flag.

**Prompt 4:** Upgrade Mechanism Agent with druggability scoring and ranked target list output. Post the ranked list as a target_list card.

**Prompt 5:** Create the new Modality Agent. Wire it into the blackboard after the Mechanism Agent. Add the modality panel to the right sidebar in the UI.

**Prompt 6:** Add first-in-class novelty check to Clinical Trial Agent. The absence search across FDA approvals, active trials, and patents.

**Prompt 7:** Add de-risking step generation to Regulatory Agent. Generate specific study design recommendations after each challenge card. Add indication-specific risk calibration.

**Prompt 8:** Add Prioritized Targets panel to the Opportunity Object detail page UI. Show ranked targets with druggability bars above the evidence stream.

**Prompt 9:** Add cross-domain card styling to evidence stream. Purple left border, "Cross-domain signal" badge, 1.5x weight in confidence scoring.

**Prompt 10:** Run all four test cases (A, B, C, D) and share results.

---

## Summary

When all upgrades are deployed, Arclight Bio can service both of Natasha's use cases end-to-end:

**Use case 1 (oncology first-in-class):** Anchor on unmet need → cross-domain literature scan finds mechanisms outside oncology → falsifiable first-in-class hypothesis with ranked targets and druggability scores → regulatory risk with specific de-risking study designs and efficacy/toxicity biomarkers → modality recommendation with manufacturing feasibility.

**Use case 2 (women's autoimmune):** Immunology × women's health simultaneous read → cross-domain signal identifying untargeted hormonal-immune mechanism → first-in-class novelty confirmed → high regulatory bar met (autoimmune chronic weights) → large commercial market validated.

The system goes from finding opportunities to generating first-in-class drug discovery programs.

---

*Arclight Bio — Agent Upgrade Specification v2.0*
*Tracks: 02 Autonomous Research + 05 Regulatory*
*June 2026*
