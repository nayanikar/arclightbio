"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp, viewportOnce } from "./homeMotion";

interface HomeScreenshotProps {
  src: string;
  alt: string;
  fallback?: React.ReactNode;
  className?: string;
  priority?: boolean;
  /** Skip scroll-trigger; animate on mount (hero, above-fold) */
  animateOnMount?: boolean;
  /** Plain panel without browser chrome — for diagram fallbacks */
  plain?: boolean;
}

export function HomeScreenshot({
  src,
  alt,
  fallback,
  className,
  priority = false,
  animateOnMount = false,
  plain = false,
}: HomeScreenshotProps) {
  const [failed, setFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  const showFallback = failed && fallback;

  const motionProps = reduceMotion
    ? {}
    : animateOnMount
      ? { initial: "hidden" as const, animate: "visible" as const, variants: fadeUp }
      : {
          initial: "hidden" as const,
          whileInView: "visible" as const,
          viewport: viewportOnce,
          variants: fadeUp,
        };

  if (plain && showFallback) {
    return (
      <motion.div {...motionProps} className={cn(className)}>
        {fallback}
      </motion.div>
    );
  }

  return (
    <motion.div
      {...motionProps}
      className={cn(
        "overflow-hidden rounded-xl border shadow-[0_20px_40px_rgba(15,26,46,0.08)]",
        className
      )}
      style={{ borderColor: "rgba(15, 26, 46, 0.1)" }}
    >
      {!plain && !showFallback && (
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          style={{
            background: "var(--v3-paper)",
            borderColor: "rgba(15, 26, 46, 0.08)",
          }}
        >
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span
            className="ml-2 truncate text-[11px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Arclight Bio
          </span>
        </div>
      )}
      <div className="relative bg-[var(--v3-paper)]">
        {showFallback ? (
          <div className="p-4 sm:p-5">{fallback}</div>
        ) : (
          <Image
            src={src}
            alt={alt}
            width={1440}
            height={900}
            priority={priority}
            className="h-auto w-full object-cover object-top"
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </motion.div>
  );
}
