"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageShell } from "@/components/layout/pageLayout";
import { homeCopy } from "./homeCopy";
import { ScrollReveal } from "./ScrollReveal";

export function HomeCta() {
  return (
    <section className="pb-12 pt-8 sm:pb-16">
      <div className={pageShell}>
        <ScrollReveal>
          <div
            className="relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-12 sm:py-20"
            style={{
              background:
                "linear-gradient(135deg, var(--v3-navy) 0%, #1a2840 50%, var(--v3-teal) 120%)",
            }}
          >
            <div
              className="v3-notebook-grid pointer-events-none absolute inset-0 opacity-[0.07]"
              aria-hidden
            />
            <h2 className="font-display relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {homeCopy.cta.headline}
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-base text-white/70">
              {homeCopy.cta.subline}
            </p>
            <Link href="/discover" className="relative mt-8 inline-block">
              <Button
                size="lg"
                className="bg-white px-8 text-[var(--v3-navy)] hover:bg-white/90"
              >
                {homeCopy.cta.button}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
