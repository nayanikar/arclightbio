import { cn } from "@/lib/utils";

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}

export function PageContent({
  children,
  className,
  narrow = false,
}: PageContentProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 py-6",
        narrow ? "max-w-2xl" : "max-w-7xl",
        className
      )}
    >
      {children}
    </div>
  );
}
