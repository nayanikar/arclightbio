export const homeCopy = {
  hero: {
    eyebrow: "Discovery Program",
    headline: "Find what experts don't know to look for.",
    lead:
      "Arclight is an AI-native commercial development discovery platform. Upload a patient cohort and clinical question — autonomous agents surface non-obvious, evidence-ranked programs from anchor populations through IND roadmap.",
    solutionBridge:
      "Built for teams who need discovery beyond what expert-gated review surfaces.",
    bullets: [
      "Live PubMed, ClinicalTrials.gov, and patent queries",
      "Population-first anchor methodology",
      "Cross-session undruggable learning",
    ],
    ctaPrimary: "Launch discovery",
    ctaSecondary: "View portfolio",
  },
  liveData: {
    eyebrow: "Live evidence",
    headline: "Every assessment queries public databases in real time.",
    body:
      "Arclight does not rely on cached demos or frozen snapshots. Each agent step pulls fresh evidence from authoritative biomedical sources.",
    sources: [
      { name: "PubMed", desc: "Literature & preprints" },
      { name: "ClinicalTrials.gov", desc: "Trial landscape" },
      { name: "Patents", desc: "IP & prior art" },
    ],
  },
  problemStatement: {
    sectionTitle: "The challenge",
    gap: {
      eyebrow: "The gap",
      headline: "Commercial development sees only what the taxonomy allows.",
      body:
        "Teams evaluate a handful of opportunities over months. Assessments are static, expensive, and anchored on familiar targets. The patient subgroup inside a heterogeneous indication — and the mechanism linking two unrelated conditions — stay invisible.",
      bridge:
        "Arclight starts from your cohort and clinical question, not your existing search taxonomy.",
    },
    approach: {
      eyebrow: "The approach",
      headline: "AI-native discovery, human-auditable results.",
      body:
        "Autonomous agents query public biomedical APIs, rank evidence, and narrow hypotheses — revealing opportunities that committee-driven review structurally misses. Every step remains visible with sources and reasoning.",
      bridge:
        "Launch a full discovery session and review the audit trail yourself.",
    },
    outcomes: {
      eyebrow: "The outcome",
      headline: "Better decisions. Lower cost. Faster identification.",
      commercial:
        "Market-sized anchors, Act Now actionability zones, and IND-ready regulatory roadmaps support portfolio ROI decisions.",
      efficiency:
        "Autonomous pipeline compresses identification time; undruggable registry eliminates repeated dead-end spend.",
      bridge:
        "From cohort upload to ranked program — in one continuous pipeline.",
    },
    audienceLabel: "Built for",
    audience: [
      "BD & licensing",
      "Discovery leads",
      "CSO office",
      "Innovation teams",
    ],
    pipelineTitle: "How a discovery program flows",
    pipelineSteps: [
      { step: "1", label: "Cohort", desc: "Upload patients + clinical question" },
      { step: "2", label: "Anchors", desc: "Define biology & resistance populations" },
      { step: "3", label: "Expert domains", desc: "Mine cohort + literature adjacencies" },
      { step: "4", label: "Funnel", desc: "50 → 20 → 3 evidence-ranked hypotheses" },
      { step: "5", label: "Portfolio", desc: "Ranked programs with confidence tiers" },
    ],
  },
  anchors: {
    eyebrow: "Anchor methodology",
    headline: "Two anchors. One program thesis.",
    lead:
      "After cohort upload, Arclight defines biology and resistance anchor populations — falsifiable subject–relationship–outcome claims tied to your query-defined patients. Market sizing runs on each anchor before hypotheses multiply.",
    solutionBridge:
      "Finds the patient subgroup hidden inside a heterogeneous indication — not the indication label alone.",
    bullets: [
      "Biology and resistance populations from cohort data",
      "Falsifiable anchor statements per population",
      "Market size (USD B) before funnel expansion",
      "Every hypothesis traces via anchor linkage",
    ],
    callout: "Population-first, not mechanism-first.",
  },
  expertDomains: {
    eyebrow: "Expert domain discovery",
    headline: "Cohort patterns meet literature.",
    lead:
      "CD1 mines co-occurring scientific domains from your patient cohort outside the parent therapeutic area. CD2 scans PubMed and target databases for disease, organ, and molecular associations. The merger produces expert domains that feed cross-context hypothesis seeds.",
    solutionBridge:
      "Surfaces mechanisms connecting conditions your taxonomy treats as unrelated.",
    bullets: [
      "CD1: recurrence rates and patient counts from cohort",
      "CD2: disease, organ, and molecular association types",
      "Merged lineage preserved (cd1 / cd2 / merged)",
      "Innovation dial controls cross-domain appetite at launch",
    ],
    callout: "Surfaces adjacencies your team wouldn't search.",
  },
  funnel: {
    eyebrow: "Hypothesis funnel",
    headline: "50 → 20 → 3. Evidence-ranked.",
    lead:
      "Phase 1 runs a progressive selectivity filter: 50 falsifiable association hypotheses, 20 promoted with mechanistic chains, exactly 3 ranked by anchor fidelity, evidence strength, and selective intervention feasibility.",
    solutionBridge:
      "Evaluate breadth in one session — not a handful of opportunities over months.",
    stages: [
      {
        key: "association",
        label: "Association filter",
        count: 50,
        desc: "Broad exploration, anchor-linked",
      },
      {
        key: "causation",
        label: "Causation filter",
        count: 20,
        desc: "Mechanistic promotion",
      },
      {
        key: "selectivity",
        label: "Selectivity rank",
        count: 3,
        desc: "Intervention-ready survivors",
      },
    ],
    bullets: [
      "Stage-by-stage progress visible on each discovery program page",
      "Falsification paths at every gate",
      "Top 3 force-ranked, not a long list",
      "Feeds target family and experiment design",
    ],
    callout:
      "Three survivors, ranked by anchor fidelity and selectivity — not taxonomy convenience.",
  },
  phaseTwo: {
    eyebrow: "Phase 2",
    headline: "Target to IND",
    lead:
      "After funnel convergence, Phase 2 screens druggability across small molecule, biologic, and ADC, then assembles drug path, IP/FTO, TPP, risk scoring, and an IND regulatory roadmap — decision-grade output, not a slide.",
    solutionBridge:
      "Compresses months of cross-functional assessment into one autonomous Phase 2 run.",
    pipelineTitle: "Phase 2 development path",
    steps: [
      { label: "Druggability screen", desc: "Small molecule, biologic, and ADC gate" },
      { label: "Drug & IP", desc: "Modality path, freedom to operate" },
      { label: "TPP blueprint", desc: "Falsifiable product claim" },
      { label: "IND package", desc: "Preclinical, CMC, tox, and regulatory roadmap" },
    ],
  },
  registry: {
    eyebrow: "Undruggable registry",
    headline: "Cross-session learning.",
    lead:
      "When three-modality druggability screening fails, Arclight records the target and blocks it in future programs — globally or session-scoped — with reasoning and alternate intervention paths preserved.",
    solutionBridge:
      "Cuts repeated identification cost on targets already proven undruggable.",
    bullets: [
      "Small molecule, biologic, and ADC gate before drug-branch spend",
      "Global blocks vs session-linked entries",
      "Searchable registry with rescan eligibility",
      "Pre-blocks targets in Phase 2 automatically",
    ],
    metrics: [
      "Registry entries",
      "Unique targets",
      "Global blocks",
      "Rescan eligible",
    ],
    link: "Explore registry",
  },
  portfolio: {
    headline: "One queue. Every program.",
    lead:
      "Every discovery program lands in a sortable portfolio queue with actionability zones — Act now, Too early, Crowded — and discovery confidence scoring for commercial prioritization.",
    solutionBridge:
      "Portfolio ROI decisions grounded in confidence tiers, not static point-in-time memos.",
    zones: [
      { label: "Act now", zone: "act_now" as const, width: 82 },
      { label: "Too early", zone: "too_early" as const, width: 45 },
      { label: "Crowded", zone: "crowded" as const, width: 68 },
    ],
  },
  trust: {
    headline: "Full audit trail",
    lead:
      "Every agent step, evidence card, and source citation is visible. Humans review reasoning — agents do the searching.",
    solutionBridge:
      "Agents run the pipeline; humans review evidence, sources, and reasoning.",
    items: [
      {
        title: "Live agent activity stream",
        desc: "Watch agents query PubMed, trials, and patents in real time.",
      },
      {
        title: "Evidence cards with citations",
        desc: "Every claim links to its public source.",
      },
      {
        title: "Program trust scoring",
        desc: "Funnel coverage and evidence depth in one confidence tier.",
      },
      {
        title: "Regulatory provenance",
        desc: "Act Now programs get FDA/EMA-ready assembly packages.",
      },
    ],
  },
  cta: {
    headline: "Start your first discovery",
    subline:
      "Upload a cohort. Define your question. See what expert review wouldn't find.",
    button: "Launch discovery",
  },
  footer: {
    tagline: "Living discovery platform for the life sciences.",
    copyright: "© Arclight Bio · Discovery Program",
  },
} as const;
