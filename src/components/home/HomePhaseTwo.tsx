"use client";

import { pageShell } from "@/components/layout/pageLayout";
import { homeCopy } from "./homeCopy";
import { marketingScreenshots, marketingAssetsReady } from "./homeAssets";
import { ScrollReveal } from "./ScrollReveal";
import { SolutionBridge } from "./SolutionBridge";
import { HomeScreenshot } from "./HomeScreenshot";
import { Phase2Pipeline } from "./visuals/Phase2Pipeline";

export function HomePhaseTwo() {
  const c = homeCopy.phaseTwo;

  return (
    <section className="py-20 sm:py-28">
      <div className={pageShell}>
        <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.2em]"
            style={{ color: "var(--v3-teal)" }}
          >
            {c.eyebrow}
          </p>
          <h2
            className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: "var(--v3-navy)" }}
          >
            {c.headline}
          </h2>
          <p
            className="mt-4 text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {c.lead}
          </p>
          <div className="mx-auto mt-6 max-w-xl text-left">
            <SolutionBridge>{c.solutionBridge}</SolutionBridge>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.08}>
          {marketingAssetsReady ? (
            <HomeScreenshot
              src={marketingScreenshots.phase2Ind.src}
              alt={marketingScreenshots.phase2Ind.alt}
              plain
              fallback={<Phase2Pipeline />}
            />
          ) : (
            <Phase2Pipeline />
          )}
        </ScrollReveal>
      </div>
    </section>
  );
}
