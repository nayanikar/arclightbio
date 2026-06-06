# JUDGES.md — Quick evaluation guide

> **Nucleate NY BioHack 2026** · Track 02 Autonomous Research · Pfizer Commercial Development Discovery

## Live demo (fastest path — ~3 minutes)

| Step | URL | What you'll see |
|------|-----|-----------------|
| 1 | [arclightbio.vercel.app](https://arclightbio.vercel.app) | Product story, pipeline overview |
| 2 | [Dashboard](https://arclightbio.vercel.app/dashboard) | **10+ completed discovery programs** with trust scores |
| 3 | [Sample completed program](https://arclightbio.vercel.app/opportunity/09c1f4cd-1698-4853-b4fc-9d1f0dffbb64) | Full V3 pipeline: anchors, funnel, Phase 2, audit trail |
| 4 | [Undruggable registry](https://arclightbio.vercel.app/undruggable) | Cross-session target learning |
| 5 | [Discover](https://arclightbio.vercel.app/discover) | Launch a new program (requires cohort CSV upload) |

**Tagline:** Find what experts don't know to look for.

**No login required.** Production uses a shared Supabase portfolio — programs you see are real pipeline runs with live API evidence.

## Try a new discovery (~30–45 minutes)

A full V3 pipeline runs 30+ agents across two phases. For a quick evaluation, use the **completed program link above** instead of waiting for a new run.

To launch your own:

1. Clone [github.com/nayanikar/arclightbio](https://github.com/nayanikar/arclightbio)
2. Upload `test-data/oncology-lof-no-driver-cohort.csv` on `/discover`
3. Parent domain: **Oncology** · Innovation: **medium** · Org: **Pfizer (Demo)**
4. Sample question: _What non-driver loss-of-function biology in refractory solid and heme tumors suggests intervention-ready programs beyond standard oncogenic driver targeting?_

Alternate cohort: `test-data/oncology-metastasis-tme-cohort.csv` — metastasis / TME hidden-subgroup demo.

## What makes this Pfizer-relevant

- **Cohort-first** — starts from your patients, not indication taxonomy
- **Cross-domain mining** — CD1 cohort patterns + CD2 literature associations
- **50→20→3 hypothesis funnel** — breadth in one session vs months of committee review
- **Live evidence** — PubMed, ClinicalTrials.gov, Open Targets, patents at runtime
- **Portfolio output** — trust scores, Act Now zones, TPP blueprints, IND packages
- **Audit trail** — every agent step with source URLs

## Screenshots (in repo)

| Image | Route |
|-------|-------|
| `public/marketing/home.png` | `/` |
| `public/marketing/discover.png` | `/discover` |
| `public/marketing/dashboard.png` | `/dashboard` |
| `public/marketing/undruggable-registry.png` | `/undruggable` |
| `public/marketing/anchors.png` | Program page — anchors panel |
| `public/marketing/expert-domains.png` | Program page — expert domains |
| `public/marketing/hypothesis-funnel.png` | Program page — funnel |
| `public/marketing/phase2-ind.png` | Program page — Phase 2 / IND |

Regenerate: `npm run capture-marketing 09c1f4cd-1698-4853-b4fc-9d1f0dffbb64 --base https://arclightbio.vercel.app`

## API smoke test

```bash
curl -s https://arclightbio.vercel.app/api/opportunities | python3 -c "import sys,json; print(len(json.load(sys.stdin)['opportunities']), 'programs')"
curl -s https://arclightbio.vercel.app/api/undruggable | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stats',{}))"
```

`/api/health` returns 404 in production by design (dev-only endpoint).

## Documentation map

| Doc | Audience |
|-----|----------|
| [README.md](README.md) | Full product documentation |
| [AGENTS.md](AGENTS.md) | AI reviewers / coding agents |
| [llms.txt](llms.txt) | Machine-readable index |
| [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) | Open issues judges may hit |
| [issues.md](issues.md) | Full engineering audit tracker |

## Submission status

| Item | Status |
|------|--------|
| Live deployment | ✅ https://arclightbio.vercel.app |
| Production APIs connected | ✅ Supabase, Anthropic, PubMed, trials, Lens |
| Portfolio data for judges | ✅ 10+ programs on live dashboard |
| Demo video | ⏳ Pending — see README Submission TODOs |
| Team bios | ⏳ Pending — see README Team section |

## Repo

https://github.com/nayanikar/arclightbio
