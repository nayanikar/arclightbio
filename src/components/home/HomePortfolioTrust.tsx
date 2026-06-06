"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { pageShell } from "@/components/layout/pageLayout";
import { homeCopy } from "./homeCopy";
import { marketingScreenshots, marketingAssetsReady } from "./homeAssets";
import { ScrollReveal } from "./ScrollReveal";
import { SolutionBridge } from "./SolutionBridge";
import { HomeScreenshot } from "./HomeScreenshot";
import { staggerSlow, fadeUp } from "./homeMotion";
import { ZoneSpectrum } from "./visuals/ZoneSpectrum";

export function HomePortfolioTrust() {
  return (
    <section
      id="portfolio"
      className="scroll-mt-[var(--app-header-height)] py-20 sm:py-28"
    >
      <div className={pageShell}>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <ScrollReveal>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.2em]"
              style={{ color: "var(--v3-teal)" }}
            >
              Portfolio
            </p>
            <h2
              className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{ color: "var(--v3-navy)" }}
            >
              {homeCopy.portfolio.headline}
            </h2>
            <p
              className="mt-4 text-base leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {homeCopy.portfolio.lead}
            </p>
            <div className="mt-5">
              <SolutionBridge>{homeCopy.portfolio.solutionBridge}</SolutionBridge>
            </div>
            <div className="mt-8">
              {marketingAssetsReady ? (
                <HomeScreenshot
                  src={marketingScreenshots.dashboard.src}
                  alt={marketingScreenshots.dashboard.alt}
                  fallback={
                    <div className="rounded-2xl border bg-[var(--v3-paper)] p-6 sm:p-8">
                      <ZoneSpectrum />
                    </div>
                  }
                />
              ) : (
                <div className="rounded-2xl border bg-[var(--v3-paper)] p-6 sm:p-8">
                  <ZoneSpectrum />
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.2em]"
              style={{ color: "var(--v3-teal)" }}
            >
              Trust
            </p>
            <h2
              className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{ color: "var(--v3-navy)" }}
            >
              {homeCopy.trust.headline}
            </h2>
            <p
              className="mt-4 text-base leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {homeCopy.trust.lead}
            </p>
            <div className="mt-5">
              <SolutionBridge>{homeCopy.trust.solutionBridge}</SolutionBridge>
            </div>
            <motion.ul
              className="mt-8 space-y-5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={staggerSlow}
            >
              {homeCopy.trust.items.map((item) => (
                <motion.li
                  key={item.title}
                  variants={fadeUp}
                  className="flex items-start gap-3"
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "rgba(26, 107, 99, 0.12)",
                      color: "var(--v3-teal)",
                    }}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "var(--v3-navy)" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="mt-0.5 text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
