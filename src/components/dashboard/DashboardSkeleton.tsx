export function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div
        className="grid grid-cols-2 gap-px overflow-clip rounded-xl border sm:grid-cols-3 lg:grid-cols-6"
        style={{
          borderColor: "rgba(15, 26, 46, 0.1)",
          background: "rgba(15, 26, 46, 0.06)",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px]"
            style={{ background: "var(--v3-paper)" }}
          />
        ))}
      </div>

      <div className="flex justify-between">
        <div
          className="h-4 w-32 rounded"
          style={{ background: "var(--color-background-secondary)" }}
        />
        <div
          className="h-8 w-48 rounded-lg"
          style={{ background: "var(--color-background-secondary)" }}
        />
      </div>

      <div
        className="overflow-clip rounded-xl border"
        style={{
          borderColor: "rgba(15, 26, 46, 0.1)",
          background: "var(--v3-paper)",
        }}
      >
        <div
          className="h-9 border-b"
          style={{
            borderColor: "rgba(15, 26, 46, 0.06)",
            background: "rgba(26, 107, 99, 0.04)",
          }}
        />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 border-b px-4 py-4 last:border-b-0"
            style={{ borderColor: "rgba(15, 26, 46, 0.06)" }}
          >
            <div
              className="h-4 flex-1 rounded"
              style={{ background: "var(--color-background-secondary)" }}
            />
            <div
              className="h-4 w-16 rounded"
              style={{ background: "var(--color-background-secondary)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
