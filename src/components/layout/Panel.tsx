import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  noPadding = false,
}: PanelProps) {
  const hasHeader = title || description || action;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-sm",
        className
      )}
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      {hasHeader && (
        <div
          className="flex items-start justify-between gap-4 border-b px-5 py-4"
          style={{ borderColor: "var(--color-border-tertiary)" }}
        >
          <div className="min-w-0">
            {title && (
              <h2
                className="font-display text-base font-semibold tracking-tight"
                style={{ color: "var(--color-text-primary)" }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 text-xs font-semibold uppercase tracking-widest"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      {children}
    </p>
  );
}
