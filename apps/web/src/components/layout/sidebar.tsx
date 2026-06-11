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
  Users,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/marketing/logo";

interface SidebarProps {
  showBudget?: boolean;
  showWorkspace?: boolean;
  variant?: "desktop" | "mobile";
  open?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
}

export function Sidebar({
  showBudget = true,
  showWorkspace = false,
  variant = "desktop",
  open = false,
  onClose,
  onNavigate,
}: SidebarProps = {}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations("nav");
  const isMobile = variant === "mobile";
  const isCollapsed = isMobile ? false : collapsed;

  // Unread badge on the Notifications item. One-shot fetch of the same feed
  // endpoint the header bell uses (limit=1 keeps the payload tiny — we only
  // read `unreadCount`). No polling; errors degrade to "no badge".
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/notifications/feed?limit=1", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && typeof data.unreadCount === "number") {
          setUnreadCount(data.unreadCount);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Keys map to `nav.*` in messages/en.json and messages/es.json. Do
  // NOT hardcode user-visible strings here — every label must be a
  // translation key so adding a third locale (pt, fr…) is a messages
  // change, not a sidebar change.
  const workspaceNav = [
    { key: "dashboard", href: "/dashboard", icon: Home },
    { key: "addresses", href: "/addresses", icon: MapPin },
    { key: "services", href: "/services", icon: Zap },
    { key: "providers", href: "/providers", icon: Building2 },
    ...(showBudget
      ? [{ key: "budget" as const, href: "/budget", icon: DollarSign }]
      : []),
    { key: "moving", href: "/moving", icon: Truck },
    ...(showWorkspace
      ? [{ key: "workspace" as const, href: "/settings/workspace", icon: Users }]
      : []),
  ] as const;

  const accountNav = [
    { key: "notifications", href: "/notifications", icon: Bell },
    { key: "support", href: "/support", icon: LifeBuoy },
    { key: "help", href: "/help", icon: HelpCircle },
    { key: "settings", href: "/settings", icon: Settings },
  ] as const;

  type NavItem =
    | (typeof workspaceNav)[number]
    | (typeof accountNav)[number];

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname.startsWith(item.href);
    const label = t(item.key);
    const showUnread = item.key === "notifications" && unreadCount > 0;
    return (
      <Link
        key={item.key}
        href={item.href}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all",
          isActive
            ? "bg-tone-orange-bg text-tone-orange-fg"
            : "text-muted-foreground hover:text-foreground/80 hover:bg-foreground/5"
        )}
        title={isCollapsed ? label : undefined}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
      >
        <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-tone-orange-fg")} />
        {!isCollapsed && <span>{label}</span>}
        {showUnread ? (
          <>
            {isCollapsed ? (
              <span
                className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-tone-orange-fg"
                aria-hidden="true"
              />
            ) : (
              <span
                className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-tone-orange-fg px-1 font-mono text-[9px] font-bold text-white"
                aria-hidden="true"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="sr-only">{t("unreadCount", { count: unreadCount })}</span>
          </>
        ) : null}
      </Link>
    );
  };

  // Mono-uppercase group kicker (Aurora editorial pattern). When collapsed
  // the label has no room, so groups after the first separate with a rule.
  const groupKicker = (label: string, dividerWhenCollapsed: boolean) =>
    isCollapsed ? (
      dividerWhenCollapsed ? (
        <div className="mx-3 my-2 border-t border-border" aria-hidden="true" />
      ) : null
    ) : (
      <div className="px-3 pt-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/40">
        {label}
      </div>
    );

  return (
    <aside
      className={cn(
        "flex-col border-r border-border backdrop-blur-xl transition-all duration-300",
        isMobile
          ? "fixed inset-y-0 left-0 z-[60] flex w-72 shadow-2xl md:hidden"
          : "hidden md:flex h-screen sticky top-0 z-20 bg-foreground/[0.02]",
        isMobile && (open ? "translate-x-0" : "pointer-events-none -translate-x-full"),
        !isMobile && (isCollapsed ? "w-[68px]" : "w-60")
      )}
      style={isMobile ? { background: "color-mix(in srgb, var(--surface-secondary) 96%, var(--surface))" } : undefined}
      aria-hidden={isMobile ? !open : undefined}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <LogoMark size={32} animated={false} className="shrink-0" />
          {!isCollapsed && (
            <span className="text-base font-semibold text-foreground">
              Locate<span className="italic foil-text">flow</span>
            </span>
          )}
        </Link>
        {isMobile ? (
          <button
            type="button"
            className="ml-auto rounded-xl p-2 text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
            onClick={onClose}
            aria-label={t("closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {groupKicker(t("groupWorkspace"), false)}
        <div className="space-y-0.5">{workspaceNav.map(renderNavItem)}</div>
        {groupKicker(t("groupAccount"), true)}
        <div className="space-y-0.5">{accountNav.map(renderNavItem)}</div>
      </nav>

      {/* Bottom: Pro upsell + collapse toggle */}
      <div className="border-t border-border py-3 px-2 shrink-0">
        {/* Foil = premium-only moment. Hidden for Pro members via the
            .plan-pro accent class AppShell sets on the shell wrapper —
            plan styling always flows through .plan-*, never via props. */}
        {isCollapsed ? (
          <Link
            href="/pricing"
            onClick={onNavigate}
            title={t("proUpsellTitle")}
            className="flex h-10 w-full items-center justify-center rounded-xl border border-tone-foil-br bg-tone-foil-bg text-tone-foil-fg transition hover:opacity-90 [.plan-pro_&]:hidden"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t("proUpsellTitle")}</span>
          </Link>
        ) : (
          <Link
            href="/pricing"
            onClick={onNavigate}
            className="block rounded-2xl border border-tone-foil-br bg-tone-foil-bg p-3 transition hover:opacity-90 [.plan-pro_&]:hidden"
          >
            <span className="flex items-center gap-1.5 text-xs font-bold text-tone-foil-fg">
              <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("proUpsellTitle")}
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
              {t("proUpsellBody")}
            </span>
          </Link>
        )}

        {!isMobile ? (
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
        ) : null}
      </div>
    </aside>
  );
}
