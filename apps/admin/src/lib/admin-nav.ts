/**
 * Shared admin navigation model.
 *
 * Single source of truth for the sidebar AND the ⌘K command palette so the two
 * never drift. `name` (English) drives search matching regardless of locale;
 * `nameKey` drives the visible label via useTranslations("nav.*"). Visibility
 * (`show`) is UX-only — page-guard + API gates remain authoritative.
 */

import {
  LayoutDashboard,
  Users,
  Home,
  CreditCard,
  Building2,
  MapPin,
  Truck,
  ScrollText,
  Shield,
  Settings,
  BarChart3,
  Bell,
  Cog,
  HelpCircle,
  Flag,
  Plug,
  Link2,
  Layers,
  Lock,
  LifeBuoy,
  Sparkles,
  Ticket,
  FileText,
  PlusCircle,
} from "lucide-react";
import type { AdminPermissionsMap, AdminRoleString } from "@/lib/page-guard";

export interface NavItem {
  name: string;
  nameKey: string;
  href: string;
  icon: React.ElementType;
  show?: (ctx: { role: AdminRoleString; permissions: AdminPermissionsMap }) => boolean;
}

export interface NavGroup {
  label: string;
  labelKey: string;
  /**
   * Group glyph for the desktop rail navigation — the slim icon column
   * renders ONE entry per group, so each group needs its own icon.
   */
  icon: React.ElementType;
  /**
   * Short English caption under the rail icon (≤7 chars so it fits the
   * 76px rail). Admin chrome copy is English-only; the full translated
   * group label still appears as the tooltip + contextual panel title.
   */
  railLabel: string;
  items: NavItem[];
}

export function meetsRole(actual: AdminRoleString, required: AdminRoleString): boolean {
  const order: Record<AdminRoleString, number> = {
    VIEWER: 0,
    MODERATOR: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };
  return order[actual] >= order[required];
}

export const navGroups: NavGroup[] = [
  {
    label: "Core",
    labelKey: "core",
    icon: LayoutDashboard,
    railLabel: "Core",
    items: [
      { name: "Dashboard", nameKey: "dashboard", href: "/", icon: LayoutDashboard },
      { name: "Users", nameKey: "users", href: "/users", icon: Users, show: ({ permissions }) => permissions.users.canRead },
      { name: "Subscriptions", nameKey: "subscriptions", href: "/subscriptions", icon: CreditCard, show: ({ permissions }) => permissions.subscriptions.canRead },
      { name: "Plans", nameKey: "plans", href: "/plans", icon: Layers, show: ({ permissions }) => permissions.subscriptions.canRead },
      { name: "Workspaces", nameKey: "workspaces", href: "/workspaces", icon: Home, show: ({ permissions }) => permissions.users.canRead },
      { name: "Acquisition Campaigns", nameKey: "acquisitionCampaigns", href: "/acquisition-campaigns", icon: Ticket, show: ({ permissions }) => permissions.acquisition_campaigns.canRead },
      { name: "Analytics", nameKey: "analyticsPage", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Content",
    labelKey: "content",
    icon: Building2,
    railLabel: "Content",
    items: [
      { name: "Providers", nameKey: "providers", href: "/providers", icon: Building2, show: ({ permissions }) => permissions.providers.canRead },
      { name: "Affiliate", nameKey: "affiliate", href: "/affiliate", icon: Link2, show: ({ permissions }) => permissions.providers.canRead },
      { name: "State Rules", nameKey: "stateRules", href: "/state-rules", icon: MapPin, show: ({ permissions }) => permissions.state_rules.canRead },
      { name: "Moving Plans", nameKey: "movingPlans", href: "/moving", icon: Truck, show: ({ permissions }) => permissions.moving_plans.canRead },
    ],
  },
  {
    label: "Communication",
    labelKey: "communication",
    icon: Bell,
    railLabel: "Comms",
    items: [
      { name: "Support", nameKey: "support", href: "/support", icon: LifeBuoy, show: ({ permissions }) => permissions.tickets.canRead },
      { name: "Notifications", nameKey: "notifications", href: "/notifications", icon: Bell, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Help Center", nameKey: "helpCenter", href: "/help-center", icon: HelpCircle },
      { name: "Blog", nameKey: "blog", href: "/blog", icon: FileText, show: ({ permissions }) => permissions.blog.canRead },
      { name: "Waitlist", nameKey: "waitlist", href: "/waitlist", icon: Sparkles },
    ],
  },
  {
    label: "System",
    labelKey: "system",
    icon: Cog,
    railLabel: "System",
    items: [
      { name: "Feature Flags", nameKey: "featureFlags", href: "/feature-flags", icon: Flag, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Connectors", nameKey: "connectors", href: "/connectors", icon: Plug, show: ({ permissions }) => permissions.connectors.canRead },
      { name: "Connector Metrics", nameKey: "connectorMetrics", href: "/connector-metrics", icon: BarChart3, show: ({ permissions }) => permissions.connectors.canRead },
      { name: "Connector Fallbacks", nameKey: "connectorFallbacks", href: "/connector-fallbacks", icon: Link2, show: ({ permissions }) => permissions.connectors.canRead },
      { name: "Security", nameKey: "security", href: "/security", icon: Lock, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Audit Logs", nameKey: "auditLogs", href: "/logs", icon: ScrollText, show: ({ permissions }) => permissions.audit_logs.canRead },
      { name: "Admin Team", nameKey: "adminTeam", href: "/team", icon: Shield, show: ({ role }) => meetsRole(role, "ADMIN") },
      { name: "Settings", nameKey: "settings", href: "/settings", icon: Settings },
    ],
  },
];

export function filterNavGroups(
  ctx: { role: AdminRoleString; permissions: AdminPermissionsMap } | null,
): NavGroup[] {
  if (!ctx) return navGroups;
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.show || item.show(ctx)) }))
    .filter((group) => group.items.length > 0);
}

export interface QuickAction {
  name: string;
  nameKey: string;
  href: string;
  icon: React.ElementType;
  show?: (ctx: { role: AdminRoleString; permissions: AdminPermissionsMap }) => boolean;
}

/** "Create" shortcuts surfaced in the command palette (not the sidebar). */
export const quickActions: QuickAction[] = [
  { name: "New provider", nameKey: "newProvider", href: "/providers/new", icon: PlusCircle, show: ({ permissions }) => permissions.providers.canCreate },
  { name: "New blog post", nameKey: "newBlogPost", href: "/blog/new", icon: PlusCircle, show: ({ permissions }) => permissions.blog.canCreate },
];

export function filterQuickActions(
  ctx: { role: AdminRoleString; permissions: AdminPermissionsMap } | null,
): QuickAction[] {
  if (!ctx) return [];
  return quickActions.filter((a) => !a.show || a.show(ctx));
}
