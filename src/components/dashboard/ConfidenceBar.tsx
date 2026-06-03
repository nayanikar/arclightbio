interface ConfidenceBarProps {
  score: number;
  color: string;
  height?: number;
  className?: string;
}

export function ConfidenceBar({
  score,
  color,
  height = 5,
  className,
}: ConfidenceBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(score * 100)));

  return (
    <div
      className={className}
      style={{
        flex: 1,
        height,
        background: "var(--color-background-secondary)",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}
