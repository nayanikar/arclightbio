# Arclight Bio — Audit Issues

> **Created:** June 2026 · **Source:** Full pipeline audit (blackboard/agents, API/data layer, external APIs/UI)  
> **Goal:** Fix in phase order so discovery output becomes **reliable, accurate, and trustworthy**.  
> **Status:** **Phase 1 complete** (12/12 fixed, June 2026). Phases 2–4 remain open — see [`index.md`](index.md) §3, §23 and README “Session integrity” for what shipped.

---

## How to use this file

- Work through **Phase 1 → 4** in order; later phases assume earlier integrity fixes.
- Each issue has an ID (`P1-001`, etc.) for commits/PRs.
- **Severity:** `critical` · `high` · `medium` · `low`
- Mark fixed issues by changing `[ ]` to `[x]`.

---

## Summary

| Phase | Focus | Issues | Status |
|-------|--------|--------|--------|
| **1** | Session integrity | 12 | **Done** — all P1-001–P1-012 fixed |
| **2** | Evidence accuracy | 28 | **Wave 1 done** — 7/28 fixed (P2-003, P2-004, P2-005, P2-007, P2-009, P2-011 + P3-001) |
| **3** | Score trust | 15 | **Partial** — P3-001 fixed |
| **4** | Stream, UI & persistence | 35 | Open (partial overlap with P1 SSE fixes) |

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

- [ ] **P2-008** · `high` · **Modality agent silent no-op**  
  **Files:** `src/agents/modalityAgent.ts` (~35–36), `src/lib/blackboard.ts`  
  No `is_target_list` card → modality returns with no card and no user-visible failure.

- [x] **P2-009** · `high` · **First-in-class fallback can assert FIC from empty APIs**  
  **Files:** `src/agents/clinicalTrialAgent.ts` (~235–248)  
  On LLM failure, zero FDA/trials yields `is_first_in_class: true` at 50% confidence.

- [ ] **P2-010** · `high` · **PubMed failures abort surveillance scan**  
  **Files:** `src/lib/surveillance.ts`  
  Uncaught `searchPubMed` in the concept-tag loop terminates the whole SSE scan instead of recording a failed step.

### Medium

- [x] **P2-011** · `medium` · **Hypothesis LLM failure yields unmarked generic hypothesis**  
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
  `match_phrase` on title misses abstract/claim hits; often returns zero for valid queries.

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

## Phase 3 — Score trust

*Confidence and actionability must reflect evidence quality, not placeholders or inverted heuristics.*

### Critical

- [x] **P3-001** · `critical` · **Challenge penalties divided by 100**  
  **Files:** `src/lib/scoring.ts` (~83–85), `src/agents/regulatoryAgent.ts` (~257–258)  
  `score_impact` is stored as ~0.04–0.15 but penalized as `score_impact / 100`. UI shows “−5% confidence” while confidence barely moves.

### High

- [ ] **P3-002** · `high` · **Commercial saturation raises actionability**  
  **Files:** `src/lib/scoring.ts` (~203–209)  
  `hasCommercialSaturationSignals` adds `+0.25` — crowded markets score *higher*, not lower.

- [ ] **P3-003** · `high` · **High trial count increases actionability**  
  **Files:** `src/lib/scoring.ts` (~206–207)  
  `activeTrialCount > 15` adds `+0.10` — competitive indications rewarded as more actionable.

- [ ] **P3-004** · `high` · **Speed mode forces spurious regulatory challenges**  
  **Files:** `src/agents/regulatoryAgent.ts` (~447, 280–281, 505–506)  
  `fullAudit` is false for `mode === "speed"`, so replication stays at 0.4 (below challenge threshold) and weak cards get challenged.

- [ ] **P3-005** · `high` · **Placeholder/failure cards inflate scores**  
  **Files:** `src/lib/scoring.ts` (~167–185), agent partial/empty card paths  
  “No PubMed results”, partial-search, and summary cards (composite ~0.35–0.8) enter `avgQuality` and agent coverage.

### Medium

- [ ] **P3-006** · `medium` · **Confidence saturation bonus for crowded trials**  
  **Files:** `src/lib/scoring.ts` (~88–89)  
  `relevantTrialCount > 10` adds `+0.08` to confidence.

- [ ] **P3-007** · `medium` · **Modality card quality hardcoded high**  
  **Files:** `src/agents/modalityAgent.ts` (~96–104)  
  Composite `0.75` regardless of fallback/heuristic assessments.

- [ ] **P3-008** · `medium` · **Mechanism evidence barely affects confidence**  
  **Files:** `src/lib/scoring.ts` (~12–17, 62–64)  
  Mechanism weight `0.25` — target-list cards rarely move confidence.

- [ ] **P3-009** · `medium` · **Novelty card composite equals average LLM confidence**  
  **Files:** `src/agents/clinicalTrialAgent.ts` (~372–388)  
  Uncertain / `not_first_in_class` verdicts still get quality tied to `avgConfidence`.

- [ ] **P3-010** · `medium` · **Literature empty/partial cards scored as evidence**  
  **Files:** `src/agents/literatureAgent.ts` (~317–340)  
  Failure messages get nonzero quality/composite and enter scoring streams.

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

## Recommended fix order (next)

Phase 1 and **Wave 1** (filter honesty + P3-001) are complete. Next:

1. **P2-001, P2-002, P2-006** — Target/keyword resolution chain  
2. **P2-008, P2-010** — Modality no-op + surveillance resilience  
3. **P2-012–P2-028** — Remaining evidence accuracy  
4. **Phase 3** — Score trust (P3-002+, excluding P3-001)  
5. **Phase 4** — SSE reconnect, fetch/stream races

---

## Out of scope for this audit

- Scientific language standard (see `index.md` §21, README “Scientific language standard”)  
- Spacebase Observatory connectivity (claimed space `space-72519775-…`, agent `arclight`)  
- Stage1 threshold filter HTTP wiring (dead path until exposed via API)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-04 | **Phase 2 Wave 1** — filter honesty (P2-003/004/005/007/009/011), `FilterResult` helper, P3-001 challenge penalty fix, hypothesis fallback badge |
| 2026-06-04 | **Phase 1 complete** — session integrity (P1-001–P1-012): `blackboardRun.ts`, checkpoint resume, `agents_failed`, SSE agent events, org fallback, batch surveillance fix |
| 2026-06-04 | Initial audit consolidation from three pipeline audits |
