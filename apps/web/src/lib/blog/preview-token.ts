import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * Short-lived signed token for blog draft previews.
 *
 * The admin "Preview" button generates one of these and links to
 * `/blog/preview/<token>`. The public route accepts the token, decodes
 * it, looks up the post (DRAFT or SCHEDULED), and renders it. No
 * cookies, no admin session leaking onto the public origin — just a
 * scoped, expiring signature bound to a single postId.
 *
 * Why JWT (vs DB-backed token row):
 *   - Stateless — preview links survive admin restarts.
 *   - Self-expiring via `exp` — no cleanup cron needed.
 *   - One signing secret already exists (`ADMIN_JWT_SECRET`) and rotates
 *     centrally.
 */

const PREVIEW_TOKEN_TTL_SECONDS = 60 * 10; // 10 minutes
const PREVIEW_TOKEN_AUDIENCE = "blog-preview";
const PREVIEW_TOKEN_ISSUER = "locateflow-admin";

interface PreviewClaims {
  postId: string;
  /** AdminUser.id — useful for audit logs of who shared which preview */
  adminId: string;
}

function getSecret(): Uint8Array {
  const raw = process.env.ADMIN_JWT_SECRET;
  if (!raw) throw new Error("ADMIN_JWT_SECRET is not set");
  return new TextEncoder().encode(raw);
}

export async function signPreviewToken(claims: PreviewClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(PREVIEW_TOKEN_ISSUER)
    .setAudience(PREVIEW_TOKEN_AUDIENCE)
    .setExpirationTime(`${PREVIEW_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

export interface VerifiedPreview {
  postId: string;
  adminId: string;
}

export async function verifyPreviewToken(token: string): Promise<VerifiedPreview | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      audience: PREVIEW_TOKEN_AUDIENCE,
      issuer: PREVIEW_TOKEN_ISSUER,
    });
    if (typeof payload.postId !== "string" || typeof payload.adminId !== "string") {
      return null;
    }
    return { postId: payload.postId, adminId: payload.adminId };
  } catch {
    // Expired, tampered, or wrong audience — treat all the same.
    return null;
  }
}
