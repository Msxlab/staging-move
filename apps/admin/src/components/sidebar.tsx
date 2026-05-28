"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import type { AdminPermissionsMap, AdminRoleString } from "@/lib/page-guard";
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
  Ticket,
  FileText,
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
  /**
   * Predicate that decides whether the link should appear in the
   * sidebar for the current admin. Receives the server-resolved role
   * and permission map from page-guard. Hiding is purely UX — page-
   * guard + API gates remain authoritative.
   */
  show?: (ctx: { role: AdminRoleString; permissions: AdminPermissionsMap }) => boolean;
}

interface NavGroup {
  label: string;
  labelKey: string; // key in messages.nav.*
  items: NavItem[];
}

function meetsRole(actual: AdminRoleString, required: AdminRoleString): boolean {
  const order: Record<AdminRoleString, number> = {
    VIEWER: 0,
    MODERATOR: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };
  return order[actual] >= order[required];
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
      { name: "Users", nameKey: "users", href: "/users", icon: Users, show: ({ permissions }) => permissions.users.canRead },
      { name: "Subscriptions", nameKey: "subscriptions", href: "/subscriptions", icon: CreditCard, show: ({ permissions }) => permissions.subscriptions.canRead },
      { name: "Acquisition Campaigns", nameKey: "acquisitionCampaigns", href: "/acquisition-campaigns", icon: Ticket, show: ({ permissions }) => permissions.acquisition_campaigns.canRead },
      { name: "Billing", nameKey: "billing", href: "/billing", icon: DollarSign, show: ({ permissions }) => permissions.subscriptions.canRead },
    ],
  },
  {
    label: "Content",
    labelKey: "content",
    items: [
      { name: "Providers", nameKey: "providers", href: "/providers", icon: Building2, show: ({ permissions }) => permissions.providers.canRead },
      { name: "Provider Governance", nameKey: "providerGovernance", href: "/provider-governance", icon: Shield, show: ({ permissions }) => permissions.providers.canRead },
      { name: "State Rules", nameKey: "stateRules", href: "/state-rules", icon: MapPin, show: ({ permissions }) => permissions.state_rules.canRead },
      { name: "Moving Plans", nameKey: "movingPlans", href: "/moving", icon: Truck, show: ({ permissions }) => permissions.moving_plans.canRead },
    ],
  },
  {
    label: "Communication",
    labelKey: "communication",
    items: [
      { name: "Support", nameKey: "support", href: "/support", icon: LifeBuoy, show: ({ permissions }) => permissions.tickets.canRead },
      { name: "Notifications", nameKey: "notifications", href: "/notifications", icon: Bell, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Email Templates", nameKey: "emailTemplates", href: "/email-templates", icon: Mail, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Help Center", nameKey: "helpCenter", href: "/help-center", icon: HelpCircle },
      { name: "Blog", nameKey: "blog", href: "/blog", icon: FileText, show: ({ permissions }) => permissions.blog.canRead },
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
      // Privileged System links only render when the corresponding
      // server-side gate would let the admin in. Hiding is UX only —
      // direct URL access still hits page-guard / API guards.
      { name: "Feature Flags", nameKey: "featureFlags", href: "/feature-flags", icon: Flag, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Security", nameKey: "security", href: "/security", icon: Lock, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Runtime Config", nameKey: "runtimeConfig", href: "/runtime-config", icon: Lock, show: ({ role }) => role === "SUPER_ADMIN" },
      { name: "Backups", nameKey: "backups", href: "/backups", icon: Database, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Audit Logs", nameKey: "auditLogs", href: "/logs", icon: ScrollText, show: ({ permissions }) => permissions.audit_logs.canRead },
      { name: "Admin Team", nameKey: "adminTeam", href: "/team", icon: Shield, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Settings", nameKey: "settings", href: "/settings", icon: Settings },
    ],
  },
];

function filterNavGroups(
  ctx: { role: AdminRoleString; permissions: AdminPermissionsMap } | null,
): NavGroup[] {
  if (!ctx) return navGroups;
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.show || item.show(ctx)),
    }))
    .filter((group) => group.items.length > 0);
}

function getInitialCollapsed(pathname: string, groups: NavGroup[]): Record<string, boolean> {
  const collapsed: Record<string, boolean> = {};
  groups.forEach((group) => {
    const hasActive = group.items.some(
      (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    );
    collapsed[group.label] = !hasActive;
  });
  // Core always open
  collapsed["Core"] = false;
  return collapsed;
}

interface SidebarProps {
  /**
   * Server-resolved permission context. When omitted (e.g. during the
   * brief client mount before context is wired) the sidebar shows all
   * links, since this is purely a display affordance — page-guard and
   * API guards are authoritative.
   */
  ctx?: { role: AdminRoleString; permissions: AdminPermissionsMap };
}

export function Sidebar({ ctx }: SidebarProps = {}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const filteredGroups = filterNavGroups(ctx ?? null);
  const allItems = filteredGroups.flatMap((g) => g.items);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => getInitialCollapsed(pathname, filteredGroups));
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  // Auto-expand group when navigating
  useEffect(() => {
    filteredGroups.forEach((group) => {
      const hasActive = group.items.some(
        (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
      );
      if (hasActive) {
        setCollapsed((prev) => ({ ...prev, [group.label]: false }));
      }
    });
  }, [pathname, filteredGroups]);

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "locateflow" },
      body: "{}",
      cache: "no-store",
    });
    toast.success(tCommon("signOut"));
    window.location.assign("/login");
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
      {/* Logo — mirrors public/logo-mark.svg from the design system.
          Animations driven by .sb-sweep / .sb-ripple / .sb-pin-float in
          globals.css. All respect prefers-reduced-motion. */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <svg className="h-10 w-10 shrink-0 drop-shadow-[0_0_12px_rgba(127,182,232,0.22)]" viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="admin-mk-foil" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#5C9DDC" />
              <stop offset="45%" stopColor="#7FB6E8" />
              <stop offset="100%" stopColor="#DDE7F5" />
            </linearGradient>
            <linearGradient id="admin-mk-rose" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#A5C9F0" />
              <stop offset="100%" stopColor="#5C9DDC" />
            </linearGradient>
          </defs>
          <path
            className="sb-sweep"
            d="M20 65 Q 30 32, 50 48 T 80 40"
            stroke="url(#admin-mk-foil)"
            strokeWidth="3.25"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="20" cy="65" r="4.5" fill="url(#admin-mk-foil)" />
          <circle cx="20" cy="65" r="1.5" fill="#0A0F18" />
          {/* Ripple ring under the cool pin */}
          <circle
            className="sb-ripple"
            cx="80"
            cy="40"
            r="7.25"
            fill="none"
            stroke="url(#admin-mk-rose)"
            strokeWidth="1.25"
            opacity="0.6"
            style={{ transformOrigin: "80px 40px", transformBox: "fill-box" }}
          />
          <g className="sb-pin-float" style={{ transformOrigin: "80px 40px", transformBox: "fill-box" }}>
            <circle cx="80" cy="40" r="7.25" fill="url(#admin-mk-rose)" />
            <circle cx="80" cy="40" r="2.5" fill="#ECF1F8" />
          </g>
        </svg>
        <div className="flex flex-col leading-none">
          <span
            className="text-[1.1rem] tracking-[-0.025em] text-foreground"
            style={{ fontFamily: "var(--font-display), Didot, Georgia, serif", fontWeight: 400 }}
          >
            Locate<span className="foil-text">flow</span>
          </span>
          <span className="mt-1 text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/70">
            Admin
          </span>
        </div>
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
                  <a
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
                  </a>
                );
              })
            ) : (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">{tCommon("no")}</p>
            )}
          </div>
        ) : (
          // Grouped navigation
          <div className="space-y-1">
            {filteredGroups.map((group) => {
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
                          <a
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
                          </a>
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
