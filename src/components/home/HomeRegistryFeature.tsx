"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { homeCopy } from "./homeCopy";
import { marketingScreenshots } from "./homeAssets";
import { HomeFeatureSection } from "./HomeFeatureSection";

export function HomeRegistryFeature() {
  const c = homeCopy.registry;

  return (
    <HomeFeatureSection
      id="registry"
      eyebrow={c.eyebrow}
      headline={c.headline}
      lead={c.lead}
      solutionBridge={c.solutionBridge}
      bullets={c.bullets}
      imageSrc={marketingScreenshots.undruggableRegistry.src}
      imageAlt={marketingScreenshots.undruggableRegistry.alt}
      reverse
      dark
      footer={
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {c.metrics.map((label, i) => (
              <div
                key={label}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-center"
              >
                <p className="font-display text-xl font-medium tabular-nums text-white">
                  {["12", "8", "5", "3"][i]}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-white/45">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/undruggable"
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            {c.link}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      }
    >
      <div
        className="rounded-xl border border-white/10 p-6"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <p className="text-sm font-medium text-white/80">Registry at a glance</p>
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          Targets that fail three-modality screening are blocked in future programs.
          Global and session-scoped entries with alternate intervention paths.
        </p>
      </div>
    </HomeFeatureSection>
  );
}
