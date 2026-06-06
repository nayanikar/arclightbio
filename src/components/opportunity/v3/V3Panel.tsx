"use client";

import { cn } from "@/lib/utils";

interface V3PanelProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}

export function V3Panel({
  title,
  description,
  action,
  children,
  className,
  accent = false,
}: V3PanelProps) {
  return (
    <section
      className={cn(
        "v3-panel overflow-x-hidden rounded-xl border shadow-sm",
        className
      )}
    >
      <div className={cn("v3-accent-rule", !accent && "opacity-60")} />
      <div
        className="flex items-start justify-between gap-4 border-b px-5 py-4"
        style={{
          borderColor: "rgba(15, 26, 46, 0.08)",
          background: "linear-gradient(180deg, rgba(15,26,46,0.02) 0%, transparent 100%)",
        }}
      >
        <div className="min-w-0">
          <h2
            className="font-display text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--v3-navy)" }}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function V3SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em]"
      style={{ color: "var(--v3-teal)" }}
    >
      {children}
    </p>
  );
}
