"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

interface NavigationContextValue {
  isNavigating: boolean;
  pendingHref: string | null;
  pendingLabel: string | null;
  startNavigation: (href: string, label?: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return ctx;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);

  const isNavigating = pendingHref !== null;

  useEffect(() => {
    if (pendingHref && pathname === pendingHref) {
      setPendingHref(null);
      setPendingLabel(null);
    }
  }, [pathname, pendingHref]);

  useEffect(() => {
    if (!pendingHref) return;
    const timeout = window.setTimeout(() => {
      setPendingHref(null);
      setPendingLabel(null);
    }, 20_000);
    return () => window.clearTimeout(timeout);
  }, [pendingHref]);

  const startNavigation = useCallback(
    (href: string, label?: string) => {
      if (href === pathname) return;
      setPendingHref(href);
      setPendingLabel(label ?? null);
    },
    [pathname]
  );

  return (
    <NavigationContext.Provider
      value={{
        isNavigating,
        pendingHref,
        pendingLabel,
        startNavigation,
      }}
    >
      {isNavigating && <NavigationProgressBar label={pendingLabel} />}
      {children}
    </NavigationContext.Provider>
  );
}

function NavigationProgressBar({ label }: { label: string | null }) {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] overflow-hidden bg-[var(--v3-teal)]/15"
        role="progressbar"
        aria-label={label ? `Opening ${label}` : "Loading page"}
        aria-valuetext="Loading"
      >
        <div className="nav-progress-indeterminate h-full w-1/3 bg-[var(--v3-teal)]" />
      </div>
      <p className="sr-only" aria-live="polite">
        {label ? `Opening ${label}…` : "Loading page…"}
      </p>
    </>
  );
}
