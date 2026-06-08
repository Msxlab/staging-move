"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AdminPermissionsMap, AdminRoleString } from "@/lib/page-guard";

type Ctx = { role: AdminRoleString; permissions: AdminPermissionsMap };

function meetsRole(actual: AdminRoleString, required: AdminRoleString): boolean {
  const order: Record<AdminRoleString, number> = {
    VIEWER: 0,
    MODERATOR: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };
  return order[actual] >= order[required];
}

interface SubNavTab {
  /** key in messages.nav.* */
  nameKey: string;
  href: string;
  /** Same gating contract as the sidebar — hiding is UX only. */
  show?: (ctx: Ctx) => boolean;
}

/**
 * Section tab clusters. The sidebar now lists only each cluster's parent
 * route; these tabs surface the sub-workflows that used to be separate
 * top-level sidebar items (doc: admin IA simplification, 27→~19 items).
 * Gating mirrors the sidebar's show() predicates so a tab never appears for
 * an admin who can't open it — page-guard / API guards remain authoritative.
 */
const CLUSTERS: SubNavTab[][] = [
  [
    { nameKey: "subscriptions", href: "/subscriptions", show: ({ permissions }) => permissions.subscriptions.canRead },
    { nameKey: "billing", href: "/billing", show: ({ permissions }) => permissions.subscriptions.canRead },
  ],
  [
    { nameKey: "providers", href: "/providers", show: ({ permissions }) => permissions.providers.canRead },
    { nameKey: "coverage", href: "/providers/coverage", show: ({ permissions }) => permissions.providers.canRead },
    { nameKey: "governance", href: "/provider-governance", show: ({ permissions }) => permissions.providers.canRead },
    { nameKey: "needsLogo", href: "/providers/needs-logo", show: ({ permissions }) => permissions.providers.canRead },
  ],
  [
    { nameKey: "analyticsPage", href: "/analytics" },
    { nameKey: "reports", href: "/reports" },
    { nameKey: "intelligence", href: "/analytics/intelligence" },
  ],
  [
    { nameKey: "notifications", href: "/notifications", show: ({ role }) => meetsRole(role, "ADMIN") },
    { nameKey: "emailTemplates", href: "/email-templates", show: ({ role }) => meetsRole(role, "ADMIN") },
  ],
  [
    { nameKey: "security", href: "/security", show: ({ role }) => meetsRole(role, "ADMIN") },
    { nameKey: "sessions", href: "/security/dashboard", show: ({ role }) => meetsRole(role, "ADMIN") },
  ],
  [
    { nameKey: "auditLogs", href: "/logs", show: ({ permissions }) => permissions.audit_logs.canRead },
    { nameKey: "activity", href: "/logs/activity", show: ({ permissions }) => permissions.audit_logs.canRead },
  ],
  [
    { nameKey: "settings", href: "/settings" },
    { nameKey: "health", href: "/settings/health" },
    { nameKey: "twoFactor", href: "/settings/two-factor" },
    { nameKey: "backups", href: "/backups", show: ({ role }) => meetsRole(role, "ADMIN") },
    { nameKey: "runtimeConfig", href: "/runtime-config", show: ({ role }) => role === "SUPER_ADMIN" },
  ],
];

/** A tab owns a path when the path is the tab href or nested under it. */
function ownsPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Section-level tab bar rendered in the admin shell. Resolves the active
 * cluster from the pathname (longest-matching tab wins, so
 * /providers/needs-logo lands on its own tab rather than "Providers"), then
 * renders that cluster's role-visible tabs. Renders nothing outside a
 * cluster or when only one tab is visible.
 */
export function SubNav({ ctx }: { ctx: Ctx }) {
  const pathname = usePathname();
  const tNav = useTranslations("nav");

  // Pick the tab with the longest href that owns the current path; its
  // cluster is the active section.
  let activeCluster: SubNavTab[] | null = null;
  let activeTab: SubNavTab | null = null;
  let bestLen = 0;
  for (const cluster of CLUSTERS) {
    for (const tab of cluster) {
      if (ownsPath(pathname, tab.href) && tab.href.length > bestLen) {
        bestLen = tab.href.length;
        activeCluster = cluster;
        activeTab = tab;
      }
    }
  }

  if (!activeCluster) return null;
  const visible = activeCluster.filter((tab) => !tab.show || tab.show(ctx));
  if (visible.length < 2) return null;

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 border-b border-border">
      {visible.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <a
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {tNav(tab.nameKey)}
          </a>
        );
      })}
    </nav>
  );
}
