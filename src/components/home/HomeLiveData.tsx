"use client";

import { homeCopy } from "./homeCopy";
import { ScrollReveal } from "./ScrollReveal";

export function HomeLiveData() {
  const c = homeCopy.liveData;

  return (
    <section
      className="border-y py-10 sm:py-12"
      style={{
        borderColor: "rgba(15, 26, 46, 0.08)",
        background: "var(--v3-paper)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <ScrollReveal immediate className="mx-auto max-w-2xl text-center">
          <p
            className="text-[11px] font-medium uppercase tracking-[0.2em]"
            style={{ color: "var(--v3-teal)" }}
          >
            {c.eyebrow}
          </p>
          <h2
            className="font-display mt-2 text-xl font-semibold sm:text-2xl"
            style={{ color: "var(--v3-navy)" }}
          >
            {c.headline}
          </h2>
          <p
            className="mt-3 text-sm leading-relaxed sm:text-base"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {c.body}
          </p>
        </ScrollReveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {c.sources.map((source, i) => (
            <ScrollReveal key={source.name} delay={i * 0.06}>
              <div
                className="rounded-xl border px-5 py-4 text-center"
                style={{
                  borderColor: "rgba(15, 26, 46, 0.1)",
                  background: "rgba(255,255,255,0.7)",
                }}
              >
                <p
                  className="font-display text-base font-semibold"
                  style={{ color: "var(--v3-navy)" }}
                >
                  {source.name}
                </p>
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {source.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
