# Known limitations (judge-relevant)

> Summary of open issues that may affect evaluation. Full tracker: [issues.md](../issues.md).

## Live demo — usually fine

- Production dashboard shows all programs from shared Supabase
- Completed programs have real PubMed / ClinicalTrials evidence cards with source URLs
- 4+ programs have `status: complete` with full V3 Phase 1 + Phase 2 output

## May affect stress-testing

| Area | Risk | Mitigation |
|------|------|------------|
| **New discovery on Vercel** | Serverless timeout on long pipelines (Hobby plan ~10s; pipeline runs 30+ min) | Evaluate **existing completed programs** on dashboard; local dev for full new-run demo |
| **SSE reconnect** | Rare missed cards on flaky network during live run | Refresh program page; data persists in Supabase |
| **Pipeline lock** | Stuck `409 Blackboard already running` if prior run didn't clean up | `POST /api/admin/stop-pipeline` (open when `ADMIN_API_KEY` unset) |
| **Evidence accuracy** | Some Open Targets / keyword matching edge cases (P2 backlog) | Audit trail shows sources; cross-check cited URLs |
| **PDF export** | Regulatory PDF at `/opportunity/[id]/regulatory` works; board-ready portfolio PDF is a submission TODO | Use regulatory page for IND package export |

## Not available on Vercel

- **Spacebase observatory** — requires local Python + filesystem (`SPACEBASE_ENABLED=false` in production)
- **`/api/health`** — intentionally disabled in production (`NODE_ENV === "production"`)

## Fresh database setup

If reproducing from migrations: `001_opportunity_objects.sql` references `org_contexts` — run `003_org_contexts.sql` first if FK errors occur, then continue `001` → `022`.
