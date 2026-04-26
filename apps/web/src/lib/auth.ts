/**
 * Public re-exports so existing API routes that did
 *   import { requireDbUserId } from "@/lib/auth"
 * keep working after the Clerk → custom JWT migration.
 */

export {
  requireDbUserId,
  getUserSession,
  createUserSession,
  destroyUserSession,
  destroyAllUserSessions,
  generateFingerprint,
  validateFingerprint,
  verifyPassword,
  hashPassword,
  validatePasswordPolicy,
  findOrLinkOAuthUser,
  findOrLinkOAuthUserWithStatus,
} from "@/lib/user-auth";
