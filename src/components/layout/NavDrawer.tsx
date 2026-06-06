"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItemConfig } from "./navConfig";

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  items: NavItemConfig[];
}

export function NavDrawer({ open, onClose, items }: NavDrawerProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-[min(280px,85vw)] flex-col text-white shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #1A1528 0%, #12101C 100%)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-sm font-semibold">Menu</p>
            <p className="mt-0.5 text-[11px] text-white/50">Arclight Bio</p>
          </div>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items.map(({ href, label, icon: Icon, external }) => {
            const active = !external && pathname === href;
            const className = cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-purple/20 text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            );

            if (external) {
              return (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  onClick={onClose}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </a>
              );
            }

            return (
              <Link key={href} href={href} className={className} onClick={onClose}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-white/10 px-5 py-4">
          <p className="text-[10px] uppercase tracking-wider text-white/35">
            Living Discovery Engine
          </p>
          <p className="mt-1 text-[10px] text-white/35">Nucleate NY BioHack 2026</p>
        </div>
      </aside>
    </>
  );
}
