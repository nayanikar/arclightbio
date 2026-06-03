# Arclight Bio — Opportunity Space
### Living Discovery Engine for the Life Sciences
**Nucleate NY BioHack · NextGen BioAgents · June 2026**
**Track 02 — Autonomous Research · Track 05 — Regulatory**
**Built by Arclight Bio**

---

## 0. Branding

- **Company name:** Arclight Bio
- **Platform name:** Opportunity Space by Arclight Bio
- **Tagline:** *The discovery engine that finds what your experts don't know to look for*
- All UI headers, nav bars, loading screens, and email templates use "Arclight Bio"
- Logo placeholder: wordmark "Arclight Bio" in Inter 600, with a small arc/light motif TBD by designer

---

## 1. What We Are Building

Opportunity Space is a scientific discovery platform powered by autonomous agents that work together on a shared living artifact — the **Opportunity Object**. It finds cross-domain opportunities that expert-gated processes are structurally unable to find.

**This is a fully working site with live API calls. No pre-filled data. No cached demo JSON. Every discovery session runs real queries against real public data sources.**

It operates across three stages:

1. **Autonomous anchor generation** — agents detect novel cross-domain signals without any human prompt
2. **Opportunity evaluation** — six blackboard agents contribute to a shared Opportunity Object; no orchestrator
3. **Regulatory assembly** — the same Opportunity Object becomes the foundation for FDA/EMA-ready documentation

The core insight: the most valuable discovery is the one that lives *between* the categories your experts have already defined.

---

## 2. The Three Structural Problems It Solves

| Problem | Why it can't be fixed with talent alone |
|---|---|
| Bounded by expert knowledge | Experts define the search scope using the same frame they were trained in |
| Siloed by design | No mechanism for a cardiac signal to automatically trigger a conversation with the ATTR team |
| Point-in-time outputs | Reports go stale; no system watches the world and updates conclusions |

---

## 3. Live API Layer — All Data Sources Are Real and Live

**Every agent makes real API calls. Results are fetched at query time, not pre-loaded.**

### 3.1 Public APIs in Use

| API | Base URL | Auth | Rate limit handling |
|---|---|---|---|
| PubMed E-utilities | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/` | API key (free, register at NCBI) | 10 req/sec with key; queue + retry |
| Europe PMC | `https://www.ebi.ac.uk/europepmc/webservices/rest/` | None required | 10 req/sec; exponential backoff |
| Semantic Scholar | `https://api.semanticscholar.org/graph/v1/` | API key recommended | 100 req/min with key |
| ClinicalTrials.gov v2 | `https://clinicaltrials.gov/api/v2/studies` | None required | 10 req/sec |
| Open Targets GraphQL | `https://api.platform.opentargets.org/api/v4/graphql` | None required | Generous; batch queries |
| OpenFDA | `https://api.fda.gov/drug/` | API key optional (higher limits) | 240 req/min with key |
| Lens.org Patents | `https://api.lens.org/patent/search` | API key required (free tier) | 100 req/min |

### 3.2 Environment Variables Required

```env
# .env.local
NCBI_API_KEY=your_key_here
SEMANTIC_SCHOLAR_API_KEY=your_key_here
OPENFDA_API_KEY=your_key_here
LENS_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Optional: rate limit config
API_REQUEST_TIMEOUT_MS=10000
API_MAX_RETRIES=3
```

### 3.3 API Abstraction Layer

Create `/src/api/` with one file per data source. Each file exports typed fetch functions. Agents call these; agents never call fetch directly.

```
/src/api/
  pubmed.ts          // searchPubMed(query, maxResults) → Paper[]
  europePmc.ts       // searchEuropePmc(query) → Paper[]
  semanticScholar.ts // findRelatedPapers(paperId) → Paper[]
  clinicalTrials.ts  // searchTrials(condition, intervention) → Trial[]
  openTargets.ts     // getTargetDiseaseAssociations(target) → Association[]
  openFda.ts         // getAdverseEvents(drugName) → AdverseEvent[]
  lens.ts            // searchPatents(query) → Patent[]
  anthropic.ts       // callAgent(systemPrompt, userPrompt) → string
```

### 3.4 Error Handling Strategy

- All API calls wrapped in try/catch with typed error responses
- Rate limit errors (429): exponential backoff, max 3 retries
- Timeout errors: surface to UI as "Agent taking longer than expected — still running"
- Partial failures: agent posts what it found, flags incomplete search in evidence card metadata
- The UI must never show a blank state due to API failure — always show partial results with a status indicator

---

## 4. Architecture Overview

### 4.1 Stage 1 — Autonomous Anchor Generation

Three sub-agents run on a configurable schedule (cron or manual trigger from dashboard):

**Pattern Scanner**
- Calls: PubMed + Semantic Scholar
- Query strategy: searches by MeSH terms across two indication categories simultaneously
- Detects: papers that cite mechanisms from both categories (co-citation analysis via Semantic Scholar references endpoint)
- Threshold: ≥ 3 cross-domain papers in 18 months → candidate signal

**Anomaly Detector**
- Calls: OpenFDA/FAERS + ClinicalTrials.gov
- Query strategy: pulls adverse event reports for drug class, cross-references with off-label indication data
- Detects: real-world usage patterns that diverge from approved indication
- Threshold: ≥ 5% of FAERS reports referencing an unapproved indication

**Gap Finder**
- Calls: PubMed (paper count) + ClinicalTrials.gov (trial count) for same MeSH terms
- Detects: high paper volume + low trial volume = validated mechanism, no clinical investment
- Threshold: ratio of papers:trials > 10:1 for a mechanism with > 20 papers

**Threshold Filter**
- Requires convergence from ≥ 2 of 3 sub-agents before generating anchor
- Single-domain signals suppressed regardless of strength
- On threshold cross: initialise Opportunity Object, write anchor to database, trigger Stage 2

Human-prompted anchors also enter via the search bar on the dashboard. Both paths produce identical Opportunity Objects and trigger identical Stage 2 flows.

---

### 4.2 Stage 2 — Opportunity Evaluation (Blackboard Architecture)

**No orchestrator. Agents are peers. All run in parallel. Synthesis is emergent.**

All six agents receive the Opportunity Object ID. They fetch the current state, contribute their evidence cards, and update the object. They run concurrently via `Promise.allSettled()` — no agent waits for another.

#### Implementation Pattern

```typescript
// /src/lib/blackboard.ts
export async function runBlackboard(opportunityId: string): Promise<void> {
  const obj = await getOpportunityObject(opportunityId)

  await Promise.allSettled([
    literatureAgent(obj),
    mechanismAgent(obj),
    clinicalTrialAgent(obj),
    commercialAgent(obj),
    regulatoryAgent(obj),   // runs last pass after others post cards
    rweSignalAgent(obj),
  ])

  await computeActionabilityScore(opportunityId)
}
```

The Regulatory Agent is special: it should run a first pass immediately (to catch obvious quality issues early), then a second full pass after the other agents have posted their cards. Implement with a short delay or a two-phase call.

#### The Six Agents — Live Implementation

**Literature Agent**
- Calls: `pubmed.searchPubMed()`, `semanticScholar.findRelatedPapers()`
- Query: builds PubMed query from hypothesis keywords + MeSH terms
- Extracts: title, abstract, PMID, journal, year, sample size (regex from abstract), study design (keyword detection)
- Posts: evidence cards to Opportunity Object, one per relevant paper found
- Claude call: passes top 10 abstracts to Claude to synthesize the pattern and write the evidence card narrative

**Mechanism Agent**
- Calls: `openTargets.getTargetDiseaseAssociations()`
- Query: extracts target names from hypothesis, queries Open Targets for disease associations
- Looks for: same target appearing in multiple disease contexts
- Posts: pathway overlap cards with association scores from Open Targets

**Clinical Trial Agent**
- Calls: `clinicalTrials.searchTrials()`
- Query: searches by condition + intervention keyword
- Extracts: phase, status, enrollment, start date, primary completion, why terminated (if applicable)
- Posts: competitive trial map card + gap flag if paper:trial ratio > 10:1

**Commercial Agent**
- Calls: `lens.searchPatents()`, `openFda.getAdverseEvents()`
- Query: searches patents by mechanism keyword + assignee activity
- Posts: IP landscape card, competitive positioning card
- Claude call: passes patent abstracts + org context to Claude to assess commercial fit

**Regulatory Agent**
- Calls: no external API; reads evidence cards posted by other agents
- Runs five-dimension audit on each card (see Section 5)
- Posts: challenge cards for evidence that fails audit thresholds
- Updates: confidence score multiplier after each challenge posted

**RWE Signal Agent**
- Calls: `openFda.getAdverseEvents()`, `clinicalTrials.searchTrials()` (for enrollment demographics)
- Extracts: patient counts, demographic signals, off-label usage indicators
- Posts: patient population estimate card with source breakdown

---

### 4.3 Stage 3 — Regulatory Assembly

Triggered when user clicks "Assemble regulatory package" on an Opportunity Object in the Act Now zone.

**Provenance Mapper**
- Reads all evidence cards from the Opportunity Object
- For each card: traces claim → source URL → retrieval method → agent → timestamp
- Outputs: provenance graph as JSON, rendered as a visual tree in the UI

**Compliance Checker**
- Claude call: passes all evidence cards + FDA Jan 2025 guidance requirements
- Checks: AI role declared, evidence versioned, credibility framework applicable
- Outputs: compliance report with gap flags (blocking vs non-blocking)

**Package Assembler**
- Version-locks the Opportunity Object (saves immutable snapshot to DB)
- Generates downloadable PDF/markdown report with full provenance trail
- Outputs: `RegulatoryPackage` object (schema in Section 6)

---

## 5. Data Schemas

### 5.1 Opportunity Object

```typescript
// /src/types/OpportunityObject.ts

export type AnchorType = 'auto_generated' | 'human_prompted'
export type ActionabilityZone = 'too_early' | 'act_now' | 'crowded'
export type SourceType = 'pubmed' | 'clinicaltrials' | 'patent' | 'rwe' | 'fda' | 'opentargets' | 'semantic_scholar'
export type AgentName = 'literature' | 'mechanism' | 'clinical_trial' | 'commercial' | 'regulatory' | 'rwe_signal'

export interface QualityScores {
  sample_size: number       // 0.0 – 1.0
  study_design: number      // 0.0 – 1.0
  source_credibility: number
  replication: number
  recency: number
  composite: number         // weighted average; used as regulatory_weight
}

export interface EvidenceCard {
  id: string
  content: string
  source_url: string
  source_type: SourceType
  contributing_agent: AgentName
  timestamp: string         // ISO 8601
  quality_scores: QualityScores
  regulatory_weight: number
  raw_source_metadata: Record<string, unknown>  // full API response stored for provenance
}

export interface Challenge {
  id: string
  content: string
  flagged_by: 'regulatory'
  evidence_card_ref: string
  score_impact: number      // negative float
  dimension: keyof QualityScores
}

export interface SurveillanceTags {
  concept_tags: string[]
  entity_tags: string[]
  signal_tags: string[]
}

export interface ChangeLogEntry {
  timestamp: string
  trigger: string
  agents_reinitiated: AgentName[]
  summary: string
}

export interface ContextUpdateProposal {
  id: string
  category: 'competitor' | 'market' | 'asset' | 'constraint'
  proposal: string
  source_agent: AgentName
  source_evidence: string
  status: 'pending' | 'accepted' | 'rejected'
}

export interface OpportunityObject {
  id: string
  version: number
  created_at: string
  last_updated: string
  anchor_type: AnchorType
  status: 'initialising' | 'agents_running' | 'complete' | 'surveillance' | 'archived'

  hypothesis: {
    statement: string
    patient_population: string
    unmet_need: string
    org_positioning: string
  }

  confidence_score: number        // 0.0 – 1.0; updates in real time
  actionability_score: number     // 0.0 – 1.0
  actionability_zone: ActionabilityZone

  evidence_cards: EvidenceCard[]
  challenges: Challenge[]
  surveillance_tags: SurveillanceTags
  change_log: ChangeLogEntry[]
  context_update_proposals: ContextUpdateProposal[]

  org_context_id: string          // ref to OrganizationContext
}
```

### 5.2 Organization Context

```typescript
// /src/types/OrganizationContext.ts

export type OrgType =
  | 'large_pharma'
  | 'biotech_startup'
  | 'diagnostics'
  | 'academic_medical_center'
  | 'vc_fund'
  | 'bd_team'

export type DiscoveryHorizon =
  | 'asset_extension'
  | 'portfolio_combination'
  | 'capability_driven_new_product'

export interface OrganizationContext {
  id: string
  org_name: string
  org_type: OrgType

  portfolio: {
    approved_assets: string[]
    pipeline_assets: string[]
    platforms: string[]
    therapeutic_areas: string[]
  }

  commercial_weights: {
    market_size_importance: number       // 0.0 – 1.0
    first_mover_importance: number
    competitive_moat_importance: number
    reimbursement_pathway_importance: number
  }

  risk_tolerance: {
    actionability_lower_threshold: number   // default 0.30
    actionability_upper_threshold: number   // default 0.75
  }

  discovery_horizons: DiscoveryHorizon[]

  surveillance_defaults: {
    scan_frequency_act_now: 'daily' | 'weekly'
    scan_frequency_too_early: 'weekly' | 'monthly'
  }
}
```

### 5.3 Regulatory Package

```typescript
// /src/types/RegulatoryPackage.ts

export type CredibilityRating = 'high' | 'moderate' | 'low'
export type TargetAgency = 'FDA' | 'EMA' | 'both'

export interface RegulatoryPackage {
  id: string
  opportunity_object_id: string
  opportunity_object_version: number   // locked at assembly
  assembly_timestamp: string
  target_agency: TargetAgency

  credibility_report: {
    ai_role_declaration: string
    evidence_sections: Array<{
      section: string
      ai_generated_items: number
      human_validated_items: number
      average_regulatory_weight: number
      credibility_rating: CredibilityRating
    }>
  }

  gap_report: Array<{
    gap_description: string
    required_action: string
    blocking: boolean
  }>

  provenance_trail: Array<{
    claim: string
    source_chain: string[]
    retrieval_method: string
    agent: AgentName
    timestamp: string
    raw_api_response_hash: string   // SHA-256 of stored raw response
  }>

  version_lock_hash: string        // SHA-256 of the locked Opportunity Object JSON
}
```

---

## 6. Actionability Score Logic

```typescript
// /src/lib/scoring.ts

export function computeConfidenceScore(cards: EvidenceCard[], challenges: Challenge[]): number {
  if (cards.length === 0) return 0

  const baseScore = cards.reduce((sum, card) => {
    return sum + card.quality_scores.composite
  }, 0) / cards.length

  const challengePenalty = challenges.reduce((sum, c) => sum + Math.abs(c.score_impact), 0)

  return Math.max(0, Math.min(1, baseScore - challengePenalty))
}

export function computeActionabilityZone(
  score: number,
  context: OrganizationContext
): ActionabilityZone {
  const lower = context.risk_tolerance.actionability_lower_threshold   // default 0.30
  const upper = context.risk_tolerance.actionability_upper_threshold   // default 0.75

  if (score < lower) return 'too_early'
  if (score > upper) return 'crowded'
  return 'act_now'
}
```

| Zone | Score range | Meaning | Recommended action |
|---|---|---|---|
| Too early | < 0.30 | Hypothesis interesting, evidence thin | Monitor; surveillance only |
| Act now | 0.30 – 0.75 | Evidence substantive, not yet crowded | Move; commission validation or begin BD |
| Crowded | > 0.75 | Strong evidence = competitors already here | Competitive audit; assess differentiation |

---

## 7. Regulatory Agent — Five-Dimension Audit

```typescript
// /src/agents/regulatoryAgent.ts

function scoreSampleSize(card: EvidenceCard): number {
  const n = extractSampleSize(card.raw_source_metadata)
  if (n === null) return 0.5          // unknown: neutral penalty
  if (n < 30) return 0.2
  if (n < 200) return 0.6
  return 1.0
  // Note: rare disease context check — if disease prevalence < 1:10000,
  // apply a 1.5x multiplier (so n=40 → 0.6 * 1.5 = 0.9)
}

function scoreStudyDesign(card: EvidenceCard): number {
  const design = detectStudyDesign(card.content)
  const scores: Record<string, number> = {
    rct: 1.0,
    prospective_cohort: 0.75,
    retrospective: 0.5,
    observational: 0.4,
    case_report: 0.2,
    meta_analysis: 1.0,
    systematic_review: 0.95,
  }
  return scores[design] ?? 0.4
}

function scoreSourceCredibility(card: EvidenceCard): number {
  // Check: peer-reviewed journal, preprint flag, retraction status
  // Preprints: 0.6 weight, flagged in UI
  // Retracted: 0.0, removed from evidence pool, score adjusted
  const isPeerReviewed = card.raw_source_metadata?.is_peer_reviewed as boolean
  const isPreprint = card.source_type === 'pubmed' &&
    (card.raw_source_metadata?.journal as string)?.includes('bioRxiv')
  if (isPreprint) return 0.6
  if (!isPeerReviewed) return 0.4
  return 0.85
}

function scoreReplication(card: EvidenceCard, allCards: EvidenceCard[]): number {
  // Check: does this finding appear independently in another card from a different institution?
  const independentConfirmations = allCards.filter(other =>
    other.id !== card.id &&
    conceptuallyOverlaps(other.content, card.content) &&
    differentInstitution(other, card)
  ).length
  if (independentConfirmations === 0) return 0.4
  if (independentConfirmations === 1) return 0.75
  return 1.0
}

function scoreRecency(card: EvidenceCard, fieldDecayRate: number): number {
  // fieldDecayRate: fast-moving field = 0.15/year; slow field = 0.05/year
  const ageYears = (Date.now() - new Date(card.timestamp).getTime()) / (1000 * 60 * 60 * 24 * 365)
  return Math.max(0.2, 1.0 - (ageYears * fieldDecayRate))
}
```

---

## 8. Surveillance and Re-initiation

After initial session completes, Opportunity Object enters `surveillance` status.

### Re-initiation Mapping

| What changed | Agents re-initiated |
|---|---|
| New PubMed paper matches concept tags | Literature Agent, Mechanism Agent |
| New ClinicalTrials.gov registration matches entity tags | Clinical Trial Agent, Regulatory Agent |
| New patent matches entity tags | Commercial Agent |
| New FDA approval or regulatory action | Regulatory Agent, Commercial Agent |
| New OpenFDA/FAERS signal | RWE Signal Agent |
| Multiple simultaneous (≥ 3 tag matches in 24h) | All six agents |

### Scan Frequency
- Act Now zone: daily background job
- Too Early zone: weekly background job
- Crowded zone: weekly (monitoring for differentiation opportunities)

### Relevance Filter
Before triggering agent re-initiation, run a lightweight Claude call:
- Pass: new item metadata + current Opportunity Object summary
- Ask: "Does this new development materially change the evidence picture, competitive landscape, or biological plausibility? Answer: yes/no + one sentence reason"
- Only `yes` responses trigger re-initiation

---

## 9. Speed vs Depth Mode

| | Speed mode | Depth mode |
|---|---|---|
| Time to output | 2–5 minutes | 15–30 minutes |
| PubMed results | Top 20 by relevance score | Full query, semantic expansion via Semantic Scholar |
| Open Targets | First-degree associations only | Second and third-degree pathway connections |
| ClinicalTrials | Active trials only | Active + completed + terminated (with termination reasons) |
| Regulatory Agent | Scores sample size and study design only | Full five-dimension audit |
| Score label | Marked "preliminary" in UI | Full confidence label |

Toggle: visible on main interface above the search bar. Current mode shown as a persistent badge on the Opportunity Object header.

---

## 10. Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **State:** Zustand for Opportunity Object state; React Query for API data fetching
- **Real-time updates:** Server-Sent Events (SSE) from backend as agents post evidence cards
- **Charts:** Recharts (confidence score over time, evidence velocity)
- **Animation:** Framer Motion (evidence cards streaming in one by one)
- **UI components:** shadcn/ui as base component library

### Backend
- **Runtime:** Node.js with Next.js API routes (keep it in one repo)
- **Agent orchestration:** Each agent is an async Next.js API route handler; blackboard runs via `Promise.allSettled()`
- **Streaming to frontend:** SSE endpoint that pushes evidence card updates as agents post them
- **Database:** Supabase (Postgres) — stores Opportunity Objects, evidence cards, org contexts
- **Background jobs:** Vercel Cron (or Supabase Edge Functions) for surveillance scans
- **LLM:** Anthropic API — `claude-sonnet-4-20250514` for all agent reasoning calls

### File Structure

```
arclight-bio/
├── .env.local                      # all API keys
├── next.config.ts
├── tailwind.config.ts
│
├── src/
│   ├── app/
│   │   ├── page.tsx                # Dashboard — opportunity queue
│   │   ├── discover/
│   │   │   └── page.tsx            # New discovery session — search input
│   │   ├── opportunity/
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Full Opportunity Object view
│   │   │       └── regulatory/
│   │   │           └── page.tsx    # Stage 3 regulatory package
│   │   └── api/
│   │       ├── discover/
│   │       │   └── route.ts        # POST: initialise new Opportunity Object
│   │       ├── blackboard/
│   │       │   └── [id]/
│   │       │       └── route.ts    # POST: run all six agents
│   │       ├── stream/
│   │       │   └── [id]/
│   │       │       └── route.ts    # GET: SSE stream of evidence card updates
│   │       ├── regulatory/
│   │       │   └── [id]/
│   │       │       └── route.ts    # POST: trigger Stage 3 assembly
│   │       └── surveillance/
│   │           └── route.ts        # POST: cron-triggered surveillance scan
│   │
│   ├── agents/
│   │   ├── literatureAgent.ts
│   │   ├── mechanismAgent.ts
│   │   ├── clinicalTrialAgent.ts
│   │   ├── commercialAgent.ts
│   │   ├── regulatoryAgent.ts
│   │   ├── rweSignalAgent.ts
│   │   └── stage1/
│   │       ├── patternScanner.ts
│   │       ├── anomalyDetector.ts
│   │       ├── gapFinder.ts
│   │       └── thresholdFilter.ts
│   │
│   ├── api/                        # data source abstraction layer
│   │   ├── pubmed.ts
│   │   ├── europePmc.ts
│   │   ├── semanticScholar.ts
│   │   ├── clinicalTrials.ts
│   │   ├── openTargets.ts
│   │   ├── openFda.ts
│   │   ├── lens.ts
│   │   └── anthropic.ts
│   │
│   ├── lib/
│   │   ├── blackboard.ts           # Promise.allSettled orchestration
│   │   ├── scoring.ts              # confidence + actionability score logic
│   │   ├── surveillance.ts         # tag matching + relevance filter
│   │   └── provenance.ts           # SHA-256 hashing, version locking
│   │
│   ├── types/
│   │   ├── OpportunityObject.ts
│   │   ├── OrganizationContext.ts
│   │   ├── RegulatoryPackage.ts
│   │   └── api.ts                  # API response shapes
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx         # "Arclight Bio" wordmark + nav
│   │   │   └── TopBar.tsx
│   │   ├── opportunity/
│   │   │   ├── OpportunityFeed.tsx         # SSE-driven card stream
│   │   │   ├── EvidenceCard.tsx            # individual card with agent badge
│   │   │   ├── ChallengeCard.tsx           # Regulatory Agent flag — distinct red styling
│   │   │   ├── ConfidenceGauge.tsx         # animated 0–1 score display
│   │   │   ├── ActionabilityZone.tsx       # three-zone indicator bar
│   │   │   ├── HypothesisPanel.tsx         # named hypothesis + evidence velocity
│   │   │   └── SurveillanceTags.tsx        # active tag display
│   │   ├── dashboard/
│   │   │   ├── OpportunityRow.tsx          # queue row with signal strength bar
│   │   │   └── MetricCards.tsx             # summary metric cards
│   │   ├── org/
│   │   │   └── OrgContextSelector.tsx      # dropdown: Pfizer / biotech / VC
│   │   └── regulatory/
│   │       ├── ProvenanceTree.tsx          # visual provenance graph
│   │       ├── ComplianceReport.tsx        # gap flags + credibility ratings
│   │       └── PackageDownload.tsx         # download button for PDF/markdown
│   │
│   ├── hooks/
│   │   ├── useOpportunityStream.ts         # SSE connection + card accumulation
│   │   ├── useOpportunityObject.ts         # Zustand store wrapper
│   │   └── useSurveillance.ts
│   │
│   └── store/
│       └── opportunityStore.ts             # Zustand store definition
│
└── supabase/
    └── migrations/
        ├── 001_opportunity_objects.sql
        ├── 002_evidence_cards.sql
        ├── 003_org_contexts.sql
        └── 004_regulatory_packages.sql
```

---

## 11. Agent Prompt Templates

### Literature Agent

```typescript
const LITERATURE_AGENT_SYSTEM = `
You are the Literature Agent for Opportunity Space, built by Arclight Bio.
Your job is not to summarize papers. Your job is to detect patterns —
recurring themes, emerging topics, ideas appearing across different fields simultaneously.

You will receive:
1. The current Opportunity Object state (hypothesis + existing evidence)
2. A set of paper abstracts fetched from PubMed and Semantic Scholar

For each paper that is genuinely relevant to the hypothesis, produce an evidence card with:
- A one-sentence claim about what this paper contributes to the hypothesis
- Why this paper matters (cross-domain relevance is especially important)
- Study design detected: RCT / cohort / retrospective / observational / meta-analysis / case report
- Sample size (extract from abstract if present, null if not found)
- Whether this finding appears to be independently replicated elsewhere in the set

Do not include papers that are only tangentially related. Quality over quantity.
Return as a JSON array of evidence card objects.
`
```

### Regulatory Agent

```typescript
const REGULATORY_AGENT_SYSTEM = `
You are the Regulatory Agent for Opportunity Space, built by Arclight Bio.
You are the trust mechanism for the entire platform.

Your job is to audit every evidence card posted by other agents and ask:
how solid is this, really?

For each evidence card, score it across five dimensions (0.0 to 1.0):
1. Sample size adequacy: < 30 = 0.2; 30-200 = 0.6; > 200 = 1.0 (adjust for rare disease context)
2. Study design: RCT/meta-analysis = 1.0; prospective cohort = 0.75; retrospective = 0.5; observational = 0.4
3. Source credibility: peer-reviewed = 0.85; preprint = 0.6; no peer review = 0.4
4. Replication: independently validated = 1.0; single study = 0.4
5. Recency: use field-appropriate decay (oncology decays fast; rare disease slower)

For any evidence card where the composite score is below 0.4, generate a challenge card.
Calculate the score_impact (negative float) of each challenge on the overall confidence score.

Return: { audited_cards: [...], challenges: [...], confidence_adjustment: float }
`
```

### Stage 3 Compliance Checker

```typescript
const COMPLIANCE_CHECKER_SYSTEM = `
You are the Compliance Checker for Arclight Bio's regulatory assembly pipeline.

Map the evidence in this Opportunity Object against FDA's January 2025 draft guidance
on AI in drug and biological product submissions (risk-based credibility framework).

For each evidence section:
1. Is the AI system's role in generating this evidence declared?
2. Is the evidence versioned and traceable to its source data?
3. What is the credibility rating: high / moderate / low?
4. What gaps require human-generated evidence before this section is submission-ready?

Flag blocking gaps (submission cannot proceed) separately from non-blocking gaps
(submission can proceed with acknowledged limitations).

Reference: FDA Draft Guidance January 2025 — Considerations for Use of AI to Support
Regulatory Decision-Making for Drugs and Biological Products.

Return as structured JSON matching the RegulatoryPackage compliance_report schema.
`
```

---

## 12. UI Design Direction

**Aesthetic:** Dark navy sidebar (#0F1629), light gray content area (#F7F8FA), clean white cards. Precise, data-dense but not cluttered. Linear meets Benchling.

**Arclight Bio branding:**
- Wordmark: "Arclight Bio" in Inter 600
- Platform name: "Opportunity Space" as subtitle in Inter 400 regular
- Nav header: "Arclight Bio / Opportunity Space"
- Page title tag: `Arclight Bio — Opportunity Space`
- Favicon: arc motif (TBD by designer; use a simple SVG arc as placeholder)

**Color tokens:**
- Primary accent: deep purple `#534AB7`
- Secondary accent: teal `#1D9E75`
- Alert / Regulatory challenge: coral `#D85A30`
- Confidence score bar: teal when > 0.60, amber when 0.30–0.60, coral when < 0.30
- Agent badges: each agent gets a distinct color pill
  - Literature: purple
  - Mechanism: teal
  - Clinical Trial: blue
  - Commercial: amber
  - Regulatory: coral (distinct — it's the auditor)
  - RWE Signal: green

**Key interaction — the streaming feed:**
Evidence cards appear one at a time via SSE as agents post them. Each card animates in (Framer Motion: slide up + fade in, 200ms). The confidence score gauge updates after every card. When a Regulatory challenge card appears, the score visibly drops and the card has a distinct coral left border. This streaming animation is the demo's centrepiece — it must be smooth.

---

## 13. Database Schema (Supabase)

```sql
-- 001_opportunity_objects.sql
create table opportunity_objects (
  id uuid primary key default gen_random_uuid(),
  version integer not null default 1,
  created_at timestamptz default now(),
  last_updated timestamptz default now(),
  anchor_type text not null check (anchor_type in ('auto_generated', 'human_prompted')),
  status text not null default 'initialising',
  hypothesis jsonb not null,
  confidence_score float not null default 0,
  actionability_score float not null default 0,
  actionability_zone text not null default 'too_early',
  surveillance_tags jsonb not null default '{}',
  change_log jsonb not null default '[]',
  context_update_proposals jsonb not null default '[]',
  org_context_id uuid references org_contexts(id)
);

-- 002_evidence_cards.sql
create table evidence_cards (
  id uuid primary key default gen_random_uuid(),
  opportunity_object_id uuid references opportunity_objects(id) on delete cascade,
  content text not null,
  source_url text,
  source_type text not null,
  contributing_agent text not null,
  timestamp timestamptz default now(),
  quality_scores jsonb not null,
  regulatory_weight float,
  raw_source_metadata jsonb,   -- full API response; used for provenance
  is_challenge boolean not null default false,
  challenge_metadata jsonb     -- populated if is_challenge = true
);

-- 003_org_contexts.sql
create table org_contexts (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  org_type text not null,
  portfolio jsonb not null default '{}',
  commercial_weights jsonb not null,
  risk_tolerance jsonb not null,
  discovery_horizons text[] not null,
  surveillance_defaults jsonb not null
);

-- 004_regulatory_packages.sql
create table regulatory_packages (
  id uuid primary key default gen_random_uuid(),
  opportunity_object_id uuid references opportunity_objects(id),
  opportunity_object_version integer not null,
  assembly_timestamp timestamptz default now(),
  target_agency text not null,
  credibility_report jsonb not null,
  gap_report jsonb not null,
  provenance_trail jsonb not null,
  version_lock_hash text not null
);
```

---

## 14. Hackathon Build Checklist

### Non-negotiables (must work with live data)
- [ ] Search bar accepts any drug/target/indication and triggers real PubMed query
- [ ] All six agents run in parallel and post real evidence cards from live APIs
- [ ] Confidence score updates in real time as cards stream in
- [ ] Regulatory Agent posts at least one challenge card on a real evidence weakness
- [ ] Actionability zone updates live and is clearly visible
- [ ] Named hypothesis is generated by Claude from the actual evidence found — not hardcoded
- [ ] Every evidence card links to its real source URL
- [ ] Organization Context selector changes Commercial Agent and score thresholds
- [ ] "Arclight Bio" appears in nav, page title, and all exported documents

### Nice-to-haves
- [ ] Stage 3 regulatory package assembly (even if only partially automated)
- [ ] Speed / Depth toggle
- [ ] Surveillance tag display after session completes
- [ ] Evidence velocity sparkline chart

### Do Not Build
- Hardcoded demo data or pre-fetched JSON for the demo path
- User authentication (open access for hackathon)
- Internal data integration
- Mobile layout

---

## 15. First Cursor Prompts (in order)

**Step 1 — Project scaffold**
```
Create a Next.js 14 app with TypeScript, Tailwind CSS, shadcn/ui, and Supabase.
Project name: arclight-bio. App name in all UI: "Arclight Bio — Opportunity Space".
Set up the folder structure from the build spec exactly.
```

**Step 2 — Types**
```
Using @opportunity_space_build_spec.md, create all TypeScript interfaces
in /src/types/ — OpportunityObject.ts, OrganizationContext.ts,
RegulatoryPackage.ts, and api.ts for all external API response shapes.
```

**Step 3 — API abstraction layer**
```
Build /src/api/pubmed.ts — a typed wrapper around the NCBI E-utilities API.
Export: searchPubMed(query: string, maxResults: number): Promise<Paper[]>
Use the NCBI_API_KEY environment variable. Handle rate limiting with exponential backoff.
Paper type should include: pmid, title, abstract, journal, year, authors, doi.
```

**Step 4 — Repeat Step 3 for each API**
```
Build /src/api/clinicalTrials.ts wrapping ClinicalTrials.gov v2 API.
Export: searchTrials(condition: string, intervention: string): Promise<Trial[]>
No auth required. Handle pagination.
```

**Step 5 — Blackboard orchestration**
```
Build /src/lib/blackboard.ts. It should run all six agents via Promise.allSettled(),
stream evidence cards to Supabase as they are posted, and update the confidence score
after each card. Reference the scoring logic in the build spec.
```

**Step 6 — SSE streaming endpoint**
```
Build /src/app/api/stream/[id]/route.ts as a Server-Sent Events endpoint.
It should watch the evidence_cards table in Supabase for new rows matching
the opportunity_object_id and push each new card to the client as it arrives.
```

**Step 7 — OpportunityFeed component**
```
Build /src/components/opportunity/OpportunityFeed.tsx.
It connects to the SSE endpoint, receives evidence cards one at a time,
and renders each with a Framer Motion slide-up + fade-in animation.
Challenge cards (is_challenge = true) get coral left border and distinct styling.
The confidence score gauge updates after every card.
```

---

## 16. One-Sentence Version

> Arclight Bio's Opportunity Space is a living discovery engine that runs autonomous agents on a shared evolving hypothesis — finding what lives between your experts' categories, grounded in real-time data from every major public biomedical source, and traceable to submission-ready evidence from the first signal to the final regulatory package.

---

*Confidential · Build Spec v3 · June 2026*
*Arclight Bio — Opportunity Space*
*Tracks: 02 Autonomous Research + 05 Regulatory*
