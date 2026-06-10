"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, HelpCircle, Search } from "lucide-react";
import type { AdminPermissionsMap, AdminRoleString } from "@/lib/page-guard";
import { meetsRole } from "@/lib/admin-nav";
import { deriveBreadcrumb, initialsFromEmail } from "./topbar-breadcrumb";

/**
 * Corporate admin topbar (F3-C) — sticky chrome strip above the content
 * area on every admin page. Ported from the design system's `.adp-top`
 * (admin-pro.jsx): breadcrumb · global search trigger · bell / help /
 * identity cluster. Styles live in aurora.css under `.adp-topbar` and are
 * driven entirely by the `--au-*` token system (slate light / aurora dark).
 */

interface TopbarProps {
  /**
   * Server-resolved permission context. Display-only — page-guard and API
   * gates remain authoritative. Used to gate the notifications bell
   * (ADMIN+, mirroring the nav model) and to render the identity disc.
   */
  ctx?: { role: AdminRoleString; permissions: AdminPermissionsMap; email?: string };
}

/**
 * Open the existing global CommandPalette by replaying its own keyboard
 * shortcut on `window`. The palette is the single search surface in the
 * admin — the topbar deliberately does NOT mount a second input or result
 * list, so search behavior/permissions stay defined in one place.
 */
function openCommandPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
}

export function Topbar({ ctx }: TopbarProps = {}) {
  const pathname = usePathname();
  const crumb = deriveBreadcrumb(pathname || "/");

  // Platform-correct shortcut hint (⌘K on Apple, Ctrl K elsewhere). Same
  // SSR-safe pattern as the sidebar: default to the non-Apple form, correct
  // on mount, and suppress the hydration warning on the <kbd>.
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(
      typeof navigator !== "undefined" &&
        /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    );
  }, []);

  // Bell mirrors the nav model's gate for /notifications (ADMIN+). The
  // page-guard on the route remains the real enforcement.
  const showBell = ctx ? meetsRole(ctx.role, "ADMIN") : false;
  const email = ctx?.email ?? "";
  const initials = initialsFromEmail(email);

  return (
    <header className="adp-topbar">
      {/* Breadcrumb — Admin › {Section} › {Page}, labels from admin-nav. */}
      <nav aria-label="Breadcrumb" className="adp-crumb">
        <span>Admin</span>
        {crumb.section && (
          <>
            <ChevronRight aria-hidden="true" />
            <span>{crumb.section}</span>
          </>
        )}
        <ChevronRight aria-hidden="true" />
        <b aria-current="page">{crumb.page}</b>
      </nav>

      <span className="sp" aria-hidden="true" />

      {/* Global search trigger — opens the ⌘K CommandPalette. Rendered as a
          button (not an input) so the palette's close-time focus restore
          can't re-trigger an onFocus open loop. */}
      <button
        type="button"
        className="adp-tsearch"
        onClick={openCommandPalette}
        aria-label="Search users, providers, moves (opens command palette)"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search aria-hidden="true" />
        <span className="ph">Search users, providers, moves…</span>
        <kbd className="kbd" suppressHydrationWarning>
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Right cluster: notifications, help, identity. No unread badge —
          there is no count available at layout level without a new
          endpoint, and the bell must not invent one. */}
      {showBell && (
        <a href="/notifications" className="adp-iconbtn" title="Notifications" aria-label="Notifications">
          <Bell aria-hidden="true" />
        </a>
      )}
      <a href="/help-center" className="adp-iconbtn" title="Help Center" aria-label="Help Center">
        <HelpCircle aria-hidden="true" />
      </a>
      <div className="adp-avatar" title={email || undefined}>
        <span aria-hidden="true">{initials}</span>
        {email && <span className="sr-only">Signed in as {email}</span>}
      </div>
    </header>
  );
}
