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
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Core",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Users", href: "/users", icon: Users },
      { name: "Subscriptions", href: "/subscriptions", icon: CreditCard },
      { name: "Billing", href: "/billing", icon: DollarSign },
    ],
  },
  {
    label: "Content",
    items: [
      { name: "Providers", href: "/providers", icon: Building2 },
      { name: "State Rules", href: "/state-rules", icon: MapPin },
      { name: "Moving Plans", href: "/moving", icon: Truck },
    ],
  },
  {
    label: "Communication",
    items: [
      { name: "Notifications", href: "/notifications", icon: Bell },
      { name: "Email Templates", href: "/email-templates", icon: Mail },
      { name: "Help Center", href: "/help-center", icon: HelpCircle },
    ],
  },
  {
    label: "Analytics",
    items: [
      { name: "Analytics", href: "/analytics", icon: BarChart3 },
      { name: "Reports", href: "/reports", icon: PieChart },
    ],
  },
  {
    label: "System",
    items: [
      { name: "Feature Flags", href: "/feature-flags", icon: Flag },
      { name: "Security", href: "/security", icon: Lock },
      { name: "Runtime Config", href: "/runtime-config", icon: Lock },
      { name: "Backups", href: "/backups", icon: Database },
      { name: "Audit Logs", href: "/logs", icon: ScrollText },
      { name: "Admin Team", href: "/team", icon: Shield },
      { name: "Settings", href: "/settings", icon: Settings },
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
    toast.success("Logged out");
    router.push("/login");
    router.refresh();
  }

  const isSearching = search.trim().length > 0;
  const filteredItems = isSearching
    ? allItems.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <span className="text-lg font-bold text-foreground">LocateFlow</span>
        <span className="ml-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Admin</span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search menu..."
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
                    {item.name}
                  </Link>
                );
              })
            ) : (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No results</p>
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
                    {group.label}
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
                            {item.name}
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

      {/* Theme toggle + Logout */}
      <div className="border-t border-border p-3 space-y-1">
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
