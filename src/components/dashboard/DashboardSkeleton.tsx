export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] rounded-lg"
            style={{ background: "var(--color-background-secondary)" }}
          />
        ))}
      </div>

      <div
        className="h-[200px] rounded-xl"
        style={{ background: "var(--color-background-secondary)" }}
      />

      <div className="grid grid-cols-2 gap-3">
        <div
          className="h-[140px] rounded-xl"
          style={{ background: "var(--color-background-secondary)" }}
        />
        <div
          className="h-[140px] rounded-xl"
          style={{ background: "var(--color-background-secondary)" }}
        />
      </div>
    </div>
  );
}
