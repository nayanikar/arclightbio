import { callAgentJson } from "@/api/anthropic";
import type { OpportunityObject } from "@/types/OpportunityObject";
import type { AnchorProfile, AnchorProfiles } from "@/types/V3Pipeline";
import { updateV3OpportunityFields } from "@/lib/v3Db";
import { parseMarketSizeUsdB } from "@/lib/parseMarketSize";
import { sanitizeScientificClaim } from "@/lib/scientificLanguage";
import {
  buildPhase1PromptHeader,
  formatAnchorBlock,
  JSON_ONLY_SUFFIX,
  loadPhase1Context,
} from "./shared";

const SYSTEM = `You are the Market Size Agent for Arclight Bio V3 Phase 1.
Estimate addressable market size per anchor population (USD billions, rough order-of-magnitude).
Use epidemiology, precedent therapy markets, or literature-informed rough guesses — precision is not required.
Return JSON:
{
  "biology": {
    "market_size_usd_b": number,
    "market_size_rationale": string,
    "market_size": string
  },
  "resistance": {
    "market_size_usd_b": number,
    "market_size_rationale": string,
    "market_size": string
  }
}
market_size_rationale: one sentence explaining the rough estimate.
market_size: legacy display string e.g. "~$8B".${JSON_ONLY_SUFFIX}`;

interface MarketAnchorPayload {
  market_size_usd_b?: number;
  market_size_rationale?: string;
  market_size?: string;
}

interface MarketPayload {
  biology: MarketAnchorPayload;
  resistance: MarketAnchorPayload;
}

const FALLBACK_BIOLOGY: MarketAnchorPayload = {
  market_size_usd_b: 5,
  market_size_rationale: "Rough global addressable market for the biology anchor population based on oncology precedent therapies.",
  market_size: "~$5B",
};

const FALLBACK_RESISTANCE: MarketAnchorPayload = {
  market_size_usd_b: 2,
  market_size_rationale: "Refractory subset typically represents a smaller fraction of the broader indication market.",
  market_size: "~$2B",
};

function mergeMarketFields(
  existing: AnchorProfile,
  payload: MarketAnchorPayload,
  fallback: MarketAnchorPayload
): AnchorProfile {
  const usdB =
    typeof payload.market_size_usd_b === "number" && !Number.isNaN(payload.market_size_usd_b)
      ? payload.market_size_usd_b
      : parseMarketSizeUsdB(payload.market_size) ??
        fallback.market_size_usd_b ??
        null;

  const rationale = sanitizeScientificClaim(
    payload.market_size_rationale ?? fallback.market_size_rationale ?? ""
  );
  const marketSize = sanitizeScientificClaim(
    payload.market_size ??
      (usdB != null ? `~$${usdB}B` : fallback.market_size ?? "")
  );

  return {
    ...existing,
    market_size_usd_b: usdB ?? undefined,
    market_size_rationale: rationale || undefined,
    market_size: marketSize || undefined,
  };
}

export async function marketSizeAgent(
  obj: OpportunityObject
): Promise<AnchorProfiles> {
  const ctx = await loadPhase1Context(obj);
  if (!ctx.anchor_profiles) {
    throw new Error("anchorPopulationAgent must run before marketSizeAgent");
  }

  let markets: MarketPayload;
  try {
    markets = await callAgentJson<MarketPayload>(
      SYSTEM,
      `${buildPhase1PromptHeader(ctx)}

${formatAnchorBlock(ctx.anchor_profiles)}

Estimate global addressable market for each anchor sub-population.`
    );
  } catch {
    markets = {
      biology: FALLBACK_BIOLOGY,
      resistance: FALLBACK_RESISTANCE,
    };
  }

  const anchor_profiles: AnchorProfiles = {
    biology: mergeMarketFields(ctx.anchor_profiles.biology, markets.biology, FALLBACK_BIOLOGY),
    resistance: mergeMarketFields(
      ctx.anchor_profiles.resistance,
      markets.resistance,
      FALLBACK_RESISTANCE
    ),
  };

  await updateV3OpportunityFields(ctx.id, {
    anchor_profiles,
    v3_phase: "phase1:market_size",
  });
  return anchor_profiles;
}
