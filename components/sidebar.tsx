"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Users,
  FileText,
  ScrollText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/contracts", label: "Contracts", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-outline-variant/30 bg-[linear-gradient(180deg,rgba(77,142,255,0.14)_0%,rgba(23,28,43,0.95)_24%,rgba(15,19,30,0.98)_100%)] smooth-transition duration-300 ease-out shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)]",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-outline-variant/30 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-stitch to-primary-container text-on-primary-fixed font-bold text-sm shadow-[0_10px_24px_-10px_rgba(173,198,255,0.65)]">
          /
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-white/95">
            Slash Invoices
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1.5 p-2.5">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium smooth-transition",
                isActive
                  ? "bg-[linear-gradient(135deg,rgba(173,198,255,0.18),rgba(77,142,255,0.22))] text-white shadow-[inset_0_0_0_1px_rgba(173,198,255,0.24)]"
                  : "text-outline-stitch hover:bg-surface-container/80 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border smooth-transition",
                  isActive
                    ? "border-primary-stitch/45 bg-primary-stitch/15 text-primary-fixed"
                    : "border-outline-variant/35 bg-surface-container/60 text-outline-stitch group-hover:border-outline-variant/50 group-hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-1.5 border-t border-outline-variant/30 p-2.5">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-outline-stitch hover:bg-surface-container/80 hover:text-white smooth-transition"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-outline-variant/35 bg-surface-container/60">
            <LogOut className="h-4 w-4 shrink-0" />
          </span>
          {!collapsed && <span>Sign Out</span>}
        </button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-9 w-full rounded-xl border-outline-variant/40 bg-surface-container/70 text-white hover:bg-surface-container-high"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
