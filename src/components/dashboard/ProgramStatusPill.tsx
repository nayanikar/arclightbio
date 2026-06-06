import type { OpportunityStatus } from "@/types/OpportunityObject";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  agents_running: {
    bg: "rgba(26, 107, 99, 0.12)",
    color: "var(--v3-teal)",
    border: "rgba(26, 107, 99, 0.25)",
  },
  paused: {
    bg: "rgba(196, 132, 45, 0.12)",
    color: "var(--v3-amber)",
    border: "rgba(196, 132, 45, 0.25)",
  },
  surveillance: {
    bg: "rgba(26, 107, 99, 0.08)",
    color: "#0a5249",
    border: "rgba(26, 107, 99, 0.15)",
  },
  complete: {
    bg: "rgba(15, 26, 46, 0.06)",
    color: "var(--v3-navy)",
    border: "rgba(15, 26, 46, 0.12)",
  },
  agents_failed: {
    bg: "rgba(216, 90, 48, 0.1)",
    color: "#D85A30",
    border: "rgba(216, 90, 48, 0.2)",
  },
  initialising: {
    bg: "rgba(55, 138, 221, 0.1)",
    color: "#378ADD",
    border: "rgba(55, 138, 221, 0.2)",
  },
};

interface ProgramStatusPillProps {
  status: OpportunityStatus;
  isRunning?: boolean;
  className?: string;
}

export function ProgramStatusPill({
  status,
  isRunning,
  className,
}: ProgramStatusPillProps) {
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.complete;
  const label = status.replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        className
      )}
      style={{
        background: styles.bg,
        color: styles.color,
        borderColor: styles.border,
      }}
    >
      {(isRunning || status === "agents_running") && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400/70 opacity-75" />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--v3-teal-light)" }}
          />
        </span>
      )}
      {label}
    </span>
  );
}
