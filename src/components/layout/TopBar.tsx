"use client";

import { pageShell, pageShellNarrow } from "@/components/layout/pageLayout";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  /** Match narrow form pages (discover) */
  narrow?: boolean;
  /** Tighter spacing when stacked under AppHeader */
  compact?: boolean;
}

export function TopBar({
  title,
  subtitle,
  badge,
  narrow = false,
  compact = true,
}: TopBarProps) {
  const shell = narrow ? pageShellNarrow : pageShell;
  const hasHeading = Boolean(title || subtitle);

  return (
    <div
      role="region"
      aria-label="Page heading"
      className={cn(
        shell,
        compact ? "pb-2 pt-4 sm:pb-3 sm:pt-5" : "py-5 sm:py-6"
      )}
    >
      <div
        className={cn(
          "flex gap-3",
          hasHeading
            ? "flex-col lg:flex-row lg:items-end lg:justify-between"
            : "min-h-10 items-center justify-end"
        )}
      >
        {hasHeading && (
          <div className="min-w-0 flex-1">
            {title && (
              <h1
                className="font-display text-xl font-semibold tracking-tight text-balance sm:text-2xl"
                style={{ color: "var(--color-text-primary)" }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  title ? "mt-1.5" : "",
                  "line-clamp-3"
                )}
                style={{ color: "var(--color-text-secondary)" }}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}
        {badge && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}
