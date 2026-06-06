"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageShell } from "@/components/layout/pageLayout";
import { cn } from "@/lib/utils";
import { homeCopy } from "./homeCopy";
import { marketingScreenshots, marketingAssetsReady } from "./homeAssets";
import { StaggerChildren, StaggerItem } from "./StaggerChildren";
import { SolutionBridge } from "./SolutionBridge";
import { HomeScreenshot } from "./HomeScreenshot";
import { MeshBackground } from "./visuals/MeshBackground";

const HEADLINE_WORDS = homeCopy.hero.headline.split(" ");

export function HomeHero() {
  return (
    <section className="relative flex min-h-[calc(100dvh-var(--app-header-height))] flex-col justify-center overflow-hidden pb-16 pt-10 sm:pb-20 sm:pt-14">
      <MeshBackground />

      <div className={cn(pageShell, "relative z-10")}>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <StaggerChildren animateOnMount className="space-y-6">
              <StaggerItem>
                <p
                  className="text-[11px] font-medium uppercase tracking-[0.22em]"
                  style={{ color: "var(--v3-teal)" }}
                >
                  {homeCopy.hero.eyebrow}
                </p>
              </StaggerItem>

              <StaggerItem>
                <h1
                  className="font-display text-[clamp(2rem,5.5vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.02em]"
                  style={{ color: "var(--v3-navy)" }}
                >
                  {HEADLINE_WORDS.map((word, i) => (
                    <span key={i} className="inline-block">
                      {word}
                      {i < HEADLINE_WORDS.length - 1 ? "\u00A0" : ""}
                    </span>
                  ))}
                </h1>
              </StaggerItem>

              <StaggerItem>
                <p
                  className="text-base leading-relaxed sm:text-lg"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {homeCopy.hero.lead}
                </p>
              </StaggerItem>

              <StaggerItem>
                <SolutionBridge>{homeCopy.hero.solutionBridge}</SolutionBridge>
              </StaggerItem>

              <StaggerItem>
                <ul className="space-y-2">
                  {homeCopy.hero.bullets.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      <span style={{ color: "var(--v3-teal)" }} aria-hidden>
                        ·
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </StaggerItem>

              <StaggerItem>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link href="/discover">
                    <Button
                      size="lg"
                      className="bg-[var(--v3-teal)] px-6 hover:bg-[var(--v3-teal-light)]"
                    >
                      {homeCopy.hero.ctaPrimary}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-[var(--v3-navy)]/20 bg-white/60 backdrop-blur-sm hover:bg-white/90"
                      style={{ color: "var(--v3-navy)" }}
                    >
                      {homeCopy.hero.ctaSecondary}
                    </Button>
                  </Link>
                </div>
              </StaggerItem>
            </StaggerChildren>
          </div>

          <div className="hidden lg:block">
            {marketingAssetsReady ? (
              <HomeScreenshot
                src={marketingScreenshots.dashboard.src}
                alt={marketingScreenshots.dashboard.alt}
                priority
                animateOnMount
                fallback={
                  <div
                    className="flex h-64 items-center justify-center text-sm"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    Portfolio queue preview
                  </div>
                }
              />
            ) : (
              <div
                className="rounded-xl border p-8"
                style={{
                  borderColor: "rgba(15, 26, 46, 0.1)",
                  background: "var(--v3-paper)",
                }}
              >
                <p
                  className="text-[11px] font-medium uppercase tracking-[0.18em]"
                  style={{ color: "var(--v3-teal)" }}
                >
                  Portfolio queue
                </p>
                <p
                  className="font-display mt-3 text-2xl font-semibold"
                  style={{ color: "var(--v3-navy)" }}
                >
                  Every program, one view
                </p>
                <p
                  className="mt-2 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Sort by confidence, recency, or phase. Act Now · Too early · Crowded.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
