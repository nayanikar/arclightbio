"use client";

import { pageShell } from "@/components/layout/pageLayout";
import { cn } from "@/lib/utils";
import { homeCopy } from "./homeCopy";
import { ScrollReveal } from "./ScrollReveal";
import { DiscoveryPipeline } from "./visuals/DiscoveryPipeline";

function ProblemCard({
  eyebrow,
  headline,
  body,
  bridge,
  extra,
}: {
  eyebrow: string;
  headline: string;
  body: string;
  bridge: string;
  extra?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-[var(--v3-paper)] p-6 sm:p-7",
        "border-l-[3px]"
      )}
      style={{
        borderColor: "rgba(15, 26, 46, 0.1)",
        borderLeftColor: "var(--v3-teal)",
      }}
    >
      <p
        className="text-[11px] font-medium uppercase tracking-[0.2em]"
        style={{ color: "var(--v3-teal)" }}
      >
        {eyebrow}
      </p>
      <h3
        className="font-display mt-3 text-xl font-semibold leading-snug"
        style={{ color: "var(--v3-navy)" }}
      >
        {headline}
      </h3>
      {body ? (
        <p
          className="mt-3 flex-1 text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {body}
        </p>
      ) : (
        <div className="flex-1" />
      )}
      {extra}
      <p
        className="mt-4 border-t pt-4 text-sm italic leading-relaxed"
        style={{
          borderColor: "rgba(15, 26, 46, 0.08)",
          color: "var(--v3-teal)",
        }}
      >
        {bridge}
      </p>
    </article>
  );
}

export function HomeProblemStatement() {
  const ps = homeCopy.problemStatement;

  return (
    <section
      id="problem"
      className="scroll-mt-[var(--app-header-height)] py-20 sm:py-28"
      style={{ background: "rgba(26, 107, 99, 0.03)" }}
    >
      <div className={pageShell}>
        <ScrollReveal immediate className="mx-auto mb-12 max-w-2xl text-center">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.2em]"
            style={{ color: "var(--v3-teal)" }}
          >
            {ps.sectionTitle}
          </p>
          <h2
            className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: "var(--v3-navy)" }}
          >
            Why teams choose Arclight
          </h2>
          <p
            className="mt-4 text-sm leading-relaxed sm:text-base"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {ps.audienceLabel}: {ps.audience.join(" · ")}
          </p>
        </ScrollReveal>

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          <ScrollReveal delay={0.05}>
            <ProblemCard
              eyebrow={ps.gap.eyebrow}
              headline={ps.gap.headline}
              body={ps.gap.body}
              bridge={ps.gap.bridge}
            />
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <ProblemCard
              eyebrow={ps.approach.eyebrow}
              headline={ps.approach.headline}
              body={ps.approach.body}
              bridge={ps.approach.bridge}
            />
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <ProblemCard
              eyebrow={ps.outcomes.eyebrow}
              headline={ps.outcomes.headline}
              body=""
              bridge={ps.outcomes.bridge}
              extra={
                <div
                  className="mt-3 space-y-3 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <p>
                    <strong style={{ color: "var(--v3-navy)" }}>
                      Commercial outcomes.
                    </strong>{" "}
                    {ps.outcomes.commercial}
                  </p>
                  <p>
                    <strong style={{ color: "var(--v3-navy)" }}>
                      Discovery efficiency.
                    </strong>{" "}
                    {ps.outcomes.efficiency}
                  </p>
                </div>
              }
            />
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.2} className="mt-14">
          <DiscoveryPipeline />
        </ScrollReveal>
      </div>
    </section>
  );
}
