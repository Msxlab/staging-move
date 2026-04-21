"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  MapPin,
  Zap,
  Truck,
  Settings,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  DollarSign,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations("nav");

  // Keys map to `nav.*` in messages/en.json and messages/es.json. Do
  // NOT hardcode user-visible strings here — every label must be a
  // translation key so adding a third locale (pt, fr…) is a messages
  // change, not a sidebar change.
  const navigation = [
    { key: "dashboard", href: "/dashboard", icon: Home },
    { key: "addresses", href: "/addresses", icon: MapPin },
    { key: "services", href: "/services", icon: Zap },
    { key: "providers", href: "/providers", icon: Building2 },
    { key: "budget", href: "/budget", icon: DollarSign },
    { key: "moving", href: "/moving", icon: Truck },
  ] as const;

  const bottomNav = [
    { key: "help", href: "/help", icon: HelpCircle },
    { key: "settings", href: "/settings", icon: Settings },
  ] as const;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 z-20 border-r border-white/5 bg-white/[0.02] backdrop-blur-xl",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/5 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-cyan-500 flex items-center justify-center shrink-0">
            <Home className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-base font-bold bg-gradient-to-r from-orange-400 to-cyan-400 bg-clip-text text-transparent">
              LocateFlow
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const label = t(item.key);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-orange-500/15 text-orange-300"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              )}
              title={collapsed ? label : undefined}
            >
              <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-orange-400")} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/5 py-3 px-2 space-y-0.5 shrink-0">
        {bottomNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const label = t(item.key);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                isActive
                  ? "bg-orange-500/15 text-orange-300"
                  : "text-white/40 hover:text-white/70 hover:bg-white/5"
              )}
              title={collapsed ? label : undefined}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        <button
          className="w-full flex items-center justify-center py-2 rounded-xl text-white/20 hover:text-white/40 hover:bg-white/5 transition-all mt-1"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
