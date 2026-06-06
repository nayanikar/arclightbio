"use client";

import { cn } from "@/lib/utils";

export function V3Prose({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("v3-prose text-sm leading-[1.7]", className)} style={{ color: "var(--color-text-secondary)" }}>
      {children}
    </div>
  );
}

export function V3LabeledBlock({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-t pt-3 first:border-t-0 first:pt-0", className)} style={{ borderColor: "rgba(15,26,46,0.08)" }}>
      <p
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}

export function V3MetricRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 text-xs", className)}>
      <dt style={{ color: "var(--color-text-tertiary)" }}>{label}</dt>
      <dd className="font-medium text-right" style={{ color: "var(--v3-navy)" }}>
        {value}
      </dd>
    </div>
  );
}

export function V3InfoCallout({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg border px-4 py-3 text-sm leading-relaxed", className)}
      style={{
        borderColor: "rgba(26, 107, 99, 0.25)",
        background: "rgba(26, 107, 99, 0.06)",
        color: "var(--color-text-secondary)",
      }}
    >
      {title && (
        <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--v3-teal)" }}>
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
