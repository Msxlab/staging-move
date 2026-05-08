const ADMIN_ROLES_REQUIRING_MFA = new Set(["SUPER_ADMIN", "ADMIN", "MODERATOR", "VIEWER"]);

export function adminRoleRequiresMfa(role: string | null | undefined): boolean {
  return ADMIN_ROLES_REQUIRING_MFA.has(String(role || "").toUpperCase());
}
