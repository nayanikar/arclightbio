"use client";

import { HomeHero } from "./HomeHero";
import { HomeLiveData } from "./HomeLiveData";
import { HomeProblemStatement } from "./HomeProblemStatement";
import { HomeAnchorFeature } from "./HomeAnchorFeature";
import { HomeExpertDomainsFeature } from "./HomeExpertDomainsFeature";
import { HomeFunnelFeature } from "./HomeFunnelFeature";
import { HomePhaseTwo } from "./HomePhaseTwo";
import { HomeRegistryFeature } from "./HomeRegistryFeature";
import { HomePortfolioTrust } from "./HomePortfolioTrust";
import { HomeCta } from "./HomeCta";
import { HomeFooter } from "./HomeFooter";

export function HomePage() {
  return (
    <div className="home-page">
      <HomeHero />
      <HomeLiveData />
      <HomeProblemStatement />
      <HomeAnchorFeature />
      <HomeExpertDomainsFeature />
      <HomeFunnelFeature />
      <HomePhaseTwo />
      <HomeRegistryFeature />
      <HomePortfolioTrust />
      <HomeCta />
      <HomeFooter />
    </div>
  );
}
