"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, LayoutDashboard, Search } from "lucide-react";
import { OpportunitySidebarRail } from "@/components/opportunity/OpportunitySidebarRail";
import { useSurveillanceSessionControls } from "@/hooks/useSurveillanceSessionControls";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Search },
];

const OPPORTUNITY_PATH = /^\/opportunity\/[^/]+$/;

function OpportunitySidebarRailSlot() {
  const { handleResume, resuming } = useSurveillanceSessionControls();
  return <OpportunitySidebarRail onResume={handleResume} resuming={resuming} />;
}

export function Sidebar() {
  const pathname = usePathname();
  const [observatoryUrl, setObservatoryUrl] = useState<string | null>(null);
  const isOpportunityPage = OPPORTUNITY_PATH.test(pathname ?? "");

  useEffect(() => {
    fetch("/api/spacebase/observatory")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { url?: string } | null) => {
        if (data?.url) setObservatoryUrl(data.url);
      })
      .catch(() => {});
  }, []);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r text-white",
        isOpportunityPage ? "w-[280px]" : "w-[220px]"
      )}
      style={{
        background: "linear-gradient(180deg, #1A1528 0%, #12101C 100%)",
        borderColor: "rgba(83, 74, 183, 0.15)",
      }}
    >
      <div className="shrink-0 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <Image
            src="/favicon.svg"
            alt="Arclight Bio"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-[7px]"
            priority
          />
          <div>
            <p className="text-sm font-semibold leading-none">Arclight Bio</p>
            <p className="mt-1 text-[11px] text-white/50">Opportunity Space</p>
          </div>
        </div>
      </div>

      <nav className="shrink-0 space-y-0.5 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-purple/20 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
        {observatoryUrl ? (
          <a
            href={observatoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Open Observatory
          </a>
        ) : null}
      </nav>

      {isOpportunityPage && (
        <div className="hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex">
          <OpportunitySidebarRailSlot />
        </div>
      )}

      <div className="shrink-0 border-t border-white/10 px-5 py-4">
        <p className="text-[10px] uppercase tracking-wider text-white/35">
          Living Discovery Engine
        </p>
        <p className="mt-1 text-[10px] text-white/35">Nucleate NY BioHack 2026</p>
      </div>
    </aside>
  );
}
