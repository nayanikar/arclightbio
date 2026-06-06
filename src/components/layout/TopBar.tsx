"use client";

import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  /** Match PageContent narrow width for title/form alignment */
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
  return (
    <div
      role="region"
      aria-label="Page heading"
      className={cn(
        "px-4 sm:px-6",
        compact ? "pb-1 pt-3 sm:pb-2 sm:pt-4" : "py-4"
      )}
    >
      <div
        className={cn(
          "mx-auto flex flex-col gap-2 lg:flex-row lg:items-center",
          !title && !subtitle ? "lg:justify-end" : "lg:justify-between",
          narrow ? "max-w-3xl" : "max-w-7xl"
        )}
      >
        <div className={cn("min-w-0", (title || subtitle) && "flex-1")}>
          {title && (
            <h1
              className="font-display text-lg font-semibold tracking-tight text-balance sm:text-xl"
              style={{ color: "var(--color-text-primary)" }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              className="mt-1 line-clamp-3 text-sm leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {badge && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}
