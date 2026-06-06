"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { NavDrawer } from "./NavDrawer";
import { primaryNavItems } from "./navConfig";
import { pageShell } from "./pageLayout";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }

    setScrolled(false);

    const onScroll = () => {
      setScrolled(window.scrollY > 48);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const solidHeader = !isHome || scrolled;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 border-b backdrop-blur-md transition-[background,border-color,box-shadow] duration-300",
          solidHeader ? "shadow-sm" : "border-transparent bg-transparent shadow-none backdrop-blur-none"
        )}
        style={{
          borderColor: solidHeader ? "rgba(15, 26, 46, 0.08)" : "transparent",
          background: solidHeader ? "rgba(248, 245, 239, 0.92)" : "transparent",
          height: "var(--app-header-height)",
        }}
      >
        <div className={cn(pageShell, "flex h-full items-center gap-3")}>
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

          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <Image
              src="/favicon.svg"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-[6px]"
              priority
            />
            <span
              className="font-brand text-[15px] font-normal leading-none tracking-[-0.01em] sm:text-[17px]"
              style={{ color: "var(--v3-navy)" }}
            >
              <span className="sm:hidden">Arclight</span>
              <span className="hidden sm:inline">Arclight Bio</span>
            </span>
          </Link>
        </div>
      </header>

      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={primaryNavItems}
      />
    </>
  );
}
