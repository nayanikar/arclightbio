# Arclight Bio — Audit Issues

> **Created:** June 2026 · **Source:** Full pipeline audit (blackboard/agents, API/data layer, external APIs/UI)  
> **Goal:** Fix in phase order so discovery output becomes **reliable, accurate, and trustworthy**.  
> **Status:** **Phase 1 complete** (12/12). **V2 Core IDEA** — 37/41 fixed. **Wave 4 Decision Grade** — 9/14 done (June 2026). Phases 2–4 v1 items remain for reference.

**North star:** Produce a **board-ready Decision Brief** per v2 session — Pursue / Watch / Kill / Partner with TPP tiers, next proof point, risks, and portfolio fit — not just confidence scores.

---

## How to use this file

- **V2 discovers only:** Start with **§ V2 Core IDEA Audit**, then **§ Wave 4 — Decision Grade** for pharma actionability work.
- Work through **Phase 1 → 4** for v1 maintenance and shared-agent fixes that v2 reuses.
- Each issue has an ID (`P1-001`, `V2-001`, etc.) for commits/PRs.
- **Severity:** `critical` · `high` · `medium` · `low`
- Mark fixed issues by changing `[ ]` to `[x]`.

---

## Summary

| Phase | Focus | Issues | Status |
|-------|--------|--------|--------|
| **1** | Session integrity | 12 | **Done** — P1-001–P1-012 |
| **2** | Evidence accuracy (shared agents) | 28 | **Partial** — 7/28 fixed |
| **3** | Score trust | 15 | **Partial** — P3-001, P3-002/003/005/006 fixed (Wave 4) |
| **4** | Stream, UI & persistence | 35 | Open |
| **V2** | Core IDEA — multi-hypothesis pipeline | 41 | **37/41 fixed** |
| **W4** | Decision Grade — pharma actionability | 14 | **9/14 done** (June 2026) |

---

## Wave 4 — Decision Grade (pharma actionability)

*Goal: decisions from Arclight must be **actionable for pharma BD/strategy** — explicit recommendation, TPP, next funded experiment, risks with provenance, portfolio fit. Industry alignment: [IQVIA TPP framework](https://www.iqvia.com/blogs/2025/05/maximizing-drug-development-success), [McKinsey asset diagnostic](https://www.mckinsey.com/industries/life-sciences/our-insights/charting-the-path-to-patients).*

**Usability target:** Move from **6/10 ideation** → **8/10 decision support** on fresh v2 runs.

### Target artifact — Decision Brief

Every completed v2 session should persist and display:

| Field | Purpose |
|-------|---------|
| `recommendation` | pursue / watch / kill / partner |
| `recommendation_rationale` | 3–5 evidence-linked sentences |
| `tpp` | minimum / base / aspirational product profile |
| `differentiation` | vs standard of care + outgroup |
| `critical_risks` | top risks with `evidence_card_ids` |
| `derisk_plan` | top 3 de-risk studies (from regulatory challenges) |
| `next_proof_point` | study type, endpoint, N, timeline, cost band |
| `portfolio_fit` | TA overlap + modality vs org context |
| `calibration_caveat` | forced when `scale_unreliable` |

**Hard rule:** If outgroup calibration is `scale_unreliable`, cap recommendation at **watch**.

### Wave 4 issues

#### Phase A — Score trust (foundation)

- [x] **W4-001** · `critical` · **Commercial saturation raised actionability** *(P3-002)*  
  **Fixed June 2026:** Crowded-market signal now **−0.15** actionability modifier in `scoring.ts`.

- [x] **W4-002** · `critical` · **High trial count raised actionability** *(P3-003)*  
  **Fixed June 2026:** `activeTrialCount > 15` now **−0.10** modifier (competitive indication penalty).

- [x] **W4-003** · `high` · **Placeholder/failure cards inflate scores** *(P3-005, P3-010)*  
  **Fixed June 2026:** `scoringCardFilter.ts` — `isScorableEvidenceCard` excludes partial, filter_failed, failure copy, regulatory summaries from confidence/actionability.

- [x] **W4-004** · `high` · **Confidence bonus for crowded trials** *(P3-006)*  
  **Fixed June 2026:** `relevantTrialCount > 10` now **−0.05** (was +0.08).

#### Phase B — Decision synthesis (pipeline brain)

- [x] **W4-005** · `critical` · **`stage3:evaluate` cross-hypothesis comparison** *(V2-023 partial)*  
  **Fixed June 2026:** `stage3CrossHypothesisEvaluate` stores comparison summary in `blackboard_state`.

- [x] **W4-006** · `critical` · **Decision synthesis agent after stage 4** *(V2-023)*  
  **Fixed June 2026:** `decisionSynthesisAgent.ts` — LLM brief with evidence IDs; caps pursue when calibration unreliable.

- [x] **W4-007** · `critical` · **Persist `decision_brief` on opportunity**  
  **Fixed June 2026:** Migration `014_decision_brief.sql`; `OpportunityObject.decision_brief` jsonb.

#### Phase C — Decision Brief UI

- [x] **W4-008** · `high` · **DecisionBriefPanel hero on v2 page**  
  **Fixed June 2026:** Recommendation chip, TPP tiers, next proof point, risks, portfolio fit on `OpportunityPageV2`.

- [x] **W4-009** · `high` · **Portfolio fit pre-computation**  
  **Fixed June 2026:** `portfolioFit.ts` — TA overlap + modality vs `OrganizationContext.portfolio`.

- [ ] **W4-010** · `medium` · **PDF / shareable export of Decision Brief**  
  **Files:** `DecisionBriefPanel.tsx`, `jspdf` (dependency present, unused)  
  BD teams need email/data-room export.

#### Phase D — Completeness & polish

- [ ] **W4-011** · `medium` · **Remaining score-trust backlog** *(P3-004, P3-007–P3-014)*  
  Speed-mode regulatory false challenges, modality hardcoded quality, indication_type defaults, etc.

- [ ] **W4-012** · `medium` · **v2 regulatory page scoped to top hypothesis + brief provenance**  
  **Files:** `regulatory/page.tsx`, `api/regulatory/[id]/route.ts`  
  Regulatory assembly still v1 session-level.

- [ ] **W4-013** · `medium` · **Novelty without target list** *(V2-041)*  
  **Files:** `clinicalTrialAgent.ts` — mechanism-only theses get FIC assessment on statement.

- [ ] **W4-014** · `low` · **Tier 3 UI polish** *(V2-030–V2-032)*  
  FIC claim persistence, outgroup source labels, v1 copy cleanup.

### Wave 4 exit criteria (fresh v2 run rubric)

| Criterion | Pass? |
|-----------|-------|
| BD lead explains recommendation in 60 seconds | |
| Next study specific enough to scope with a CRO | |
| TPP distinguishes min vs aspirational | |
| Risks linked to evidence card IDs | |
| Calibration downgrades pursue → watch when unreliable | |

### Wave 4 implementation order (remaining)

1. **W4-013** — novelty without targets (differentiation signal)  
2. **W4-010** — PDF export  
3. **W4-011** — remaining P3 score fixes  
4. **W4-012** — v2 regulatory scope  
5. **W4-014** — V2-030–032 polish  

---

## Phase 1 — Session integrity

*Sessions must complete honestly. Partial or failed runs must not look finished.*

### Critical

- [x] **P1-001** · `critical` · **Blackboard killed after discover response**  
  **Files:** `src/app/api/discover/route.ts`  
  `runBlackboard()` is fire-and-forget with no `await` / `waitUntil`. On serverless, the handler can exit after the JSON response and abort the agent pipeline before evidence is written.

- [x] **P1-002** · `critical` · **Resume skips remaining agents**  
  **Files:** `src/lib/sessionControl.ts`, `src/lib/blackboard.ts`, `src/app/opportunity/[id]/page.tsx`  
  Pause during `agents_running` (including “Stop agents”) sets `paused`; blackboard exits early. `resumeOpportunity` always sets `surveillance`, so remaining agents never run while UI shows “Watching”.

- [x] **P1-003** · `critical` · **Failed agents do not stop the pipeline**  
  **Files:** `src/lib/blackboard.ts`  
  `runTrackedAgent` catches errors, emits `agent_failed` to Spacebase, and continues. Blackboard still sets `surveillance` as if discovery completed.

- [x] **P1-004** · `critical` · **Blackboard re-runs append duplicate evidence**  
  **Files:** `src/lib/db.ts`, `src/app/api/blackboard/[id]/route.ts`, `src/app/api/surveillance/route.ts`  
  No dedup or clear before insert. Overlapping `runBlackboard` calls (discover + manual re-run + batch) interleave inserts and distort scores.

### High

- [x] **P1-005** · `high` · **No per-opportunity blackboard lock**  
  **Files:** `src/lib/blackboard.ts`, `src/app/api/discover/route.ts`  
  Parallel blackboard runs on the same opportunity can race inserts and score updates.

- [x] **P1-006** · `high` · **Blackboard failure leaves session stuck in `agents_running`**  
  **Files:** `src/app/api/discover/route.ts`, `src/lib/blackboard.ts`  
  Top-level failures are only `console.error`’d. No terminal/error status; SSE never completes.

- [x] **P1-007** · `high` · **Agent failures invisible on discovery SSE**  
  **Files:** `src/lib/blackboard.ts`, `src/hooks/useOpportunityStream.ts`, `src/app/api/stream/[id]/route.ts`  
  `agent_failed` is broadcast to Spacebase only, not the `/api/stream` channel the opportunity page listens to.

- [x] **P1-008** · `high` · **Default org ID missing in Supabase**  
  **Files:** `src/app/api/discover/route.ts`, `src/lib/db.ts`  
  When `listOrgContexts()` is empty, discover falls back to in-memory `DEFAULT_ORG_CONTEXTS[0].id`, but `getOrgContext` queries Supabase and returns 404 (seeded org rows use auto-generated UUIDs).

- [x] **P1-009** · `high` · **SSE treats `paused` as stream complete**  
  **Files:** `src/app/api/stream/[id]/route.ts`  
  Clients receive `complete` when status is `paused`, even if agents never finished — discovery appears done prematurely.

### Medium

- [x] **P1-010** · `medium` · **Pause API failures not surfaced**  
  **Files:** `src/hooks/useSurveillanceSessionControls.ts`  
  Non-OK pause responses return silently; local state may diverge from server.

- [x] **P1-011** · `medium` · **Blackboard passes stale opportunity snapshot to agents**  
  **Files:** `src/lib/blackboard.ts`  
  Literature, mechanism, clinical trial, commercial, and RWE agents share the initial `obj`; only modality refetches mid-run.

- [x] **P1-012** · `medium` · **`refreshScores` exits silently without org context**  
  **Files:** `src/lib/blackboard.ts`  
  If `getOrgContext` returns null, scoring returns without updating — stale confidence/actionability during agent runs.

### Phase 1 — what shipped (June 2026)

| Area | Implementation |
|------|----------------|
| **Orchestration** | New [`src/lib/blackboardRun.ts`](src/lib/blackboardRun.ts) — lock, checkpoint, retry-once, fail-fast; [`src/lib/blackboard.ts`](src/lib/blackboard.ts) re-exports public API |
| **Scheduler** | `scheduleBlackboardRun()` uses `@vercel/functions` `waitUntil` on Vercel; detached promise locally ([`discover/route.ts`](src/app/api/discover/route.ts)) |
| **Failure policy** | Each agent retried once; second failure → `agents_failed`, `[SERIOUS]` log at `.data/blackboard-errors.log`, pipeline stops |
| **Checkpoint / resume** | `blackboard_state.completedSteps` on opportunity; pause mid-run saves progress; resume continues remaining agents ([`sessionControl.ts`](src/lib/sessionControl.ts)) |
| **Lock** | Per-opportunity in-process + file lock (`.data/locks/`) — rejects concurrent runs |
| **SSE** | New events: `agent_status`, `failed`, `paused` (mid-agents); [`stream/[id]/route.ts`](src/app/api/stream/[id]/route.ts) |
| **UI** | `agents_failed` status, failure banner, pause/resume error messages ([`OpportunityHeader`](src/components/opportunity/OpportunityHeader.tsx), opportunity page) |
| **Org fallback** | `getOrgContext` / `listOrgContexts` fall back to demo orgs when Supabase empty ([`db.ts`](src/lib/db.ts)) |
| **Batch surveillance** | `POST /api/surveillance` no longer re-runs full blackboard (was duplicating cards) |
| **Schema** | Migration `012_blackboard_state.sql` — `blackboard_state jsonb` on `opportunity_objects` |
| **Tests** | [`src/lib/blackboardRun.test.ts`](src/lib/blackboardRun.test.ts) — lock + checkpoint helpers |

---

## Phase 2 — Evidence accuracy

*Cards and claims must reflect the user's query. Failures must not masquerade as findings.*

> **V2 applicability (June 2026):** Shared stage-3 agents still hit v2. **Fixed in v2:** P2-003, P2-004, P2-005, P2-007 (partial P2-009). **Still applies to v2:** P2-001, P2-002, P2-006, P2-010–P2-028 (except P2-008). **v1-only:** P2-008 (v2 uses `modalityGateAgent`, always posts a card). **v2-only gaps:** see § V2 Core IDEA Audit (stage-1 literature tagging, per-hypothesis commercial query, calibration logic).

### High

- [ ] **P2-001** · `high` · **Open Targets uses first search hit only**  
  **Files:** `src/api/openTargets.ts`, `src/agents/mechanismAgent.ts`  
  `hits[0].id` is always used. Condition-heavy or ambiguous queries resolve to the wrong gene → wrong associations and target lists.

- [ ] **P2-002** · `high` · **Naive keyword extraction drives downstream agents**  
  **Files:** `src/lib/hypothesis.ts`  
  `extractKeywords` splits on whitespace/punctuation. Mechanism, clinical trial, RWE, and commercial agents get wrong drug/condition terms.

- [x] **P2-003** · `high` · **Literature LLM fallback bypasses relevance filter**  
  **Files:** `src/agents/literatureAgent.ts` (~369–375)  
  On JSON failure, raw paper titles become evidence claims with no indication-specificity check.

- [x] **P2-004** · `high` · **Wrong paper attached on PMID mismatch**  
  **Files:** `src/agents/literatureAgent.ts` (~379)  
  `papers.find(p => p.pmid === output.pmid) ?? papers[0]` links claim text to unrelated paper metadata/URL.

- [x] **P2-005** · `high` · **Mechanism filter fail-closed looks like true negative**  
  **Files:** `src/agents/mechanismAgent.ts` (~68–76, 213–228)  
  LLM/API errors return `[]` and insert “no pathway overlap” message — indistinguishable from genuinely empty Open Targets results.

- [ ] **P2-006** · `high` · **Mechanism query defaults to `"TTR"`**  
  **Files:** `src/agents/mechanismAgent.ts` (~177)  
  When keyword extraction fails, unrelated hypotheses get transthyretin mechanism evidence.

- [x] **P2-007** · `high` · **Clinical trial relevance filter fail-closed**  
  **Files:** `src/agents/clinicalTrialAgent.ts` (~106–118, 319–321)  
  Filter errors return `[]`; card copy implies zero hypothesis-relevant trials when the filter never ran.

- [ ] **P2-008** · `high` · **Modality agent silent no-op** *(v1-only)*  
  **Files:** `src/agents/modalityAgent.ts` (~35–36), `src/lib/blackboard.ts`  
  No `is_target_list` card → modality returns with no card and no user-visible failure. **v2:** uses `modalityGateAgent` per hypothesis (different failure mode — see V2-011).

- [x] **P2-009** · `high` · **First-in-class fallback can assert FIC from empty APIs** *(partial — v2 still at risk when APIs succeed empty)*  
  **Files:** `src/agents/clinicalTrialAgent.ts` (~235–248)  
  On LLM failure, zero FDA/trials yields `is_first_in_class: true` at 50% confidence.

- [ ] **P2-010** · `high` · **PubMed failures abort surveillance scan**  
  **Files:** `src/lib/surveillance.ts`  
  Uncaught `searchPubMed` in the concept-tag loop terminates the whole SSE scan instead of recording a failed step.

### Medium

- [x] **P2-011** · `medium` · **Hypothesis LLM failure yields unmarked generic hypothesis** *(v1 `hypothesis.ts` fixed; v2 stage-1 still open — V2-003)*  
  **Files:** `src/lib/hypothesis.ts` (~49–55)  
  Fallback text reads like a grounded hypothesis; discover succeeds with placeholder content.

- [ ] **P2-012** · `medium` · **Commercial/patent search uses first query token only**  
  **Files:** `src/agents/commercialAgent.ts` (~26, 35)  
  Multi-word hypotheses get IP/FAERS signals for one token (e.g. “JAK” only).

- [ ] **P2-013** · `medium` · **RWE agent uses brittle drug term**  
  **Files:** `src/agents/rweSignalAgent.ts` (~14, 52)  
  `interventions[0] ?? conditions[0] ?? first word` often queries FAERS for the wrong product.

- [ ] **P2-014** · `medium` · **Cross-domain cards posted before main relevance filter**  
  **Files:** `src/agents/literatureAgent.ts` (~344–367)  
  Speculative cross-domain evidence can appear even when filtered literature output is empty.

- [ ] **P2-015** · `medium` · **Cross-domain cards accept unvalidated PMIDs**  
  **Files:** `src/lib/literatureDomains.ts`, `src/agents/literatureAgent.ts`  
  LLM `supporting_papers` are not checked against retrieved papers.

- [ ] **P2-016** · `medium` · **Cross-domain detection fails silently**  
  **Files:** `src/lib/literatureDomains.ts` (~161–163)  
  LLM errors return `[]` with no signal — core FIC/oncology value lost.

- [ ] **P2-017** · `medium` · **Clinical “trial gap” uses broad trial counts**  
  **Files:** `src/agents/clinicalTrialAgent.ts` (~289–301, 322–323)  
  `gapFlag` uses total retrieved trials, not hypothesis-filtered trials — overstates gaps.

- [ ] **P2-018** · `medium` · **Surveillance relevance filter drops all papers on error**  
  **Files:** `src/lib/surveillance.ts`  
  `filterSurveillancePapers` returns `[]` on Claude/JSON failure → “0 relevant” instead of filter failure.

- [ ] **P2-019** · `medium` · **Surveillance cards use paper title as content**  
  **Files:** `src/lib/surveillance.ts` (~420)  
  `buildPubMedEvidenceCard(paper, paper.title, …)` — not synthesized claims.

- [ ] **P2-020** · `medium` · **OpenFDA approval search swallows errors**  
  **Files:** `src/api/openFda.ts`  
  HTTP errors return `[]`; novelty/FDA steps proceed as if no approvals exist.

- [ ] **P2-021** · `medium` · **FDA approval records ignore searched indication**  
  **Files:** `src/api/openFda.ts`  
  Caller’s `indication` string injected into every result without label validation.

- [ ] **P2-022** · `medium` · **PubMed / trial count helpers ignore HTTP status**  
  **Files:** `src/api/pubmed.ts`, `src/api/clinicalTrials.ts`  
  `getPubMedCount` / `getTrialCount` parse JSON without checking `res.ok` — nonsense gap/ratio metrics.

- [ ] **P2-023** · `medium` · **Lens patent search is title phrase-only**  
  **Files:** `src/api/lens.ts`  
  `match_phrase` on title misses abstract/claim hits; often returns zero for valid queries. **Note:** invalid `include` field (`publication_date`) fixed June 2026 → `date_published`.

- [ ] **P2-024** · `medium` · **`competitive_position` from commercial LLM discarded**  
  **Files:** `src/agents/commercialAgent.ts` (~44–54)  
  Only `content` is stored; structured commercial assessment is lost.

### Low

- [ ] **P2-025** · `low` · **Semantic Scholar related-paper ID format may 404**  
  **Files:** `src/agents/literatureAgent.ts`  
  Depth mode uses `PMID:${pmid}`; S2 may expect a different paperId format.

- [ ] **P2-026** · `low` · **PubMed XML parsing is brittle**  
  **Files:** `src/api/pubmed.ts`  
  Non-greedy block splitting and generic `<Title>` matching can skip articles or pick wrong fields.

- [ ] **P2-027** · `low` · **Stage1 auto-discovery always uses Pfizer demo org**  
  **Files:** `src/agents/stage1/thresholdFilter.ts`  
  Autonomous anchors ignore user org context for hypothesis and scoring.

- [ ] **P2-028** · `low` · **Parallel PubMed calls without NCBI key**  
  **Files:** `src/agents/literatureAgent.ts`  
  `Promise.allSettled` over anchor + expanded domains can exceed anonymous rate limits → silent empty domains marked `partial`.

---

## V2 Core IDEA Audit — June 2026

*Multi-hypothesis discovery: candidates → modality gate → per-hypothesis evaluation → rank + outgroup calibration → surveillance. Audited via code review + live v2 sessions (`70cc471b-…`, `01601ff5-…`).*

**Core IDEA health (June 2026):** Pipeline runs end-to-end with hypothesis-scoped dossiers. **Wave 4 adds Decision Brief** (pursue/watch/kill/partner + TPP + next proof point). **Still open:** PDF export, remaining P3 score fixes, v2 regulatory scope, novelty-without-targets (V2-041). Treat pre-Wave-4 sessions as ideation-only until re-run.

### Critical

- [x] **V2-001** · `critical` · **Outgroup calibration condition is inverted**  
  **Files:** `src/lib/hypothesisRanking.ts`, `src/lib/hypothesisRanking.test.ts`  
  **Fixed June 2026:** `calibrated` when outgroup confidence is **lower** than novel median (or outgroup has more challenges).

- [x] **V2-002** · `critical` · **Stage 1 literature excluded from per-hypothesis scoring**  
  **Files:** `src/lib/db.ts`, `src/lib/blackboardRunV2.ts`, `OpportunityPageV2.tsx`  
  **Fixed June 2026:** `getSharedStage1LiteratureCards` merged into `refreshHypothesisScores`; shared literature visible in hypothesis-scoped UI trail.

- [x] **V2-003** · `critical` · **Commercial/RWE agents use session query, not per-hypothesis terms**  
  **Files:** `src/agents/commercialAgent.ts`, `src/agents/rweSignalAgent.ts`, `src/lib/hypothesisContext.ts`  
  **Fixed June 2026:** `resolveAgentQuery` / `resolveAgentKeywords` prefer hypothesis statement for v2.

### High — pipeline orchestration

- [x] **V2-004** · `high` · **Stage 1 candidates not grounded in retrieved literature**  
  **Files:** `src/agents/literatureStage1Agent.ts`  
  **Fixed June 2026:** Candidate LLM prompt includes retrieved literature card summaries.

- [x] **V2-005** · `high` · **Stage 1 LLM failure → silent synthetic hypothesis**  
  **Files:** `src/agents/literatureStage1Agent.ts`  
  **Fixed June 2026:** Fallback candidates stored with `source: "fallback"`.

- [x] **V2-006** · `high` · **v2 blackboard ignores pause mid-run**  
  **Files:** `src/lib/blackboardRunV2.ts`  
  **Fixed June 2026:** `checkBlackboardPaused` polled between stages/agents.

- [x] **V2-007** · `high` · **Stage 2 / outer fatal errors leave `agents_running`**  
  **Files:** `src/lib/blackboardRunV2.ts`  
  **Fixed June 2026:** Stage 2 try/catch + fatal handler set `agents_failed`.

- [x] **V2-008** · `high` · **Checkpoint `force` / re-run can duplicate hypotheses**  
  **Fixed June 2026:** `force && !resume` clears hypotheses, checkpoints, and top hypothesis before restart.

- [x] **V2-009** · `high` · **Opportunity root scores ≠ top hypothesis after stage 4**  
  **Fixed June 2026:** v2 regulatory skips `refreshScores`; `syncTopHypothesisToOpportunity` after surveillance.

- [x] **V2-010** · `high` · **Shared agent accuracy chain still poisons v2** *(cross-ref P2-001, P2-002, P2-006)*  
  **Fixed June 2026:** Improved `extractKeywords`, `pickBestTargetHit` in Open Targets, removed `"TTR"` default; mechanism uses `resolveAgentKeywords`.

### High — UI honesty (v2-only)

- [x] **V2-011** · `high` · **Global ScoreStrip while non-top hypothesis selected**  
  **Files:** `OpportunityPageV2.tsx`  
  **Fixed June 2026:** ScoreStrip binds to selected hypothesis confidence/zone.

- [x] **V2-012** · `high` · **Ranks, calibration, top hypothesis do not update live**  
  **Files:** `useOpportunityStream.ts`, `opportunityStore.ts`  
  **Fixed June 2026:** SSE `complete` dispatches `SESSIONS_UPDATED_EVENT`; `setOpportunity` rebuilds v2 card/hypothesis state from API.

- [x] **V2-013** · `high` · **Hydrated challenges drop `hypothesis_id`**  
  **Files:** `opportunityStore.ts`  
  **Fixed June 2026:** `buildStreamingCardsFromOpportunity` preserves hypothesis_id on challenge cards.

- [x] **V2-014** · `high` · **Duplicate SSE connections on v2 pages**  
  **Files:** `OpportunityPageV2.tsx`, `page.tsx`  
  **Fixed June 2026:** Single stream hook in parent; v2 receives `reconnect` prop only.

### Medium — pipeline & evidence

- [x] **V2-015** · `medium` · **Modality gate LLM failure → silent defaults**  
  **Fixed June 2026:** `modality_fallback` + `partial` metadata; explicit unverified copy.

- [x] **V2-016** · `medium` · **Outgroup LLM failure → auto-generated control**  
  **Fixed June 2026:** Outgroup catch sets `source: "fallback"`.

- [x] **V2-017** · `medium` · **Stage 1 literature contradicts ranked thesis without reconciliation**  
  **Fixed June 2026:** `literatureReconciliation.ts` emits reconciliation card after stage 4 when shared literature contradicts top hypothesis; `EvidenceStreamRail` shows Reconciliation badge.

- [x] **V2-018** · `medium` · **Commercial/RWE lack filter-honesty layer** *(cross-ref P2-012, P2-013)*  
  **Fixed June 2026:** Commercial prefixes sparse-data copy; `partial` metadata when APIs empty.

- [x] **V2-019** · `medium` · **Regulatory challenges templated — calibration non-discriminating**  
  **Fixed June 2026:** Hypothesis- and card-specific challenge text; asymmetric caps (novel 2, outgroup 5); quality-weighted score impact; higher outgroup threshold (0.68).

- [x] **V2-020** · `medium` · **FIC novelty overstates when prior art exists**  
  **Fixed June 2026:** Novelty fallback treats FDA/patents/trials as prior art → `not_first_in_class`.

- [x] **V2-021** · `medium` · **Session summary cards scoped; scores still global** *(partial — see V2-034)*  
  **Fixed June 2026 (partial):** `SessionSummaryPanel` accepts scoped `cards` prop in v2 page. Confidence/zone bullets still read global store, not selected hypothesis.

- [x] **V2-022** · `medium` · **Resume metadata uses v1 step names**  
  **Fixed June 2026:** v2 uses `isBlackboardV2PausedMidRun`; empty `agents_reinitiated` for v2 resume.

- [x] **V2-023** · `medium` · **`stage3:evaluate` is a no-op checkpoint**  
  **Fixed June 2026 (Wave 4):** `stage3CrossHypothesisEvaluate` + `decisionSynthesisAgent` after stage 4; persists `decision_brief`.

- [x] **V2-024** · `medium` · **`refreshHypothesisScores` silent no-op without org**  
  **Fixed June 2026:** Warns when org context missing.

### Medium — UI

- [x] **V2-025** · `medium` · **`paused` SSE does not update header status**  
  **Fixed June 2026:** `paused` SSE handler sets status to `paused`.

- [x] **V2-026** · `medium` · **`selectedId` frozen after first paint**  
  **Fixed June 2026:** `useEffect` follows `top_hypothesis_id` from live store.

- [x] **V2-027** · `medium` · **No v2 agent progress UI**  
  **Fixed June 2026:** Agent status banner during `agents_running`.

- [x] **V2-028** · `medium` · **Partial / filter-failed badges hidden in collapsed trail**  
  **Fixed June 2026:** Collapsed rows show Partial badge.

### Low

- [x] **V2-029** · `medium` · **Placeholder hypothesis used for stage 1 relevance filter**  
  **Fixed June 2026:** `stage1LiteratureHypothesis(query)` anchors stage-1 literature filter on search query, not placeholder text.

- [ ] **V2-030** · `low` · **`first_in_class_claim` generated but not persisted**  
  **Files:** `literatureStage1Agent.ts`, migration `013_v2_hypotheses.sql`  
  **Fix order:** Tier 3

- [ ] **V2-031** · `low` · **Outgroup / calibration source not labeled in detail panel**  
  **Files:** `HypothesisPanel.tsx`, `HypothesisDetailPanel.tsx`  
  **Fix order:** Tier 3

- [ ] **V2-032** · `low` · **v1 copy bleed (“Named hypothesis”, global evidence tier)**  
  **Files:** `HypothesisPanel.tsx`, `OpportunityPageV2.tsx`  
  **Fix order:** Tier 3

### Wave 3 — Pipeline deliverability audit (June 2026)

*Live v2 session `01601ff5-…`: pipeline completed (35 steps, 6 hypotheses, 76 cards) but UI, calibration, and dashboard still misrepresent output. **Usability score: 6/10** — good for ideation, not go/no-go.*

#### High — UI honesty & live state

- [x] **V2-033** · `high` · **Evidence trail hides shared stage-1 literature**  
  **Fixed June 2026:** `EvidenceStreamRail` uses shared `cardVisibleForHypothesis` helper.

- [x] **V2-034** · `high` · **SessionSummaryPanel scores not hypothesis-scoped**  
  **Fixed June 2026:** v2 passes `confidenceScore` / `actionabilityZone` from selected hypothesis.

- [x] **V2-038** · `high` · **Outgroup scores higher than novel — mechanism card inflation**  
  **Fixed June 2026:** Outgroup capped to 1 pathway card in `mechanismAgent`; scoring uses `evidenceCardsForHypothesisScoring`.

- [x] **V2-040** · `high` · **SSE does not stream hypothesis rank updates during `agents_running`**  
  **Fixed June 2026:** SSE `score` events include v2 hypothesis snapshots; store merges per-hypothesis scores live.

#### Medium — dashboard, API, evidence gaps

- [x] **V2-035** · `medium` · **Dashboard v1-blind — no v2 badge, hypothesis count, pipeline status**  
  **Fixed June 2026:** `OpportunityMetaBadges` on featured, secondary, and list rows (v2 badge, hypothesis count, Running/Failed chips).

- [x] **V2-036** · `medium` · **Dashboard slots sort by confidence — new sessions buried**  
  **Fixed June 2026:** `selectDashboardSlots` uses `sortByRecencyDesc` so fresh sessions surface in featured/secondary slots.

- [x] **V2-037** · `medium` · **`listOpportunityObjects` omits v2 hypotheses for dashboard cards**  
  **Fixed June 2026:** Batch-fetch hypotheses; `applyTopHypothesisListSummary` overlays top-hypothesis statement and scores on list rows.

- [x] **V2-039** · `medium` · **`GET /api/opportunity/[id]/status` stale vs detail**  
  **Fixed June 2026:** Status snapshot resolves top hypothesis by rank/outgroup fallback when `top_hypothesis_id` unset; confidence/zone match detail page.

- [ ] **V2-041** · `medium` · **No FIC/novelty card when mechanism produces no target list**  
  **Files:** `clinicalTrialAgent.ts`, `targetList.ts`  
  **Fix order:** Tier 3  
  **Cross-ref:** V2-020 (prior-art fallback when novelty runs); P4-035.  
  `firstInClassNoveltyCheck` only when ranked targets exist — **0 novelty cards on 5 novel hypotheses** on live session.

> **Wave 1–2 backlog** (fix tiers on original entries above): V2-023, V2-030–V2-032.

### V2 deliverability — what works (June 2026 audit)

| Area | Status |
|------|--------|
| Discover → v2 only | `createOpportunityObjectV2` + `scheduleBlackboardRunV2` |
| Full pipeline completion | 35 checkpoint steps including surveillance (live session verified) |
| Hypothesis portfolio | 5 distinct novel theses + 1 outgroup control (not duplicates) |
| Stage 3 hypothesis isolation | `runWithHypothesisContext` + `hypothesis_id` on stage-3 cards |
| Per-hypothesis commercial queries | Distinct `searchTerm` per hypothesis (not session query) |
| Modality declarations | Per-hypothesis modality + pathway in DB and ranked list UI |
| Stage 4 ranking + sync | Ranks persist; root scores synced to top hypothesis (V2-009) |
| Calibration honesty banner | `OutgroupCalibrationBanner` shows `scale_unreliable` when appropriate |
| Filter honesty (mechanism/clinical/lit) | Wave 1–2 fixes apply in v2 stage 3 |
| Lightweight status polling | `GET /api/opportunity/[id]/status` (~2.6 KB; fix staleness in V2-039) |
| Lens API client | `date_published` include fixed (June 2026) |

---

## Phase 3 — Score trust

*Confidence and actionability must reflect evidence quality, not placeholders or inverted heuristics.*

### Critical

- [x] **P3-001** · `critical` · **Challenge penalties divided by 100**  
  **Files:** `src/lib/scoring.ts` (~83–85), `src/agents/regulatoryAgent.ts` (~257–258)  
  `score_impact` is stored as ~0.04–0.15 but penalized as `score_impact / 100`. UI shows “−5% confidence” while confidence barely moves.

### High

- [x] **P3-002** · `high` · **Commercial saturation raises actionability** *(W4-001)*  
  **Fixed June 2026:** Crowded-market signal now **−0.15** actionability modifier.

- [x] **P3-003** · `high` · **High trial count increases actionability** *(W4-002)*  
  **Fixed June 2026:** High trial count now **−0.10** actionability modifier.

- [ ] **P3-004** · `high` · **Speed mode forces spurious regulatory challenges**  
  **Files:** `src/agents/regulatoryAgent.ts` (~447, 280–281, 505–506)  
  `fullAudit` is false for `mode === "speed"`, so replication stays at 0.4 (below challenge threshold) and weak cards get challenged.

- [x] **P3-005** · `high` · **Placeholder/failure cards inflate scores** *(W4-003)*  
  **Fixed June 2026:** `scoringCardFilter.ts` excludes non-scorable cards from confidence/actionability.

- [x] **P3-006** · `medium` · **Confidence saturation bonus for crowded trials** *(W4-004)*  
  **Fixed June 2026:** High trial count now applies **−0.05** confidence adjustment.

- [ ] **P3-007** · `medium` · **Modality card quality hardcoded high**  
  **Files:** `src/agents/modalityAgent.ts` (~96–104)  
  Composite `0.75` regardless of fallback/heuristic assessments.

- [ ] **P3-008** · `medium` · **Mechanism evidence barely affects confidence**  
  **Files:** `src/lib/scoring.ts` (~12–17, 62–64)  
  Mechanism weight `0.25` — target-list cards rarely move confidence.

- [ ] **P3-009** · `medium` · **Novelty card composite equals average LLM confidence**  
  **Files:** `src/agents/clinicalTrialAgent.ts` (~372–388)  
  Uncertain / `not_first_in_class` verdicts still get quality tied to `avgConfidence`.

- [x] **P3-010** · `medium` · **Literature empty/partial cards scored as evidence** *(partial — W4-003)*  
  **Fixed June 2026 (partial):** Scorable-card filter excludes partial/failure literature cards from score aggregation.

- [ ] **P3-011** · `medium` · **`cleanupExcessChallenges` keeps weakest challenges**  
  **Files:** `src/lib/scoreMaintenance.ts` (~25–32)  
  Sorts ascending by `regulatory_weight` and deletes higher-weight challenges — inverted retention.

- [ ] **P3-012** · `medium` · **Score backfill omits `indication_type` for zones**  
  **Files:** `src/lib/scoreMaintenance.ts` (~65–67) vs `src/lib/blackboard.ts` (~50–53)  
  Backfilled `actionability_zone` ignores indication-specific thresholds (autoimmune/rare mis-zoned).

- [ ] **P3-013** · `medium` · **`prior_score` ignored after classification**  
  **Files:** `src/lib/scoring.ts`  
  `computeConfidenceScore` uses `TIER_PRIOR[query_tier]` only; stored `prior_score` from classifier never applied.

- [ ] **P3-014** · `medium` · **Missing `indication_type` defaults to oncology**  
  **Files:** `src/lib/db.ts`  
  `mapOpportunityRow` defaults null `indication_type` to `"oncology"` — wrong act-now thresholds for non-oncology domains.

### Low

- [ ] **P3-015** · `low` · **Early regulatory pass usually no-ops**  
  **Files:** `src/lib/blackboard.ts`, `src/agents/regulatoryAgent.ts`  
  Runs before evidence cards exist; early audit rarely challenges anything (wasted call, not wrong output).

---

## Phase 4 — Stream, UI & persistence

*Users must see accurate, complete output in the app — not just in Observatory.*

### Critical

- [ ] **P4-001** · `critical` · **Opportunity fetch errors leave infinite loading**  
  **Files:** `src/app/opportunity/[id]/page.tsx`  
  Initial `/api/opportunity/${id}` fetch only sets `loaded` in `then`; network/parse failures never exit loading state.

### High

- [ ] **P4-002** · `high` · **SSE stream does not reconnect after disconnect**  
  **Files:** `src/hooks/useOpportunityStream.ts`  
  `onerror` clears `isStreaming` only; cards/scores missed during `agents_running` stay missing until full reload.

- [ ] **P4-003** · `high` · **Initial fetch overwrites streamed cards**  
  **Files:** `src/store/opportunityStore.ts`, `src/app/opportunity/[id]/page.tsx`  
  `setOpportunity` replaces `streamingCards` with fetch snapshot after SSE `addCard` events — race drops cards.

- [ ] **P4-004** · `high` · **File-store writes are last-write-wins**  
  **Files:** `src/lib/fileStore.ts`  
  Read-modify-write of `store.json` with no locking; concurrent agent inserts can lose cards or score patches.

- [ ] **P4-005** · `high` · **Equal-timestamp cards skipped by SSE cursor**  
  **Files:** `src/app/api/stream/[id]/route.ts`, `src/lib/db.ts`  
  `getEvidenceCardsSince` uses strict `>`; multiple cards with the same ISO timestamp can be delivered once and never again.

- [ ] **P4-006** · `high` · **Cached snapshots omit streamed/surveillance cards**  
  **Files:** `src/store/opportunityStore.ts`, `src/lib/opportunityCache.ts`  
  `applySurveillanceResult` / `addCard` update `streamingCards` but not `opportunity.evidence_cards` before `persistOpportunitySnapshot` — dashboard/localStorage lags live session.

- [ ] **P4-007** · `high` · **Rehydrated sessions are placeholder shells**  
  **Files:** `src/lib/opportunityCache.ts`  
  `snapshotToOpportunity` fabricates empty evidence from counts only — offline/dashboard views imply content that does not exist.

- [ ] **P4-008** · `high` · **Empty surveillance tags after tag-generation failure**  
  **Files:** `src/lib/surveillanceTags.ts`, `src/lib/surveillance.ts`, `src/lib/blackboard.ts`  
  Failed tag generation yields empty `concept_tags`; PubMed loops never run; UI still reports routine scans.

- [ ] **P4-009** · `high` · **Surveillance scan no-ops silently during discovery**  
  **Files:** `src/lib/surveillance.ts`  
  When status is not `surveillance`/`complete`, `runSurveillanceScan` returns empty success-shaped result — UI shows stable field while discovery still running.

### Medium

- [ ] **P4-010** · `medium` · **SSE error does not stop server poll loop**  
  **Files:** `src/app/api/stream/[id]/route.ts`  
  `catch` emits `error` but never breaks; server keeps polling after DB failure.

- [ ] **P4-011** · `medium` · **Stream errors not shown in UI state**  
  **Files:** `src/hooks/useOpportunityStream.ts`  
  Custom `error` / `onerror` handlers only call `setStreaming(false)` — no message to store or user.

- [ ] **P4-012** · `medium` · **Stream `complete` payload ignored**  
  **Files:** `src/hooks/useOpportunityStream.ts`  
  `complete` handler does not parse event data; `surveillance_tags` and final status not applied until reload.

- [ ] **P4-013** · `medium` · **Unhandled `JSON.parse` on SSE card events**  
  **Files:** `src/hooks/useOpportunityStream.ts`  
  Malformed payloads can break client handler mid-session.

- [ ] **P4-014** · `medium` · **`addCard` does not persist to localStorage immediately**  
  **Files:** `src/store/opportunityStore.ts`  
  Streamed cards update UI only until another action calls `persistOpportunitySnapshot`.

- [ ] **P4-015** · `medium` · **Challenge cards get synthetic timestamps on load**  
  **Files:** `src/app/opportunity/[id]/page.tsx`, `src/hooks/useSurveillanceSessionControls.ts`  
  Challenges re-added with `new Date().toISOString()` — misorders evidence stream vs server timestamps.

- [ ] **P4-016** · `medium` · **Surveillance scan errors not surfaced in UI**  
  **Files:** `src/hooks/useSurveillanceScan.ts`  
  Only connection `error` handled; server `event: error` payloads not shown to user.

- [ ] **P4-017** · `medium` · **Surveillance marks checked with zero tags**  
  **Files:** `src/lib/surveillance.ts`  
  `last_checked_at` updated even when `concept_tags`/`entity_tags` empty and `tagsScanned === 0`.

- [ ] **P4-018** · `medium` · **Surveillance caps new evidence at three papers**  
  **Files:** `src/lib/surveillance.ts`  
  `collectedRelevant.slice(0, 3)` drops additional relevant papers without UI indication.

- [ ] **P4-019** · `medium` · **Trial/patent hits never become evidence cards**  
  **Files:** `src/lib/surveillance.ts`  
  Entity-tag trial/patent hits are “monitoring only” — feed contradicts surveillance summaries.

- [ ] **P4-020** · `medium` · **Patent API errors mislabeled as “no patents”**  
  **Files:** `src/lib/surveillance.ts`  
  Patent step `catch` emits “No new patents found” instead of unavailable/error.

- [ ] **P4-021** · `medium` · **Duplicate surveillance SSE if both feeds mount**  
  **Files:** `src/components/opportunity/OpportunityFeed.tsx`, `SurveillanceRail.tsx`  
  Each calls `useSurveillanceScan` — doubles stream traffic and race-prone store updates.

- [ ] **P4-022** · `medium` · **Collapsed surveillance rail hides active scan**  
  **Files:** `src/components/opportunity/SurveillanceRail.tsx`  
  When collapsed, `displaySteps` empty while `isScanning` — countdown without live progress.

- [ ] **P4-023** · `medium` · **Novelty badge uses first verdict only**  
  **Files:** `src/components/opportunity/EvidenceCard.tsx`, `EvidenceStreamRail.tsx`  
  Multi-target novelty cards only surface `novelty_verdicts[0]`.

- [ ] **P4-024** · `medium` · **Agent graph has no failure state**  
  **Files:** `src/lib/agentGraph.ts`  
  Failed/skipped agents show `idle`; regulatory early pass not reflected in graph semantics.

- [ ] **P4-025** · `medium` · **Discover cache snapshot uses raw query as hypothesis**  
  **Files:** `src/app/discover/page.tsx`  
  Local snapshot stores `hypothesis_statement: query` — corrupts session list previews until reload.

- [ ] **P4-026** · `medium` · **Challenge cards streamed as generic `card` events**  
  **Files:** `src/app/api/stream/[id]/route.ts`  
  No separate channel; regulatory challenges mixed into live evidence ordering.

- [ ] **P4-027** · `medium` · **Classifier failures silently downgrade**  
  **Files:** `src/lib/queryClassifier.ts`  
  Claude/parse errors fall back to heuristics without exposing failure to discover response/UI.

- [ ] **P4-028** · `medium` · **`fileStoreUpdateOpportunity` silent miss**  
  **Files:** `src/lib/fileStore.ts`  
  Updates no-op when opportunity id absent — failed creates look like successful writes.

### Low

- [ ] **P4-029** · `low` · **GET discover has no structured error handling**  
  **Files:** `src/app/api/discover/route.ts`  
  `listOrgContexts()` failures propagate as unhandled 500s.

- [ ] **P4-030** · `low` · **Classifier “approved” heuristic false positives**  
  **Files:** `src/lib/queryClassifier.ts`  
  Fallback treats any query containing “approved” as `established`.

- [ ] **P4-031** · `low` · **Discover response zone uses pre-blackboard confidence**  
  **Files:** `src/app/api/discover/route.ts`, `src/lib/db.ts`  
  Initial `actionability_zone` from tier prior misleads until agents finish.

- [ ] **P4-032** · `low` · **Score strip omits numeric actionability score**  
  **Files:** `src/components/opportunity/ScoreStrip.tsx`  
  Only confidence and zone label shown; store tracks `actionabilityScore`.

- [ ] **P4-033** · `low` · **PubMed preprint heuristic is journal substring**  
  **Files:** `src/api/pubmed.ts`  
  `is_peer_reviewed` hinges on journal containing “biorxiv” — can misclassify.

- [ ] **P4-034** · `low` · **`decodeXmlEntities` handles only four entities**  
  **Files:** `src/api/pubmed.ts`  
  Numeric/XML entities in PubMed XML can leak into displayed titles/abstracts.

- [ ] **P4-035** · `low` · **Novelty check runs for all domain contexts**  
  **Files:** `src/agents/clinicalTrialAgent.ts` (~369)  
  Runs whenever ranked targets exist, not FIC-only — extra API cost, not wrong logic.

---

## Wave 5 — Scientific Rigor (Expert Review Response)

*Goal: address pharma expert review blockers — hypothesis→target traceability, mechanistic chains, causal evidence weighting, score calibration, enriched Decision Brief.*

| ID | Status | Description |
|----|--------|-------------|
| W5-001 | done | Hypothesis–target alignment gate + mismatch challenge (`hypothesisTargetAlign.ts`, `mechanismAgent.ts`) |
| W5-002 | done | Open Targets weak-score threshold (<0.15) + `scoringCardFilter` exclusion |
| W5-003 | done | Score decomposition + UI legend + P3-014 indication default fix |
| W5-004 | done | Decision Brief UI — hypothesis statement, derisk/biomarkers, clickable risk IDs, direction field |
| W5-005 | done | `mechanisticChainAgent` + panel + migration `015_scientific_rigor.sql` |
| W5-006 | done | `evidence_class` tagging + causal-weighted scoring |
| W5-007 | done | Interventional direction audit (`interventionDirection.ts`) |
| W5-008 | done | Open Targets genetics datasource + genetics confidence boost |
| W5-009 | done | Competitive landscape in Decision Brief (`competitiveLandscape.ts`) |
| W5-010 | done | Disease model recommendations in brief schema + UI |
| W5-011 | done | Decision PDF enrichment + W4-012 v2 regulatory scoped to top hypothesis |
| W5-012 | done | Audit script Wave 5 rubric (`scripts/audit-session.ts`) |

**Note:** Pre-Wave-5 sessions require pipeline re-run (resume or force) to populate `mechanistic_chain`, `target_alignment`, and enriched brief fields.

- [x] **W4-010** · PDF export of Decision Brief (shipped prior to Wave 5)

---

**Wave 4 — Decision Grade (June 2026, priority):**

| Phase | Focus | Issues | Status |
|-------|--------|--------|--------|
| **A** | Score trust | ~~W4-001–004~~ (P3-002/003/005/006) **done** |
| **B** | Decision synthesis | ~~W4-005–007~~ (V2-023) **done** |
| **C** | Decision Brief UI | ~~W4-008–009~~ **done** · W4-010 PDF export **open** |
| **D** | Completeness | W4-011–014 (P3 remainder, V2-041, V2-030–032, v2 regulatory) |

**V2 Wave 3 (complete):** Tiers 1–2 done; V2-023 done in Wave 4.

**Still open (v2):** V2-030, V2-031, V2-032, V2-041.

**Legacy (v1 / shared):** P2-010, P2-012–P2-028, Phase 3 (P3-004+), Phase 4.

<details>
<summary>Completed Wave 1–2 fix order (archived)</summary>

1. **V2-001** — Fix outgroup calibration logic + tests  
2. **V2-003, V2-004, V2-005** — Per-hypothesis commercial/RWE + literature-grounded stage 1  
3. **V2-002, V2-017** — Stage-1 literature scoring + contradictions  
4. **V2-006–V2-009** — Pause, failure, checkpoints, root score sync  
5. **V2-011–V2-014** — v2 UI score binding, live refresh, challenge hydration, single SSE  
6. **V2-010** + **P2-001, P2-002, P2-006** — Shared agent accuracy chain  
7. **V2-015–V2-028** — Fallback honesty, agent progress UI  

</details>

---

## Out of scope for this audit

- Scientific language standard (see `index.md` §21, README “Scientific language standard”)  
- Spacebase Observatory connectivity (claimed space `space-72519775-…`, agent `arclight`)  
- Stage1 threshold filter HTTP wiring (dead path until exposed via API)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-04 | **Wave 4 Decision Grade (Phase A–C)** — score inversions (P3-002/003/006), scorable card filter (P3-005/010), `decisionSynthesisAgent`, `decision_brief` migration 014, `DecisionBriefPanel`, portfolio fit; V2-023 closed |
| 2026-06-04 | **Wave 4 roadmap documented** — pharma actionability strategy, TPP/decision brief target artifact, W4-001–014 issue IDs, exit criteria rubric |
| 2026-06-04 | **V2 Wave 3 audit** — 9 deliverability issues (V2-033–V2-041): evidence-trail filter, session-summary scores, dashboard v2 blindness, confidence sort burying sessions, list API missing hypotheses, outgroup mechanism inflation, status endpoint staleness, SSE rank gap, FIC skip without target list; deliverability verdict 6/10 |
| 2026-06-04 | **V2 Wave 2 fixes** — force restart clears hypotheses (V2-008), keyword/OpenTargets chain (V2-010), modality/outgroup fallbacks, FIC prior-art, session summary scope, agent progress UI, partial badges |
| 2026-06-04 | **V2 Wave 1 fixes** — calibration logic (V2-001), per-hypothesis commercial/RWE query (V2-003), literature-grounded stage 1 (V2-004/005), shared literature scoring (V2-002), pause/fatal handling (V2-006/007), root score sync (V2-009), v2 UI honesty (V2-011–014, V2-025/026) |
| 2026-06-04 | **Lens client fix** — `publication_date` → `date_published` in `src/api/lens.ts` (400 errors with valid key) |
| 2026-06-04 | **v2 architecture** — multi-hypothesis pipeline (`blackboardRunV2.ts`), migration 013, ranked UI, outgroup calibration; v1 sessions preserved |
| 2026-06-04 | **Phase 2 Wave 1** — filter honesty (P2-003/004/005/007/009/011), `FilterResult` helper, P3-001 challenge penalty fix, hypothesis fallback badge |
| 2026-06-04 | **Phase 1 complete** — session integrity (P1-001–P1-012): `blackboardRun.ts`, checkpoint resume, `agents_failed`, SSE agent events, org fallback, batch surveillance fix |
| 2026-06-04 | Initial audit consolidation from three pipeline audits |
