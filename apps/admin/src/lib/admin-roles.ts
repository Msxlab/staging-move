// MFA enrollment is mandatory only for roles that hold write privilege over
// data the company cannot easily recover from. VIEWER and MODERATOR are
// read-mostly (MODERATOR can only update review moderation), so blocking
// them at the door until they enrol TOTP turned the panel into a wall for
// people whose worst case is "marked a review as approved." Server-side
// step-up still gates every destructive action for ALL roles; this only
// controls who must enrol before logging in at all.
const ADMIN_ROLES_REQUIRING_MFA = new Set(["SUPER_ADMIN", "ADMIN"]);

export function adminRoleRequiresMfa(role: string | null | undefined): boolean {
  return ADMIN_ROLES_REQUIRING_MFA.has(String(role || "").toUpperCase());
}
