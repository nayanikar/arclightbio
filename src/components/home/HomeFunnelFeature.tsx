"use client";

import { homeCopy } from "./homeCopy";
import { marketingScreenshots } from "./homeAssets";
import { HomeFeatureSection } from "./HomeFeatureSection";
import { FunnelDiagram } from "./visuals/FunnelDiagram";

export function HomeFunnelFeature() {
  const c = homeCopy.funnel;

  return (
    <section
      id="funnel"
      className="scroll-mt-[var(--app-header-height)] py-20 sm:py-28"
      style={{ background: "rgba(26, 107, 99, 0.04)" }}
    >
      <HomeFeatureSection
        embedded
        id="funnel-content"
        eyebrow={c.eyebrow}
        headline={c.headline}
        lead={c.lead}
        solutionBridge={c.solutionBridge}
        bullets={c.bullets}
        callout={c.callout}
        imageSrc={marketingScreenshots.hypothesisFunnel.src}
        imageAlt={marketingScreenshots.hypothesisFunnel.alt}
      >
        <FunnelDiagram />
      </HomeFeatureSection>
    </section>
  );
}
