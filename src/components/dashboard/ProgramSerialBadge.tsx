"use client";

import { cn } from "@/lib/utils";

interface ProgramSerialBadgeProps {
  serial: number;
  opportunityId: string;
  className?: string;
}

export function ProgramSerialBadge({
  serial,
  opportunityId,
  className,
}: ProgramSerialBadgeProps) {
  const label = serial.toString().padStart(2, "0");

  return (
    <span
      className={cn(
        "group/serial relative inline-flex shrink-0 cursor-default items-center justify-center",
        className
      )}
    >
      <span
        className="rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-wide transition-colors group-hover/serial:border-[var(--v3-teal)]/40 group-hover/serial:bg-[rgba(26,107,99,0.08)]"
        style={{
          borderColor: "rgba(15, 26, 46, 0.12)",
          background: "rgba(15, 26, 46, 0.04)",
          color: "var(--color-text-tertiary)",
        }}
        aria-describedby={`program-id-${serial}`}
      >
        #{label}
      </span>
      <span
        id={`program-id-${serial}`}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-max max-w-[min(320px,90vw)] -translate-x-1/2 rounded-lg border px-3 py-2 font-mono text-[10px] leading-relaxed shadow-lg group-hover/serial:block"
        style={{
          borderColor: "rgba(15, 26, 46, 0.12)",
          background: "var(--v3-navy)",
          color: "rgba(248,245,239,0.88)",
        }}
      >
        <span className="block text-[9px] uppercase tracking-[0.14em] text-white/45">
          Program ID
        </span>
        <span className="mt-1 block break-all">{opportunityId}</span>
      </span>
    </span>
  );
}
