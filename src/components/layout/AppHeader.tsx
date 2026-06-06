"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { NavDrawer } from "./NavDrawer";
import { observatoryNavItem, primaryNavItems } from "./navConfig";

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/discover": "Discover",
  "/undruggable": "Undruggable",
  "/admin": "Admin",
};

function pageLabel(pathname: string): string | null {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  if (pathname.startsWith("/opportunity/")) return "Discovery";
  return null;
}

export function AppHeader() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [observatoryUrl, setObservatoryUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spacebase/observatory")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { url?: string } | null) => {
        if (data?.url) setObservatoryUrl(data.url);
      })
      .catch(() => {});
  }, []);

  const navItems = useMemo(() => {
    const items = [...primaryNavItems];
    if (observatoryUrl) items.push(observatoryNavItem(observatoryUrl));
    return items;
  }, [observatoryUrl]);

  const currentPage = pageLabel(pathname);

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          borderColor: "rgba(15, 26, 46, 0.08)",
          background: "rgba(248, 245, 239, 0.92)",
          height: "var(--app-header-height)",
        }}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
            style={{ color: "var(--v3-navy)" }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
            <Image
              src="/favicon.svg"
              alt="Arclight Bio"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-[6px]"
              priority
            />
            <div className="min-w-0">
              <p
                className="font-display text-sm font-semibold leading-none truncate"
                style={{ color: "var(--v3-navy)" }}
              >
                <span className="sm:hidden">Arclight</span>
                <span className="hidden sm:inline">Arclight Bio</span>
              </p>
              <p
                className="mt-0.5 truncate text-[10px]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {currentPage ?? "Opportunity Space"}
              </p>
            </div>
          </Link>
        </div>
      </header>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} items={navItems} />
    </>
  );
}
