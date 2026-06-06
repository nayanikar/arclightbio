export function MeshBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="v3-notebook-grid absolute inset-0 opacity-40" />
      <div
        className="home-mesh-drift absolute -left-1/4 -top-1/4 h-[70%] w-[70%] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle, rgba(83, 74, 183, 0.18) 0%, transparent 70%)",
          mixBlendMode: "multiply",
        }}
      />
      <div
        className="home-mesh-drift-reverse absolute -bottom-1/4 -right-1/4 h-[65%] w-[65%] rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(42, 157, 143, 0.22) 0%, transparent 68%)",
          mixBlendMode: "multiply",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--v3-teal), var(--v3-amber), transparent)",
          opacity: 0.35,
        }}
      />
    </div>
  );
}
