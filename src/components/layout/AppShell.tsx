"use client";

import { DevShortcut } from "./DevShortcut";
import { AppHeader } from "./AppHeader";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <DevShortcut />
      <AppHeader />
      <main className="w-full min-w-0 flex-1 bg-content-bg">{children}</main>
    </div>
  );
}
