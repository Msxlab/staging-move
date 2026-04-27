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
  Bell,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/marketing/logo";

interface SidebarProps {
  showBudget?: boolean;
}

export function Sidebar({ showBudget = true }: SidebarProps = {}) {
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
    ...(showBudget
      ? [{ key: "budget" as const, href: "/budget", icon: DollarSign }]
      : []),
    { key: "moving", href: "/moving", icon: Truck },
    { key: "notifications", href: "/notifications", icon: Bell },
    { key: "support", href: "/support", icon: LifeBuoy },
  ] as const;

  const bottomNav = [
    { key: "help", href: "/help", icon: HelpCircle },
    { key: "settings", href: "/settings", icon: Settings },
  ] as const;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 z-20 border-r border-border bg-foreground/[0.02] backdrop-blur-xl",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <LogoMark size={32} animated={false} className="shrink-0" />
          {!collapsed && (
            <span className="text-base font-semibold text-foreground">
              Locate<span className="italic foil-text">flow</span>
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
                  : "text-muted-foreground hover:text-foreground/80 hover:bg-foreground/5"
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
      <div className="border-t border-border py-3 px-2 space-y-0.5 shrink-0">
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
                  : "text-muted-foreground hover:text-foreground/80 hover:bg-foreground/5"
              )}
              title={collapsed ? label : undefined}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        <button
          className="w-full flex items-center justify-center py-2 rounded-xl text-foreground/30 hover:text-muted-foreground hover:bg-foreground/5 transition-all mt-1"
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
