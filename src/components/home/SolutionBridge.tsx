import { cn } from "@/lib/utils";

export function SolutionBridge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "home-solution-bridge border-l-2 py-2 pl-4 text-sm italic leading-relaxed",
        className
      )}
      style={{
        borderColor: "var(--v3-teal)",
        background: "rgba(26, 107, 99, 0.06)",
        color: "var(--color-text-secondary)",
      }}
    >
      {children}
    </p>
  );
}
