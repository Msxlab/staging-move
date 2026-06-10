/**
 * Pure helpers for the admin topbar (F3-C).
 *
 * Split out of topbar.tsx so the breadcrumb/identity logic can be
 * unit-tested in the node vitest environment without pulling in React
 * rendering or next/navigation.
 *
 * Breadcrumb labels come from the shared admin-nav model (English `name`
 * + group `label`) so the topbar can never drift from the sidebar/⌘K
 * palette. Visibility (`show`) is intentionally ignored here: if an
 * operator is ON a page, the server page-guard already admitted them, so
 * the crumb should always name where they are.
 */

import { navGroups } from "@/lib/admin-nav";

export interface Breadcrumb {
  /** Nav group label ("Core", "Content", …) or null for unmapped routes. */
  section: string | null;
  /** Page label ("Users", "Audit Logs", …). */
  page: string;
}

/**
 * Derive `Admin › {Section} › {Page}` parts from a pathname.
 *
 * Longest-href match wins so nested routes (`/users/123`) resolve to their
 * parent module. Routes that exist outside the nav model (e.g. sub-workflow
 * pages surfaced by SubNav) fall back to a title-cased first segment with
 * no section, rendering as `Admin › Billing`.
 */
export function deriveBreadcrumb(pathname: string): Breadcrumb {
  const path = normalizePath(pathname);

  let best: { section: string; page: string; hrefLength: number } | null = null;
  for (const group of navGroups) {
    for (const item of group.items) {
      const matches =
        item.href === "/"
          ? path === "/"
          : path === item.href || path.startsWith(`${item.href}/`);
      if (matches && (!best || item.href.length > best.hrefLength)) {
        best = { section: group.label, page: item.name, hrefLength: item.href.length };
      }
    }
  }
  if (best) return { section: best.section, page: best.page };

  const firstSegment = path.split("/").filter(Boolean)[0] ?? "";
  if (!firstSegment) return { section: "Core", page: "Dashboard" };
  return { section: null, page: titleCaseSegment(firstSegment) };
}

/** Strip query/hash and trailing slashes; empty input maps to "/". */
function normalizePath(pathname: string): string {
  const bare = (pathname || "/").split(/[?#]/)[0] || "/";
  if (bare.length > 1 && bare.endsWith("/")) {
    return bare.replace(/\/+$/, "") || "/";
  }
  return bare;
}

/** "email-templates" → "Email Templates". */
function titleCaseSegment(segment: string): string {
  return segment
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Initials disc text for the signed-in admin. Uses the email local part:
 * "jane.doe@…" → "JD", "mustafa@…" → "MU". Falls back to "AD" (Admin)
 * when no email is available.
 */
export function initialsFromEmail(email?: string | null): string {
  const localPart = (email ?? "").trim().split("@")[0] ?? "";
  const tokens = localPart.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const [first = "", second = ""] = tokens;
  if (first && second) return (first.charAt(0) + second.charAt(0)).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return "AD";
}
