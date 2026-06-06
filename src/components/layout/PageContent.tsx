import { cn } from "@/lib/utils";

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
  /** @deprecated use className="max-w-3xl" instead */
  narrow?: boolean;
  /** Reduce top padding when following TopBar */
  flush?: boolean;
}

export function PageContent({
  children,
  className,
  narrow = false,
  flush = false,
}: PageContentProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-[max(3rem,env(safe-area-inset-bottom,0px)+2rem)] sm:px-6",
        flush ? "pt-0" : "pt-4 sm:pt-6",
        narrow ? "max-w-3xl" : "max-w-7xl",
        className
      )}
    >
      {children}
    </div>
  );
}
