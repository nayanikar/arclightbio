"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Layers, X } from "lucide-react";
import { OpportunitySidebarRail } from "./OpportunitySidebarRail";
import { cn } from "@/lib/utils";

export function MobileEvidenceDrawer({
  onResume,
  resuming,
}: {
  onResume?: () => void;
  resuming?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="fixed bottom-4 right-4 z-40 gap-2 shadow-lg lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Layers className="h-4 w-4" />
        Evidence
      </Button>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
          aria-label="Close evidence drawer"
        />
        <div
          className={cn(
            "absolute bottom-0 left-0 top-0 flex w-[min(320px,90vw)] flex-col text-white shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
          style={{
            background: "linear-gradient(180deg, #1A1528 0%, #12101C 100%)",
          }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold">Evidence & surveillance</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <OpportunitySidebarRail onResume={onResume} resuming={resuming} />
        </div>
      </div>
    </>
  );
}
