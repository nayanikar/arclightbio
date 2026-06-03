import { Sidebar } from "./Sidebar";
import { DevShortcut } from "./DevShortcut";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <DevShortcut />
      <Sidebar />
      <main className="min-h-screen flex-1 overflow-x-hidden bg-content-bg">
        {children}
      </main>
    </div>
  );
}
