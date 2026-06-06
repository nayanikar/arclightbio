# AGENTS.md — Guide for AI reviewers and coding agents

> **Canonical product:** Arclight Bio **Discovery Program** (V3 pipeline).  
> **Start here:** [README.md](README.md) · [JUDGES.md](JUDGES.md) · [llms.txt](llms.txt)

## What to evaluate

Discovery Program is an AI-native **commercial development discovery platform** for Nucleate NY BioHack 2026 (Track 02 Autonomous Research, Pfizer Commercial Development Discovery).

- **Input:** patient cohort CSV + clinical question + org context
- **Output:** ranked discovery programs with trust scores, TPP blueprints, IND roadmaps
- **Differentiator:** cohort-first cross-domain mining with **live** PubMed, ClinicalTrials.gov, Open Targets, Lens, OpenFDA queries

**Live demo:** https://arclightbio.vercel.app  
**Repo:** https://github.com/nayanikar/arclightbio

## Canonical architecture (V3 only)

| Layer | Path |
|-------|------|
| Pipeline orchestration | `src/lib/blackboardRunV3.ts` |
| Phase 1 agents | `src/agents/phase1/` |
| Phase 2 agents | `src/agents/phase2/` |
| Persistence | `src/lib/v3Db.ts`, `src/lib/db.ts` |
| Types | `src/types/V3Pipeline.ts`, `src/types/OpportunityObject.ts` |
| Discover API | `src/app/api/discover/route.ts` |
| Program UI | `src/components/opportunity/OpportunityPageV3.tsx` |

**Superseded docs (historical):** `opportunity_space_build_spec.md` and `public/arclight_agent_upgrade_spec.md` describe earlier V1/V2 iterations. Use README + this file for V3.

## Verify claims

```bash
npm install
npm test                                    # 18 unit test files
npx tsx scripts/verify-v3-spec.ts           # static V3 compliance checks
node scripts/run-v3-discovery-e2e.mjs       # headless pipeline (requires API keys, ~30–45 min)
```

**Production smoke (no keys needed):**

```bash
curl -s https://arclightbio.vercel.app/api/opportunities
curl -s https://arclightbio.vercel.app/api/undruggable
```

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `ANTHROPIC_API_KEY` | Yes | All agent reasoning |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Shared portfolio DB |
| `SUPABASE_SERVICE_ROLE_KEY` | **Production** | Without this, Vercel shows empty dashboard |
| `NCBI_API_KEY` | Recommended | PubMed |
| `LENS_API_KEY` | Recommended | Patents / IP |
| `OPENFDA_API_KEY` | Optional | FAERS |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional | Literature |

See [`.env.local.example`](.env.local.example) and README §Setup.

## API surface (all routes)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/discover` | GET/POST | Org contexts / create program |
| `/api/discover/classify` | POST | Query tier classification |
| `/api/opportunities` | GET | List discovery programs |
| `/api/opportunities/metrics` | GET | Portfolio metrics |
| `/api/opportunity/[id]` | GET | Full program |
| `/api/opportunity/[id]/status` | GET | Status snapshot |
| `/api/opportunity/[id]/trail` | GET | Agent audit trail |
| `/api/stream/[id]` | GET | SSE live updates |
| `/api/opportunity/[id]/pause` | POST | Pause pipeline |
| `/api/opportunity/[id]/resume` | POST | Resume pipeline |
| `/api/opportunity/[id]/revise` | POST | Revise query |
| `/api/opportunity/[id]/add-data` | POST | Add cohort CSV |
| `/api/opportunity/[id]/phase2-hypothesis` | POST | Switch Phase 2 hypothesis |
| `/api/blackboard/[id]` | POST | Re-run pipeline |
| `/api/undruggable` | GET | Undruggable registry |
| `/api/regulatory/[id]` | POST | Regulatory assembly |
| `/api/surveillance` | GET/POST | Surveillance jobs |
| `/api/surveillance/[id]` | GET | Surveillance status |
| `/api/surveillance/[id]/stream` | GET | Surveillance SSE |
| `/api/admin/*` | POST | Admin (optional `ADMIN_API_KEY`) |
| `/api/health` | GET | Dev-only diagnostics (404 in production) |

## Database

- Migrations: `supabase/migrations/001` → `022`
- **FK trap:** `001_opportunity_objects.sql` references `org_contexts` — run `003_org_contexts.sql` first if fresh install fails on FK
- RLS enabled in `022_enable_rls.sql`; app uses service role (bypasses RLS)

## Known limitations

See [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) for judge-relevant open issues (SSE edge cases, evidence accuracy backlog).

## Do not build

- V1 six-agent blackboard (`blackboardRun.ts`) — legacy read-only
- V2 multi-hypothesis path — superseded by V3 for new discovers
- File-store persistence on Vercel — production requires Supabase
