# Arclight Bio — Application Index

> **Purpose:** Session-persistent lookup for how Opportunity Space works.  
> **Repo:** `https://github.com/nayanikar/arclightbio.git`  
> **Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Zustand · TanStack Query · Supabase (optional) · Anthropic Claude  
> **Docs:** [`README.md`](README.md) onboarding · [`issues.md`](issues.md) audit tracker (Phase 1 done)

---

## 1. What this application does

**Arclight Bio — Opportunity Space** is a living discovery platform for life sciences. A human query spawns an **Opportunity Object** — a shared artifact that seven autonomous agents enrich with live evidence from public biomedical APIs (PubMed, ClinicalTrials.gov, Open Targets, OpenFDA, Lens patents, etc.). No pre-cached demo data.

**Core insight:** The most valuable opportunities often live *between* the categories an organization has already defined.

### Three operating stages

| Stage | What happens | Key files |
|-------|--------------|-----------|
| **1. Discovery** | Query → classify → hypothesis → 7-agent blackboard | `src/app/api/discover/route.ts`, `src/lib/blackboardRun.ts` |
| **2. Surveillance** | Ongoing PubMed/trials/patents polling; scores update on new signals | `src/lib/surveillance.ts`, `src/hooks/useSurveillance*.ts` |
| **3. Regulatory assembly** | Version-lock + compliance check + PDF export (Act Now only) | `src/app/api/regulatory/[id]/route.ts`, `src/lib/regulatoryPdf.ts` |

---

## 2. End-to-end discovery flow

```
User (/discover)
  → POST /api/discover { query, orgContextId, mode, domainContext }
    → classifyQuery()           [src/lib/queryClassifier.ts]
    → searchPubMed()            [src/api/pubmed.ts]
    → generateHypothesis()      [src/lib/hypothesis.ts]
    → createOpportunityObject() [src/lib/db.ts]
    → scheduleBlackboardRun(id)  [src/lib/blackboardRun.ts] — async; waitUntil on Vercel
  → Redirect to /opportunity/[id]
  → useOpportunityStream() connects SSE /api/stream/[id]
  → UI updates live (cards, agent_status, scores)
  → Blackboard completes → status = "surveillance"
  → OR agent failure after retry → status = "agents_failed"
  → Surveillance scans poll for new literature/trials/patents
```

### Status lifecycle

```
initialising → agents_running → surveillance → (paused | complete | archived)
                    ↓
              agents_failed   (terminal — pipeline stopped after agent retry exhausted)
                    ↓
              paused          (mid-run stop saves checkpoint; resume continues agents)
```

| Status | Meaning |
|--------|---------|
| `initialising` | Opportunity created; blackboard not yet marked running |
| `agents_running` | Blackboard agents executing |
| `agents_failed` | Agent failed twice; pipeline stopped; see failure banner + `.data/blackboard-errors.log` |
| `surveillance` | Blackboard complete; ongoing field monitoring |
| `paused` | User paused (agents mid-run or surveillance); checkpoint in `blackboard_state` |
| `complete` | Terminal complete state |
| `archived` | Archived |

Pause/resume: `POST /api/opportunity/[id]/pause` · `POST /api/opportunity/[id]/resume`  
Resume after mid-run pause re-schedules blackboard with `{ resume: true }` (skips `blackboard_state.completedSteps`).

---

## 3. Blackboard orchestration

**Primary file:** `src/lib/blackboardRun.ts`  
**Public exports:** `src/lib/blackboard.ts` (re-exports `runBlackboard`, `scheduleBlackboardRun`, `refreshScores`)

**Entry points:**
- `scheduleBlackboardRun(opportunityId, opts?)` — fire-and-forget from discover (uses Vercel `waitUntil` when deployed)
- `runBlackboard(opportunityId, opts?)` — awaitable run; supports `{ resume: true }`, `{ force: true }`

### Session integrity (Phase 1 — shipped June 2026)

| Mechanism | Behavior |
|-----------|----------|
| **Per-opportunity lock** | `acquireBlackboardLock()` — in-process + `.data/locks/` file; concurrent runs rejected |
| **Checkpoint** | `blackboard_state.completedSteps` — 8 steps: `regulatory:early`, literature, mechanism, modality, clinical_trial, commercial, rwe_signal, `regulatory:full` |
| **Retry policy** | Each agent: 1 retry on failure; second failure → `agents_failed`, serious log, pipeline stops |
| **Fresh snapshot** | Refetches `getOpportunityObject()` before each agent |
| **Org fallback** | `refreshScores()` uses `DEFAULT_ORG_CONTEXTS` if Supabase org missing |
| **Error log** | `.data/blackboard-errors.log` — JSON lines with `[SERIOUS]` prefix |

Audit tracker: [`issues.md`](issues.md) — Phase 1 complete (P1-001–P1-012).

### Execution order

1. **Regulatory (early)** — `regulatoryAgent(obj, "early")` — flags compliance gaps before evidence accumulates
2. **Literature** — `literatureAgent(obj)`
3. **Mechanism** — `mechanismAgent(obj)`
4. **Modality** — `modalityAgent(obj)` *(v2.0 — reads ranked targets from mechanism)*
5. **Clinical trial** — `clinicalTrialAgent(obj)`
6. **Commercial** — `commercialAgent(obj)`
7. **RWE signal** — `rweSignalAgent(obj)`
8. *(2s delay)*
9. **Regulatory (full)** — `regulatoryAgent(updatedObj, "full")` — full audit + de-risk recommendations
10. **Surveillance tags** — `generateSurveillanceTags()` → status `"surveillance"`

After **each** agent: `refreshScores()` recomputes confidence + actionability.

Each agent run is wrapped in `runTrackedAgent()` which: records `blackboard_state.lastEvent`, broadcasts Spacebase1 intent events when enabled, and enforces retry/fail-fast.

**Visual vs execution order:** `src/lib/agentGraph.ts` lists agents as literature → … → regulatory for the SVG graph, but regulatory actually runs **first (early)** and **last (full)** in `runBlackboard()`.

**Regulatory constants:** `CHALLENGE_THRESHOLD = 0.65`, `MAX_CHALLENGES = 3` in `src/agents/regulatoryAgent.ts`.

**Stage 1 (autonomous anchors):** `src/agents/stage1/thresholdFilter.ts` — `patternScanner`, `anomalyDetector`, `gapFinder`, `thresholdFilter` can spawn opportunities when ≥2 signals converge, but is **not wired to any HTTP route** today; human discovery uses `POST /api/discover` only.

---

## 4. Agents reference

| Agent | File | Data sources | Special outputs |
|-------|------|--------------|-----------------|
| **Literature** | `src/agents/literatureAgent.ts` | PubMed, Europe PMC, Semantic Scholar (depth), Claude filter | Evidence cards; `is_cross_domain` cards via `src/lib/literatureDomains.ts` |
| **Mechanism** | `src/agents/mechanismAgent.ts` | Open Targets, Claude | `is_target_list` card — ranked targets with druggability scores; parsed by `src/lib/targetList.ts` |
| **Modality** | `src/agents/modalityAgent.ts` | Claude (reads mechanism targets) | `is_modality_card`; assessments in `raw_source_metadata.modality_assessments`; types in `src/lib/modalityTypes.ts` |
| **Clinical trial** | `src/agents/clinicalTrialAgent.ts` | ClinicalTrials.gov, Lens patents | Trial relevance cards; `is_novelty_check` verdict cards for first-in-class contexts |
| **Commercial** | `src/agents/commercialAgent.ts` | OpenFDA approvals, Lens patents | Market saturation / competitive landscape |
| **RWE signal** | `src/agents/rweSignalAgent.ts` | OpenFDA FAERS | Real-world adverse event patterns |
| **Regulatory** | `src/agents/regulatoryAgent.ts` | Claude audit | Challenge cards (`is_challenge: true`); `derisk_recommendation` JSON on full audit |

### Stage-1 agents (legacy / auxiliary)

`src/agents/stage1/` — `patternScanner`, `anomalyDetector`, `gapFinder`, `thresholdFilter` — used for autonomous anchor generation patterns; not in main blackboard loop.

### Agent writes pattern

All agents call `insertEvidenceCard(opportunityId, card)` from `src/lib/db.ts`. Cards include `quality_scores`, `contributing_agent`, `source_type`, `source_url`, and v2.0 flags.

---

## 5. Domain context

**Config:** `src/lib/domainContext.ts`  
**Stored on:** `OpportunityObject.domain_context` · derived `indication_type`

| Value | Label | Effect |
|-------|-------|--------|
| `general` | General discovery | Standard agent config |
| `oncology first-in-class` | Oncology FIC | Cross-domain search, target ranking, novelty check, modality |
| `autoimmune chronic` | Autoimmune/chronic | Higher safety bar, de-risking |
| `sex-specific biology` | Women's health | Immunology × reproductive cross-domain |
| `rare disease` | Rare disease | Lower evidence bar, orphan pathway |

`DOMAIN_CONTEXT_ADJUSTMENTS` adds mandatory PubMed domains, hypothesis instructions, and target filters per context.  
`domainContextToIndicationType()` maps to `oncology` | `autoimmune_chronic` | `rare_disease` — affects actionability thresholds via `src/lib/indicationRisk.ts`.

---

## 6. Scoring system

**File:** `src/lib/scoring.ts`

### Confidence score

- **Tier prior** (`TIER_PRIOR`): preclinical `0.15` · clinical `0.45` · established `0.70`
- **Agent weights:** clinical_trial `1.5×` · literature `1.0×` · rwe_signal `0.8×` · mechanism `0.25×`
- Cross-domain literature cards get `1.5×` extra weight
- Blended with prior: `PRIOR_WEIGHT = 4`
- Penalties: regulatory challenge cards (max −0.2); saturation bonus (+0.08 if >10 relevant trials)
- Excludes commercial/regulatory cards from confidence calculation

### Actionability zone

**Function:** `getActionabilityZoneFromConfidence(score, orgContext, indicationType)`

| Zone | Condition |
|------|-----------|
| `too_early` | score < lower threshold (org or indication-specific min) |
| `act_now` | score between lower and upper |
| `crowded` | score > org upper threshold |

Org thresholds: `OrganizationContext.risk_tolerance.actionability_lower/upper_threshold`  
Indication overrides (`src/lib/indicationRisk.ts` → `minimum_confidence_for_act_now`):

| Indication | Min confidence for Act Now |
|------------|---------------------------|
| oncology | 0.35 |
| autoimmune_chronic | 0.50 |
| rare_disease | 0.28 |

### Actionability score (separate metric)

`computeActionabilityScore()` — weighted by org `commercial_weights` (market size, first mover, moat, reimbursement). Modifiers: commercial saturation (+0.25), high trial count (+0.10).

### Evidence quality

`src/lib/evidenceQuality.ts` — sample size, study design detection  
`computeCompositeQuality()` — weighted composite for card quality scores

---

## 7. Data layer

**Primary abstraction:** `src/lib/db.ts` — all CRUD for opportunities, evidence cards, org contexts, regulatory packages.

### Persistence modes

| Mode | Trigger | Storage |
|------|---------|---------|
| **Supabase** | Valid `NEXT_PUBLIC_SUPABASE_URL` + keys in `.env.local` | PostgreSQL via `src/lib/supabase.ts` |
| **File store fallback** | Supabase not configured | `.data/store.json` via `src/lib/fileStore.ts` |

### Key DB functions

| Function | Purpose |
|----------|---------|
| `createOpportunityObject()` | New session |
| `getOpportunityObject(id)` | Full object + evidence cards |
| `listOpportunityObjects()` | Dashboard list |
| `updateOpportunityObject(id, updates)` | Status, scores, tags, change_log |
| `insertEvidenceCard()` | Agent output |
| `getEvidenceCardsSince(id, since)` | SSE polling |
| `getAllEvidenceCards()` | Score recomputation |
| `listOrgContexts()` / `getOrgContext()` | Org evaluation context |
| `saveRegulatoryPackage()` | Stage 3 export |

### Default org contexts (in-memory / seed)

Defined in `src/lib/db.ts` → `DEFAULT_ORG_CONTEXTS`:
- Pfizer (Demo) — large pharma
- Helix Therapeutics (Demo) — biotech startup
- Horizon Ventures (Demo) — VC fund

### Database schema (Supabase migrations)

Run **001 → 011** in order from `supabase/migrations/` (note: `001` FK-references `org_contexts`, so run `003` first on a fresh install if FK errors occur):

| Migration | Purpose |
|-----------|---------|
| `001_opportunity_objects.sql` | Core opportunity table |
| `002_evidence_cards.sql` | Evidence cards |
| `003_org_contexts.sql` | Organization contexts |
| `004_regulatory_packages.sql` | Regulatory package storage |
| `005_backfill_actionability_zones.sql` | Zone backfill |
| `006_clear_surveillance_tags.sql` | Tag cleanup |
| `007_update_pfizer_org_context.sql` | Pfizer org update |
| `008_evidence_tier.sql` | Evidence tier column |
| `009_query_tier.sql` | Query tier column |
| `010_query_tier_null_default.sql` | Query tier default fix |
| `011_agent_upgrade.sql` | v2.0: domain_context, indication_type, card flags, derisk_recommendation |
| `012_blackboard_state.sql` | Phase 1: `blackboard_state jsonb` for checkpoint, lastEvent, pauseReason |

---

## 8. Core types

**File:** `src/types/OpportunityObject.ts`

### OpportunityObject (central model)

```
id, version, created_at, last_updated
anchor_type: auto_generated | human_prompted
status: initialising | agents_running | agents_failed | complete | surveillance | paused | archived
hypothesis: { statement, patient_population, unmet_need, org_positioning }
confidence_score, actionability_score, actionability_zone
evidence_cards[], challenges[]
surveillance_tags: { concept_tags, entity_tags, signal_tags, last_checked_at? }
blackboard_state?: { completedSteps[], pauseReason?, lastError?, lastEvent? }
change_log[], context_update_proposals[]
org_context_id, search_query, mode (speed|depth)
evidence_tier, query_tier, prior_score
domain_context, indication_type
```

### EvidenceCard flags (v2.0)

| Flag | Agent | UI component |
|------|-------|--------------|
| `is_cross_domain` | Literature | EvidenceStreamRail (highlighted) |
| `is_target_list` | Mechanism | PrioritizedTargetsPanel |
| `is_modality_card` | Modality | ModalityPanel |
| `is_novelty_check` | Clinical trial | EvidenceCard |
| `is_challenge` | Regulatory | ChallengeCard |
| `derisk_recommendation` | Regulatory (full) | ChallengeCard, SessionSummaryPanel |

### Other type files

| File | Contents |
|------|----------|
| `src/types/OrganizationContext.ts` | Org portfolio, commercial weights, risk tolerance |
| `src/types/RegulatoryPackage.ts` | Stage 3 package structure |
| `src/types/api.ts` | Paper, Trial, external API shapes |
| `src/types/surveillanceProgress.ts` | SurveillanceStep, SurveillanceScanSummary |

---

## 9. API routes

All under `src/app/api/`.

### Discovery

| Method | Path | File | Purpose |
|--------|------|------|---------|
| POST | `/api/discover` | `discover/route.ts` | Create opportunity + start blackboard |
| GET | `/api/discover` | `discover/route.ts` | List org contexts |
| POST | `/api/discover/classify` | `discover/classify/route.ts` | Preview query tier classification |

### Opportunities

| Method | Path | File | Purpose |
|--------|------|------|---------|
| GET | `/api/opportunities` | `opportunities/route.ts` | List all opportunities |
| GET | `/api/opportunities/metrics` | `opportunities/metrics/route.ts` | Dashboard metrics |
| GET | `/api/opportunity/[id]` | `opportunity/[id]/route.ts` | Single opportunity |
| POST | `/api/opportunity/[id]/pause` | `opportunity/[id]/pause/route.ts` | Pause session |
| POST | `/api/opportunity/[id]/resume` | `opportunity/[id]/resume/route.ts` | Resume session; if checkpoint incomplete → `scheduleBlackboardRun({ resume: true })` |

### Streaming (SSE)

| Method | Path | File | Events |
|--------|------|------|--------|
| GET | `/api/stream/[id]` | `stream/[id]/route.ts` | `connected`, `card`, `agent_status`, `score`, `complete`, `failed`, `paused`, `error` — polls every 1.5s |
| GET | `/api/surveillance/[id]/stream` | `surveillance/[id]/stream/route.ts` | Surveillance scan progress (SSE, 120s max); runs `runSurveillanceScan()` inline |

### Surveillance

| Method | Path | File | Purpose |
|--------|------|------|---------|
| POST | `/api/surveillance` | `surveillance/route.ts` | Batch status scan only (blackboard re-run **disabled** — was duplicating cards) |
| POST | `/api/surveillance/[id]` | `surveillance/[id]/route.ts` | Run scan for one opportunity |

### Regulatory

| Method | Path | File | Purpose |
|--------|------|------|---------|
| POST | `/api/regulatory/[id]` | `regulatory/[id]/route.ts` | Assemble regulatory package (Act Now only) |

### Admin

| Method | Path | File | Purpose |
|--------|------|------|---------|
| POST | `/api/admin/backfill` | `admin/backfill/route.ts` | Recompute scores + tier backfill |
| POST | `/api/admin/stop-surveillance` | `admin/stop-surveillance/route.ts` | Pause all active surveillance |
| POST | `/api/admin/regenerate-tags` | `admin/regenerate-tags/route.ts` | Rebuild surveillance tags |
| POST | `/api/blackboard/[id]` | `blackboard/[id]/route.ts` | Manually re-run blackboard (`{ force?: boolean, resume?: boolean }`); 409 if lock busy |

### Utility

| Method | Path | File | Purpose |
|--------|------|------|---------|
| GET | `/api/health?service=...` | `health/route.ts` | Smoke test external APIs |
| GET | `/api/spacebase/observatory` | `spacebase/observatory/route.ts` | Resolve Observatory URL |

---

## 10. External API wrappers

All in `src/api/` — shared HTTP helpers in `src/lib/http.ts`.

| File | Service | Key exports |
|------|---------|-------------|
| `anthropic.ts` | Anthropic Claude (`claude-sonnet-4-20250514`) | `callAgent()`, `callAgentJson<T>()` |
| `pubmed.ts` | NCBI PubMed | `searchPubMed()`, `getPubMedCount()` |
| `europePmc.ts` | Europe PMC | `searchEuropePmc()` — **wrapper exists, not used in production** |
| `semanticScholar.ts` | Semantic Scholar | `findRelatedPapers()`, `searchSemanticScholar()` |
| `clinicalTrials.ts` | ClinicalTrials.gov | `searchTrialsByTerm()`, `searchTrials()`, `getTrialCount()` |
| `openTargets.ts` | Open Targets | `getTargetDiseaseAssociations()` |
| `openFda.ts` | OpenFDA | `getAdverseEvents()`, `getOffLabelIndications()`, `searchFDAApprovals()` |
| `lens.ts` | Lens.org patents | `searchPatents()` — requires `LENS_API_KEY` (throws if missing) |

---

## 11. UI pages & routes

| Path | File | Purpose |
|------|------|---------|
| `/` | `src/app/page.tsx` | Dashboard — opportunity queue, metrics, featured cards |
| `/discover` | `src/app/discover/page.tsx` | Start discovery: query, speed/depth, org + domain context |
| `/opportunity/[id]` | `src/app/opportunity/[id]/page.tsx` | **3-column session view** (rebrand v2.0) |
| `/opportunity/[id]/regulatory` | `src/app/opportunity/[id]/regulatory/page.tsx` | Regulatory assembly + PDF export |
| `/admin` | `src/app/admin/page.tsx` | Dev admin (Shift+P shortcut) |

### Opportunity page layout (desktop)

```
┌─────────────────┬──────────────────────────┬─────────────────┐
│ Left sidebar    │ Center column            │ Right rail      │
│ (280px, dark)   │ (narrative)              │ (300px)         │
├─────────────────┼──────────────────────────┼─────────────────┤
│ Global nav      │ OpportunityHeader        │ ScoreStrip      │
│ EvidenceStream  │ PrioritizedTargetsPanel  │ ModalityPanel   │
│ SurveillanceRail│ HypothesisPanel          │ AgentNodeGraph  │
│                 │ SessionSummaryPanel      │                 │
└─────────────────┴──────────────────────────┴─────────────────┘
```

Sidebar rail only on opportunity detail pages (280px vs 220px elsewhere). Mobile: `MobileEvidenceDrawer`.

### Key UI components

**Layout:** `src/components/layout/` — `AppShell`, `Sidebar`, `TopBar`, `PageContent`, `Panel`, `DevShortcut`

**Opportunity (rebrand):**

| Component | File | Role |
|-----------|------|------|
| OpportunityHeader | `OpportunityHeader.tsx` | Query title, badges, hypothesis subtitle |
| PrioritizedTargetsPanel | `PrioritizedTargetsPanel.tsx` | Top 3 ranked targets + druggability bars |
| HypothesisPanel | `HypothesisPanel.tsx` | Hypothesis detail blocks |
| SessionSummaryPanel | `SessionSummaryPanel.tsx` | 3–5 bullets from `src/lib/sessionSummary.ts` |
| ScoreStrip | `ScoreStrip.tsx` | Compact confidence + actionability |
| ModalityPanel | `ModalityPanel.tsx` | Modality recommendations |
| AgentNodeGraph | `AgentNodeGraph.tsx` | SVG agent network; click filters evidence rail |
| EvidenceStreamRail | `EvidenceStreamRail.tsx` | Compact evidence rows in sidebar |
| SurveillanceRail | `SurveillanceRail.tsx` | Collapsible surveillance status |
| OpportunitySidebarRail | `OpportunitySidebarRail.tsx` | Wraps evidence + surveillance |
| MobileEvidenceDrawer | `MobileEvidenceDrawer.tsx` | Mobile slide-in drawer |
| EvidenceCard | `EvidenceCard.tsx` | Full + compact card variants |
| ChallengeCard | `ChallengeCard.tsx` | Regulatory challenges + de-risk |
| SurveillancePanel | `SurveillancePanel.tsx` | Pause/resume controls |

**Dashboard:** `src/components/dashboard/` — `MetricCards`, `FeaturedOpportunityCard`, `AllOpportunitiesList`, `ZoneBadge`, `AgentPips`

**Regulatory:** `src/components/regulatory/` — `ComplianceReport`, `ProvenanceTree`, `PackageDownload`

**Legacy (dashboard reuse):** `ConfidenceGauge`, `ActionabilityZone`, `OpportunityFeed` — removed from opportunity detail page

---

## 12. State management

### Zustand stores

| Store | File | Holds |
|-------|------|-------|
| `useOpportunityStore` | `src/store/opportunityStore.ts` | Current opportunity, streaming cards, scores, status, `selectedAgent`, `blackboardError`, `lastAgentStatus`, surveillance results |
| `useDashboardStore` | `src/store/dashboardStore.ts` | Dashboard list + metrics |

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useOpportunityStream` | `src/hooks/useOpportunityStream.ts` | SSE `/api/stream/[id]` → `addCard`, `updateScores`, `agent_status`, `failed`, `paused` |
| `useOpportunityObject` | `src/hooks/useOpportunityObject.ts` | Fetch + hydrate opportunity |
| `useSurveillance` | `src/hooks/useSurveillance.ts` | Surveillance polling |
| `useSurveillanceScan` | `src/hooks/useSurveillanceScan.ts` | Single scan with SSE progress |
| `useSurveillanceSessionControls` | `src/hooks/useSurveillanceSessionControls.ts` | Shared pause/resume; surfaces API errors to UI |
| `useDashboardPoll` | `src/hooks/useDashboardPoll.ts` | Dashboard refresh interval |

### Client-side cache & cross-page events

`src/lib/opportunityCache.ts` — localStorage snapshots written on every store mutation; keys: `arclight_opportunity_ids`, `arclight_opportunity_{id}`; discover page pre-seeds cache before redirect  
`src/lib/events.ts`:
- `OPPORTUNITIES_UPDATED_EVENT` — fired on score/card changes → dashboard refetches
- `SESSIONS_UPDATED_EVENT` — fired on admin actions + pause/resume → opportunity page reloads

### Agent graph ↔ evidence rail link

`selectedAgent: AgentName | null` in opportunity store. Click agent node in `AgentNodeGraph` → filters `EvidenceStreamRail`. Layout built by `src/lib/agentGraph.ts`.

---

## 13. Surveillance

**Core:** `src/lib/surveillance.ts` — `runSurveillanceScan(opportunityId)`

After blackboard: status → `"surveillance"`, Claude generates tags via `src/lib/surveillanceTags.ts`.

Each scan (`runSurveillanceScan()`):
1. PubMed per concept tag (max 6 tags) → dedupe → Claude relevance filter → insert up to **3 new literature cards**
2. Entity tags: ClinicalTrials.gov + Lens checks are **monitor-only** (no cards inserted)
3. If new cards: `regulatoryAgentForCards()` + `refreshScores()`
4. Updates `surveillance_tags.last_checked_at` and appends change_log

**Blackboard vs surveillance:** Blackboard runs all 7 agents sequentially; surveillance only adds new PubMed papers and re-audits those cards.

Poll interval: `src/config/surveillance.ts` · env `NEXT_PUBLIC_SURVEILLANCE_POLL_MS` (default 30s demo / 86400000 daily)

Progress streamed via `/api/surveillance/[id]/stream`.

---

## 14. Regulatory pipeline (Stage 3)

**Trigger:** Opportunity in `act_now` zone → `/opportunity/[id]/regulatory`

1. `POST /api/regulatory/[id]` — assembles `RegulatoryPackage`
   - `buildProvenanceTrail()` — `src/lib/provenance.ts`
   - `versionLockHash()` — content hash for version lock
   - Claude compliance checker (FDA Jan 2025 AI guidance)
   - Saved via `saveRegulatoryPackage()`
2. Client PDF export — `src/lib/regulatoryPdf.ts` (jsPDF 2.5.1)

**Types:** `src/types/RegulatoryPackage.ts`

---

## 15. Spacebase1 Observatory (optional)

Live agent lifecycle broadcast to Spacebase1 intent space.

| File | Role |
|------|------|
| `src/lib/intentSpace/broadcaster.ts` | `broadcastIntentSpaceEvent()` |
| `src/lib/intentSpace/types.ts` | Event types |
| `scripts/spacebase/claim.py` | Claim space → writes `.spacebase/arclightbio/observatory.json` |
| `scripts/spacebase/emit.py` | CLI test event emitter |
| `scripts/spacebase/common.py` | Shared config |

**Env:** `SPACEBASE_ENABLED=true`, `SPACEBASE_WORKSPACE=.spacebase/arclightbio`, `SPACEBASE_AGENT_NAME=arclight`  
**Do NOT** set `SPACEBASE_OBSERVATORY_URL` in `.env.local` (hash stripped by dotenv).  
URL resolved by `GET /api/spacebase/observatory` from claim files.

**Claimed space (current):** `space-72519775-65ca-485c-a6bf-a75ef4f46c9b` · agent label `arclight` · run `python3 scripts/spacebase/claim.py` after token rotation.

---

## 16. Supporting libraries (quick lookup)

| File | Purpose |
|------|---------|
| `src/lib/blackboardRun.ts` | Blackboard orchestration: lock, checkpoint, retry, fail-fast, `scheduleBlackboardRun` |
| `src/lib/blackboard.ts` | Re-exports blackboard public API |
| `src/lib/hypothesis.ts` | Claude hypothesis generation from PubMed seed |
| `src/lib/queryClassifier.ts` | Query tier classification (preclinical/clinical/established) |
| `src/lib/literatureDomains.ts` | Multi-domain parallel search, cross-citation detection |
| `src/lib/targetList.ts` | Parse mechanism agent prioritized targets |
| `src/lib/modalityTypes.ts` | Modality assessment types |
| `src/lib/sessionSummary.ts` | Client-side session summary bullets |
| `src/lib/evidenceTier.ts` | Tier display labels |
| `src/lib/orgContext.ts` | Default org picker logic |
| `src/lib/scoreMaintenance.ts` | `recomputeOpportunityScores()`, `backfillAllOpportunities()`, `backfillEvidenceCardQuality()`, `cleanupExcessChallenges()` |
| `src/lib/regenerateSurveillanceTags.ts` | Admin tag regeneration |
| `src/lib/dashboardMetrics.ts` | Dashboard aggregation |
| `src/lib/dashboardLayout.ts` | Dashboard card layout |
| `src/lib/sessionControl.ts` | Pause/resume; checkpoint-aware resume → `needsBlackboardResume` |
| `src/lib/provenance.ts` | Regulatory provenance trail |
| `src/lib/regulatoryPdf.ts` | Client PDF generation |
| `src/lib/supabase.ts` | Supabase client + config check |
| `src/lib/http.ts` | Shared fetch with timeout/retry |

---

## 17. Environment variables

See `.env.local.example`. Minimum for discovery: **`ANTHROPIC_API_KEY`**.

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Yes | All LLM agents |
| `NCBI_API_KEY` | Recommended | PubMed rate limits |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional | Depth mode |
| `OPENFDA_API_KEY` | Optional | FAERS |
| `LENS_API_KEY` | Optional | Patents + novelty check |
| `NEXT_PUBLIC_SUPABASE_*` | Optional | Persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Server writes |
| `SPACEBASE_ENABLED` | Optional | Observatory |
| `NEXT_PUBLIC_SURVEILLANCE_POLL_MS` | Optional | Poll interval |

---

## 18. Run commands

```bash
cd arclightbio
cp .env.local.example .env.local   # edit keys
npm install
npm run dev                        # http://localhost:3000 — requires Node >= 18.17

npm run build && npm run start     # production
npm run lint
npm test                           # scientific language + blackboard lock/checkpoint
```

**Node note:** Use Node 18.17+ or 20+. On this machine, Homebrew Node 22 at `/opt/homebrew/Cellar/node@22/22.15.0/bin/node`.

**Styles broken after restart:**
```bash
lsof -ti:3000 | xargs kill -9
rm -rf .next && npm run dev
```

---

## 19. Demo test queries (from README)

| Test | Query / context | Verify |
|------|-----------------|--------|
| A | Preclinical (e.g. exosome aging) | Low prior, too-early zone |
| B | Established (e.g. trastuzumab HER2) | High prior, crowded |
| C | Novel subgroup in approved class | Clinical tier, act-now potential |
| D | Competitive crowded space | Commercial saturation |
| E | TTR amyloidosis · rare disease | Orphan pathway |
| F | JAK inhibitor RA · autoimmune chronic | Full v2.0: cross-domain, targets, modality, novelty |

---

## 20. Full source tree index

```
arclightbio/
├── index.md                          ← this file
├── README.md                         ← primary onboarding doc
├── index.md                          ← session-persistent app index (this doc's sibling)
├── issues.md                         ← audit tracker (Phase 1 done; Phases 2–4 open)
├── opportunity_space_build_spec.md   ← original product spec
├── public/arclight_agent_upgrade_spec.md  ← agent v2.0 spec
├── .env.local.example
├── package.json
├── supabase/migrations/001–012*.sql
├── scripts/spacebase/claim.py, emit.py, common.py
└── src/
    ├── app/                          # Next.js routes
    │   ├── page.tsx                  # Dashboard
    │   ├── discover/page.tsx
    │   ├── opportunity/[id]/page.tsx
    │   ├── opportunity/[id]/regulatory/page.tsx
    │   ├── admin/page.tsx
    │   └── api/                      # REST + SSE handlers (see §9)
    ├── agents/                       # Blackboard agents (see §4)
    │   └── stage1/                   # Legacy autonomous anchors
    ├── api/                          # External API wrappers (see §10)
    ├── components/
    │   ├── layout/
    │   ├── opportunity/              # Session UI (see §11)
    │   ├── dashboard/
    │   ├── regulatory/
    │   ├── org/
    │   └── ui/                       # shadcn primitives
    ├── hooks/                        # Client hooks (see §12)
    ├── lib/                          # Core logic (see §3, §6, §13, §16)
    ├── store/                        # Zustand (see §12)
    ├── types/                        # TypeScript types (see §8)
    └── config/surveillance.ts
```

---

## 21. Scientific language standard

Agent-generated text (hypothesis, evidence cards, de-risk recommendations, regulatory LLM fields) follows a centralized biomedical writing standard.

| Component | File | Role |
|-----------|------|------|
| Rules + sanitizer | `src/lib/scientificLanguage.ts` | `SCIENTIFIC_WRITING_RULES`, `sanitizeScientificClaim()`, `sanitizeHypothesisFields()` |
| Global LLM injection | `src/api/anthropic.ts` | All `callAgent` / `callAgentJson` calls append rules via `withScientificWritingRules()` |
| Storage choke point | `src/lib/db.ts` → `insertEvidenceCard()` | Sanitizes `content` and `derisk_recommendation` before persist |
| Tests | `src/lib/scientificLanguage.test.ts`, `src/lib/blackboardRun.test.ts` | Run `npm test` |

**Key rules:** distinguish target vs intervention vs drug vs indication; never "{TARGET} is approved" without intervention class; use agonist/inhibitor/modulator nouns; hedge inferential claims; preserve valid mechanistic terms (e.g. reverse agonism).

**Out of scope:** UI zone labels ("Act Now"), `sessionSummary.ts`, surveillance status strings.

---

## 22. Where to look for common tasks

| Task | Start here |
|------|------------|
| Add a new agent | Copy pattern from `src/agents/*.ts`, register step in `src/lib/blackboardRun.ts` |
| Change blackboard lifecycle | `src/lib/blackboardRun.ts`, `src/lib/sessionControl.ts` |
| Debug session failures | `.data/blackboard-errors.log`, opportunity `blackboard_state`, status `agents_failed` |
| Track known bugs / fix phases | [`issues.md`](issues.md) |
| Change scoring | `src/lib/scoring.ts`, `src/lib/indicationRisk.ts` |
| Change domain behavior | `src/lib/domainContext.ts`, agent system prompts |
| Add API endpoint | `src/app/api/` + optional wrapper in `src/api/` |
| Change opportunity UI | `src/app/opportunity/[id]/page.tsx` + `src/components/opportunity/` |
| Fix persistence | `src/lib/db.ts`, `src/lib/fileStore.ts`, or Supabase migrations |
| Debug live updates | `src/app/api/stream/[id]/route.ts`, `src/hooks/useOpportunityStream.ts` |
| Regulatory export | `src/app/api/regulatory/[id]/route.ts`, `src/lib/regulatoryPdf.ts` |
| Admin maintenance | `src/app/admin/page.tsx`, `src/app/api/admin/` |

---

## 23. Audit issues & fix phases

Consolidated pipeline audit in [`issues.md`](issues.md). Work **Phase 1 → 4** in order.

| Phase | Focus | Status |
|-------|--------|--------|
| **1** | Session integrity (lock, checkpoint, retry, SSE, org fallback) | **Done** — P1-001–P1-012 |
| **2** | Evidence accuracy (target resolution, filter honesty, LLM fallbacks) | Open (28 issues) |
| **3** | Score trust (challenge penalty, crowded-market inflation) | Open (15 issues) |
| **4** | Stream, UI & persistence (SSE reconnect, fetch races, localStorage drift) | Open (35 issues; partial overlap with P1 SSE) |

**Recommended next:** P3-001 (challenge penalty math) → P2-003/004/005/007 → P2-001/002 → Phase 4 remainder.

---

*Generated for session persistence. Last indexed: June 2026 (Phase 1 session integrity + Spacebase claim).*
