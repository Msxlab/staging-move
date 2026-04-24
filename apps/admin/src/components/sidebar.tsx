"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Building2,
  MapPin,
  Truck,
  ScrollText,
  Shield,
  Settings,
  LogOut,
  BarChart3,
  Bell,
  DollarSign,
  PieChart,
  Mail,
  HelpCircle,
  Flag,
  Lock,
  ChevronDown,
  Search,
  Database,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSelector } from "./language-selector";

interface NavItem {
  name: string;
  nameKey: string; // key in messages.nav.*
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  labelKey: string; // key in messages.nav.*
  items: NavItem[];
}

// `name` (English) is the source of truth for search filtering — users
// can type "Subscriptions" regardless of the active locale. `nameKey`
// drives the visible label via useTranslations("nav.*"). To add a new
// route: append here + add EN/ES string under messages/{locale}.json.
const navGroups: NavGroup[] = [
  {
    label: "Core",
    labelKey: "core",
    items: [
      { name: "Dashboard", nameKey: "dashboard", href: "/", icon: LayoutDashboard },
      { name: "Users", nameKey: "users", href: "/users", icon: Users },
      { name: "Subscriptions", nameKey: "subscriptions", href: "/subscriptions", icon: CreditCard },
      { name: "Billing", nameKey: "billing", href: "/billing", icon: DollarSign },
    ],
  },
  {
    label: "Content",
    labelKey: "content",
    items: [
      { name: "Providers", nameKey: "providers", href: "/providers", icon: Building2 },
      { name: "Provider Governance", nameKey: "providerGovernance", href: "/provider-governance", icon: Shield },
      { name: "State Rules", nameKey: "stateRules", href: "/state-rules", icon: MapPin },
      { name: "Moving Plans", nameKey: "movingPlans", href: "/moving", icon: Truck },
    ],
  },
  {
    label: "Communication",
    labelKey: "communication",
    items: [
      { name: "Tickets", nameKey: "tickets", href: "/support", icon: LifeBuoy },
      { name: "Notifications", nameKey: "notifications", href: "/notifications", icon: Bell },
      { name: "Email Templates", nameKey: "emailTemplates", href: "/email-templates", icon: Mail },
      { name: "Help Center", nameKey: "helpCenter", href: "/help-center", icon: HelpCircle },
      { name: "Waitlist", nameKey: "waitlist", href: "/waitlist", icon: Sparkles },
    ],
  },
  {
    label: "Analytics",
    labelKey: "analytics",
    items: [
      { name: "Analytics", nameKey: "analyticsPage", href: "/analytics", icon: BarChart3 },
      { name: "Reports", nameKey: "reports", href: "/reports", icon: PieChart },
    ],
  },
  {
    label: "System",
    labelKey: "system",
    items: [
      { name: "Feature Flags", nameKey: "featureFlags", href: "/feature-flags", icon: Flag },
      { name: "Security", nameKey: "security", href: "/security", icon: Lock },
      { name: "Runtime Config", nameKey: "runtimeConfig", href: "/runtime-config", icon: Lock },
      { name: "Backups", nameKey: "backups", href: "/backups", icon: Database },
      { name: "Audit Logs", nameKey: "auditLogs", href: "/logs", icon: ScrollText },
      { name: "Admin Team", nameKey: "users", href: "/team", icon: Shield },
      { name: "Settings", nameKey: "settings", href: "/settings", icon: Settings },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

function getInitialCollapsed(pathname: string): Record<string, boolean> {
  const collapsed: Record<string, boolean> = {};
  navGroups.forEach((group) => {
    const hasActive = group.items.some(
      (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    );
    collapsed[group.label] = !hasActive;
  });
  // Core always open
  collapsed["Core"] = false;
  return collapsed;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => getInitialCollapsed(pathname));
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  // Auto-expand group when navigating
  useEffect(() => {
    navGroups.forEach((group) => {
      const hasActive = group.items.some(
        (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
      );
      if (hasActive) {
        setCollapsed((prev) => ({ ...prev, [group.label]: false }));
      }
    });
  }, [pathname]);

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success(tCommon("signOut"));
    router.push("/login");
    router.refresh();
  }

  const isSearching = search.trim().length > 0;
  // Match against BOTH the English name AND the translated label so a
  // Spanish-speaking operator can type "provider" OR "proveedor" and
  // still find the Providers route.
  const matchesSearch = (item: NavItem, q: string) => {
    const lower = q.toLowerCase();
    if (item.name.toLowerCase().includes(lower)) return true;
    try {
      return tNav(item.nameKey).toLowerCase().includes(lower);
    } catch {
      return false;
    }
  };
  const filteredItems = isSearching
    ? allItems.filter((item) => matchesSearch(item, search))
    : null;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card">
      {/* Logo — mirrors public/logo-mark.svg from the design system */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-6">
        <svg className="h-8 w-8 shrink-0" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="admin-mk-foil" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#B8936C" />
              <stop offset="45%" stopColor="#E5C9A8" />
              <stop offset="100%" stopColor="#F4E4D0" />
            </linearGradient>
            <linearGradient id="admin-mk-rose" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#EDB99D" />
              <stop offset="100%" stopColor="#A85A42" />
            </linearGradient>
          </defs>
          <path
            d="M20 65 Q 30 32, 50 48 T 80 40"
            stroke="url(#admin-mk-foil)"
            strokeWidth="3.25"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="20" cy="65" r="4.5" fill="url(#admin-mk-foil)" />
          <circle cx="20" cy="65" r="1.5" fill="#0E0A07" />
          <circle cx="80" cy="40" r="7.25" fill="url(#admin-mk-rose)" />
          <circle cx="80" cy="40" r="2.5" fill="#F5F1EA" />
        </svg>
        <span
          className="text-lg leading-none tracking-[-0.02em] text-foreground"
          style={{ fontFamily: "var(--fraunces), Didot, Georgia, serif", fontWeight: 400 }}
        >
          Locate<span className="italic">flow</span>
        </span>
        <span className="ml-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Admin</span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={tCommon("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {isSearching ? (
          // Flat filtered list
          <div className="space-y-0.5">
            {filteredItems && filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSearch("")}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {tNav(item.nameKey)}
                  </Link>
                );
              })
            ) : (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">{tCommon("no")}</p>
            )}
          </div>
        ) : (
          // Grouped navigation
          <div className="space-y-1">
            {navGroups.map((group) => {
              const isCollapsed = collapsed[group.label];
              const hasActive = group.items.some(
                (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
              );
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                      hasActive
                        ? "text-primary/70"
                        : "text-muted-foreground/60 hover:text-muted-foreground"
                    )}
                  >
                    {tNav(group.labelKey)}
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-0.5 mt-0.5 mb-2">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            {tNav(item.nameKey)}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Theme + language + logout */}
      <div className="border-t border-border p-3 space-y-1">
        <ThemeToggle />
        <LanguageSelector />
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {tCommon("signOut")}
        </button>
      </div>
    </aside>
  );
}
