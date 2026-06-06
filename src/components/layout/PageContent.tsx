import { PAGE_GUTTER, PAGE_MAX, PAGE_MAX_NARROW } from "@/components/layout/pageLayout";
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
        PAGE_GUTTER,
        "mx-auto w-full pb-[max(3rem,env(safe-area-inset-bottom,0px)+2rem)]",
        flush ? "pt-0" : "pt-4 sm:pt-6",
        narrow ? PAGE_MAX_NARROW : PAGE_MAX,
        className
      )}
    >
      {children}
    </div>
  );
}
