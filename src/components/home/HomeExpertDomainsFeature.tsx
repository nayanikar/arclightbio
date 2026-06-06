"use client";

import { homeCopy } from "./homeCopy";
import { marketingScreenshots } from "./homeAssets";
import { HomeFeatureSection } from "./HomeFeatureSection";
import { ExpertDomainMerger } from "./visuals/ExpertDomainMerger";

export function HomeExpertDomainsFeature() {
  const c = homeCopy.expertDomains;
  return (
    <HomeFeatureSection
      id="expert-domains"
      eyebrow={c.eyebrow}
      headline={c.headline}
      lead={c.lead}
      solutionBridge={c.solutionBridge}
      bullets={c.bullets}
      callout={c.callout}
      imageSrc={marketingScreenshots.expertDomains.src}
      imageAlt={marketingScreenshots.expertDomains.alt}
      reverse
    >
      <ExpertDomainMerger />
    </HomeFeatureSection>
  );
}
