"use client";

import { cn } from "@/lib/utils";
import { ScrollReveal } from "./ScrollReveal";
import { SolutionBridge } from "./SolutionBridge";
import { HomeScreenshot } from "./HomeScreenshot";
import { marketingAssetsReady } from "./homeAssets";

interface HomeFeatureSectionProps {
  id: string;
  eyebrow: string;
  headline: string;
  lead: string;
  solutionBridge: string;
  bullets: readonly string[];
  callout?: string;
  imageSrc?: string;
  imageAlt?: string;
  reverse?: boolean;
  dark?: boolean;
  embedded?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export function HomeFeatureSection({
  id,
  eyebrow,
  headline,
  lead,
  solutionBridge,
  bullets,
  callout,
  imageSrc,
  imageAlt,
  reverse = false,
  dark = false,
  embedded = false,
  children,
  footer,
}: HomeFeatureSectionProps) {
  const Tag = embedded ? "div" : "section";

  const textBlock = (
    <ScrollReveal className="space-y-5">
      <div>
        <p
          className="text-[11px] font-medium uppercase tracking-[0.2em]"
          style={{ color: dark ? "var(--v3-teal-light)" : "var(--v3-teal)" }}
        >
          {eyebrow}
        </p>
        <h2
          className={cn(
            "font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl",
            dark ? "text-white" : ""
          )}
          style={dark ? undefined : { color: "var(--v3-navy)" }}
        >
          {headline}
        </h2>
      </div>
      <p
        className="text-base leading-relaxed sm:text-[17px]"
        style={{ color: dark ? "rgba(255,255,255,0.75)" : "var(--color-text-secondary)" }}
      >
        {lead}
      </p>
      <SolutionBridge>{solutionBridge}</SolutionBridge>
      <ul className="space-y-2.5">
        {bullets.map((item) => (
          <li
            key={item}
            className="flex gap-2.5 text-sm leading-relaxed"
            style={{ color: dark ? "rgba(255,255,255,0.65)" : "var(--color-text-secondary)" }}
          >
            <span style={{ color: "var(--v3-teal)" }} aria-hidden>
              ·
            </span>
            {item}
          </li>
        ))}
      </ul>
      {callout && (
        <p
          className="font-display text-sm font-semibold"
          style={{ color: dark ? "var(--v3-amber)" : "var(--v3-navy)" }}
        >
          {callout}
        </p>
      )}
      {footer}
    </ScrollReveal>
  );

  const visualBlock =
    marketingAssetsReady && imageSrc && imageAlt ? (
      <HomeScreenshot src={imageSrc} alt={imageAlt} fallback={children} />
    ) : (
      children && <ScrollReveal delay={0.1}>{children}</ScrollReveal>
    );

  return (
    <Tag
      id={embedded ? undefined : id}
      className={cn(
        !embedded && "scroll-mt-[var(--app-header-height)] py-20 sm:py-28",
        dark && !embedded && ""
      )}
      style={
        dark && !embedded
          ? { background: "linear-gradient(180deg, #1A1528 0%, #12101C 100%)" }
          : undefined
      }
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div
          className={cn(
            "grid items-center gap-12 lg:grid-cols-2 lg:gap-16",
            reverse && "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1"
          )}
        >
          {textBlock}
          {visualBlock}
        </div>
      </div>
    </Tag>
  );
}
