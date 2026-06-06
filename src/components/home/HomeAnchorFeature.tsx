"use client";

import { homeCopy } from "./homeCopy";
import { marketingScreenshots } from "./homeAssets";
import { HomeFeatureSection } from "./HomeFeatureSection";
import { AnchorDualCard } from "./visuals/AnchorDualCard";

export function HomeAnchorFeature() {
  const c = homeCopy.anchors;
  return (
    <HomeFeatureSection
      id="anchors"
      eyebrow={c.eyebrow}
      headline={c.headline}
      lead={c.lead}
      solutionBridge={c.solutionBridge}
      bullets={c.bullets}
      callout={c.callout}
      imageSrc={marketingScreenshots.anchors.src}
      imageAlt={marketingScreenshots.anchors.alt}
    >
      <AnchorDualCard />
    </HomeFeatureSection>
  );
}
