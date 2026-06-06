# Arclight Bio — Opportunity Space

**The discovery engine that finds what your experts don't know to look for.**

Living discovery platform for the life sciences. Built for [Nucleate NY BioHack 2026](https://nucleate.xyz/) — Track 02 (Autonomous Research) · Track 05 (Regulatory).

Every discovery session runs **live queries** against public biomedical APIs. No pre-filled demo data, no cached JSON pretending to be research.

---

## What's new (June 2026)

### V3 discovery pipeline

Discovery now runs a two-phase blackboard with structured hypotheses, program trust scoring, and an agent audit trail.

| Phase | Steps | Outcome |
|-------|-------|---------|
| **Phase 1** | Population → anchors → market size → causal domains → literature → selectivity rank | Ranked selectivity hypotheses with mechanistic chains |
| **Phase 2** | Target screen → drug check → IP/FTO → druggability → modality → TPP → risk → IND package | Full program assessment per surviving hypothesis |

Orchestration: [`src/lib/blackboardRunV3.ts`](src/lib/blackboardRunV3.ts) · persistence: [`src/lib/v3Db.ts`](src/lib/v3Db.ts) · UI: [`src/components/opportunity/OpportunityPageV3.tsx`](src/components/opportunity/OpportunityPageV3.tsx).

**Key behaviors:**

- **Target druggability gate** — Phase 2 screens each target across small molecule, biologic, and ADC modalities before expensive drug-branch steps run.
- **Undruggable registry** — Failed targets are recorded with reasoning and alternate intervention routes; global entries block the target in all future sessions.
- **Program trust score** — Composite trust metric surfaced on dashboard and opportunity pages.
- **Innovation level** — Programs default to `medium` innovation; configurable at discover time.
- **Agent trail** — Step-level audit timeline with live activity during runs.

### Undruggable registry page

Browse cross-session blocked targets at `/undruggable` (also in the nav menu). Search, filter by scope (global / session-linked / rescan-eligible), and jump back to source programs.

API: `GET /api/undruggable`

### Dashboard & navigation

- Portfolio summary metrics and **program queue** with zone badges, trust labels, and sort/filter toolbar.
- Mobile-first **nav drawer** (`AppHeader` + `NavDrawer`) replacing the fixed sidebar.
- Routes: Dashboard · Discover · Undruggable · Open Observatory (optional Spacebase link).

### Session integrity (carried forward)

| Capability | Behavior |
|------------|----------|
| Blackboard scheduling | `scheduleBlackboardRun()` with Vercel `waitUntil` |
| Agent failure | Retry once → terminal `agents_failed` |
| Pause / resume | Checkpoint in `blackboard_state`; resume continues remaining steps |
| Duplicate runs | Per-opportunity lock prevents concurrent blackboard execution |
| SSE visibility | `agent_status`, `failed`, `paused` events on discovery stream |

---

## How a discovery session works

```mermaid
flowchart TB
  subgraph discover [Discover]
    Query[User query + org + innovation level] --> OO[Opportunity Object created]
  end

  subgraph phase1 [Phase 1 — hypothesis funnel]
    OO --> P1[Population · anchors · literature · selectivity rank]
    P1 --> Hyp[Ranked hypotheses]
  end

  subgraph phase2 [Phase 2 — program build]
    Hyp --> Screen[Target druggability screen]
    Screen -->|undruggable| Registry[Undruggable registry]
    Screen -->|druggable| Drug[Drug · IP · modality · TPP · IND]
    Drug --> Complete[Program complete]
  end

  subgraph ui [Live UI]
    OO --> SSE[SSE evidence + trail stream]
    SSE --> Page[Opportunity page V3]
    Registry --> List[/undruggable registry]
  end
```

1. User enters a query on `/discover`, selects org context and innovation level.
2. V3 Phase 1 agents run sequentially, producing ranked selectivity hypotheses.
3. Phase 2 runs per hypothesis: target screen first; undruggable primaries are blocked and recorded.
4. Surviving hypotheses proceed through drug discovery, modality, TPP, and IND packaging.
5. The opportunity page streams updates via SSE; dashboard polls for portfolio metrics.

### Status lifecycle

```
initialising → agents_running → surveillance → (paused | complete | archived)
                    ↓
              agents_failed   (terminal)
                    ↓
              paused          (checkpoint saved; resume continues)
```

---

## Core concepts

### Opportunity Object

One object per discovery session, persisted in Supabase (or in-memory for local dev).

| Field | Purpose |
|-------|---------|
| `hypothesis` / V3 hypotheses | Statement, patient population, ranked selectivity targets |
| `evidence_cards` | Agent-contributed evidence with quality scores |
| `confidence_score` | 0–1, prior-anchored blend of evidence quality |
| `actionability_zone` | `too_early` · `act_now` · `crowded` |
| `program_trust_score` | V3 composite program trust (0–1) |
| `innovation_level` | `low` · `medium` · `high` |
| `pipeline_status` | e.g. `blocked_undruggable` when primary target fails druggability screen |
| `blackboard_state` | Checkpoint (`completedSteps`), last event, pause reason |
| `discovery_thesis_title` | Short thesis label for dashboard queue |

### Undruggable registry

Table: `undruggable_targets`. Records target name, modality reasoning, alternate intervention route, and whether the entry is global (cross-session) or tied to a single program. Phase 2 agents consult the registry before running drug-branch steps.

### Organization context

Org contexts (Pfizer, J&J, etc.) define therapeutic areas, risk tolerance, and commercial weighting. The same evidence scores differently depending on which org is evaluating the opportunity.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS · shadcn/ui · Lucide · framer-motion |
| State | Zustand · TanStack Query |
| Database | Supabase (PostgreSQL) — optional in-memory fallback |
| LLM | Anthropic Claude |
| PDF export | jsPDF |
| Live observability | Spacebase1 intent space (optional) |

---

## Project structure

```
src/
  app/
    discover/              # New discovery UI
    undruggable/           # Cross-session undruggable registry
    opportunity/[id]/      # V3 session view
    admin/                 # Dev admin (Shift+P)
    api/                   # REST + SSE (incl. /api/undruggable)
  agents/
    phase1/                # V3 Phase 1 agents
    phase2/                # V3 Phase 2 agents (incl. druggability screen)
  components/
    layout/                # AppHeader, NavDrawer, TopBar
    dashboard/             # PortfolioSummary, ProgramQueue
    opportunity/           # OpportunityPageV3, V3 panels
    undruggable/           # Registry list + target cards
  lib/
    blackboardRunV3.ts     # V3 orchestration
    v3Db.ts                # V3 Supabase persistence
    pipelineBlocked.ts     # Shared blocked-pipeline logic
    targetDruggabilityGate.ts
  types/
    V3Pipeline.ts          # V3 types incl. UndruggableTargetRecord
scripts/                   # Ops: audit, repair, backfill (see below)
supabase/migrations/       # 001 → 021
test-data/                 # Sample cohort CSV for discovery tests
```

---

## Setup

### Prerequisites

- Node.js 18+
- API keys (see below)
- Supabase project (recommended for persistence)

### Install and run

```bash
cp .env.local.example .env.local
# Edit .env.local with your keys

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase

1. Create a Supabase project and add credentials to `.env.local`.
2. Run migrations in order from `supabase/migrations/` in the Supabase SQL Editor (**001 → 021**).

Without Supabase, the app falls back to an in-memory store — fine for demos, but data is lost on restart.

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Hypothesis, agents, classifier, audits |
| `NCBI_API_KEY` | Recommended | PubMed rate limits |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional | Depth-mode literature |
| `OPENFDA_API_KEY` | Optional | FAERS / drug labels |
| `LENS_API_KEY` | Optional | Patent search |
| `NEXT_PUBLIC_SUPABASE_*` | Optional | Persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Server-side DB writes |
| `SPACEBASE_ENABLED` | Optional | Observatory live agent view |

See [`.env.local.example`](.env.local.example) for the full list.

---

## Routes

### UI

| Path | Description |
|------|-------------|
| `/` | Dashboard — portfolio metrics and program queue |
| `/discover` | Start a new V3 discovery session |
| `/undruggable` | Cross-session undruggable target registry |
| `/opportunity/[id]` | V3 session view with audit trail and phase panels |
| `/opportunity/[id]/regulatory` | Regulatory assembly + PDF export |
| `/admin` | Dev admin tools (**Shift+P**) |

### API (selected)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/discover` | POST | Create opportunity + schedule V3 blackboard |
| `/api/opportunities` | GET | List all opportunities |
| `/api/opportunity/[id]` | GET | Single opportunity with cards |
| `/api/stream/[id]` | GET | SSE live updates during discovery |
| `/api/undruggable` | GET | Undruggable registry + stats |
| `/api/opportunity/[id]/pause` | POST | Pause session |
| `/api/opportunity/[id]/resume` | POST | Resume from checkpoint |
| `/api/blackboard/[id]` | POST | Re-run blackboard |
| `/api/health?service=pubmed&q=...` | GET | API connectivity smoke tests |

---

## Scripts

### npm

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
npm test         # Vitest unit tests (16 suites)
```

### Maintenance (`scripts/`)

| Script | Purpose |
|--------|---------|
| `backfill-program-trust.mjs` | Backfill `program_trust_score` on existing programs |
| `repair-undruggable-sessions.mjs` | Repair blocked sessions, promote registry entries |
| `audit-discovery-playwright.mjs` | E2E browser audit (writes to `.playwright-audit/`, gitignored) |
| `run-v3-discovery-e2e.mjs` | Headless V3 discovery smoke test |
| `check-supabase.mjs` | Verify Supabase connectivity |

Spacebase claim/emit helpers live in `scripts/spacebase/` locally and are not required to run the app.

---

## Database migrations

Run in order in Supabase SQL Editor:

| Migration | Purpose |
|-----------|---------|
| `001`–`012` | Core schema, evidence cards, org contexts, agent v2 upgrade, blackboard state |
| `013_v2_hypotheses` | V2 hypothesis tables |
| `014_decision_brief` | Decision brief fields |
| `015_scientific_rigor` | Scientific rigor scoring |
| `016_v3_pipeline` | V3 pipeline tables (hypotheses, assessments, undruggable_targets) |
| `017_v3_opportunity_fields` | V3 opportunity columns |
| `018_program_trust` | Program trust score |
| `019_agent_trail` | Agent trail events |
| `020_innovation_level` | Innovation level column |
| `021_phase2_target_screen` | Phase 2 target screen checkpoint step |

---

## Spacebase1 Observatory (optional)

Agent lifecycle events can be broadcast to a [Spacebase1](https://spacebase1.differ.ac) intent space. Enable with `SPACEBASE_ENABLED=true` in `.env.local`. Use **Open Observatory** in the nav drawer.

Do **not** set `SPACEBASE_OBSERVATORY_URL` in `.env.local` — dotenv strips URL hash fragments. Claim a space locally with `python3 scripts/spacebase/claim.py` (writes `.spacebase/`, gitignored).

---

## License

Private — Arclight Bio · Nucleate NY BioHack 2026
