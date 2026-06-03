"use client";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
}

export function TopBar({ title, subtitle, badge }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-10 border-b bg-white/90 px-6 py-4 backdrop-blur-sm"
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="min-w-0">
          {title && (
            <h1
              className="truncate text-lg font-semibold tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              className="mt-0.5 truncate text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
    </header>
  );
}
