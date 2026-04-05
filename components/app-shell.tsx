"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto overflow-x-hidden app-scrollbar">
        <div key={pathname} className="mx-auto max-w-6xl p-6 animate-page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}
