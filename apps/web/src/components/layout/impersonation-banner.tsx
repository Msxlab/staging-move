"use client";

import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Renders a persistent banner whenever the active session was created by
 * SUPER_ADMIN impersonation. Backed by /api/auth/me, which surfaces
 * UserLoginSession.impersonatedByAdminId via getUserSession().
 *
 * The banner is intentionally not dismissible — it must stay visible for
 * the entire 15-minute impersonation window so the admin and any observer
 * can tell the request originated from an admin acting as a user.
 */
export function ImpersonationBanner() {
  const { user } = useCurrentUser();
  if (!user?.impersonatedByAdminId) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="impersonation-banner"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white"
      style={{ background: "var(--warning, #B0781E)" }}
    >
      <span aria-hidden="true">⚠</span>
      <span>
        Admin impersonation active — you are viewing this account as
        administrator <strong>{user.impersonatedByAdminId}</strong>. All
        actions are audited.
      </span>
    </div>
  );
}
