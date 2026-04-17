import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { trackFailedPasswordConfirm, trackSensitiveOp } from "./security-monitor";

const adminJwtSecret = process.env.ADMIN_JWT_SECRET;
if (!adminJwtSecret || adminJwtSecret.length < 32) {
  throw new Error("ADMIN_JWT_SECRET must be set and at least 32 characters");
}

const JWT_SECRET = new TextEncoder().encode(adminJwtSecret);

const COOKIE_NAME = "admin_session";

function clearSessionCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  try {
    cookieStore.delete(COOKIE_NAME);
  } catch {
  }
}

export interface AdminSession {
  adminId: string;
  email: string;
  role: string;
  fingerprint?: string;
  sessionId?: string;
}

/**
 * Generate a SHA-256 fingerprint from IP + User-Agent.
 * Binds the session to the client's network/browser identity.
 */
export async function generateFingerprint(ip: string, userAgent: string): Promise<string> {
  const raw = `${ip}|${userAgent}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(
  adminId: string,
  email: string,
  role: string,
  fingerprint?: string
): Promise<string> {
  const claims: Record<string, unknown> = { adminId, email, role };
  if (fingerprint) claims.fp = fingerprint;

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .setIssuedAt()
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });

  return token;
}

export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = await hashSessionToken(token).catch(() => null);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (!tokenHash) {
      clearSessionCookie(cookieStore);
      return null;
    }

    const sessionRecord = await prisma.adminSession.findFirst({
      where: {
        tokenHash,
        isActive: true,
      },
      select: {
        id: true,
        adminUserId: true,
        expiresAt: true,
      },
    }).catch(() => null);

    if (!sessionRecord) {
      clearSessionCookie(cookieStore);
      return null;
    }

    if (sessionRecord.adminUserId !== payload.adminId || new Date(sessionRecord.expiresAt).getTime() <= Date.now()) {
      await prisma.adminSession.updateMany({
        where: { tokenHash, isActive: true },
        data: { isActive: false },
      }).catch(() => null);
      clearSessionCookie(cookieStore);
      return null;
    }

    return {
      adminId: payload.adminId as string,
      email: payload.email as string,
      role: payload.role as string,
      fingerprint: (payload.fp as string) || undefined,
      sessionId: sessionRecord.id,
    };
  } catch {
    if (tokenHash) {
      await prisma.adminSession.updateMany({
        where: { tokenHash, isActive: true },
        data: { isActive: false },
      }).catch(() => null);
    }
    clearSessionCookie(cookieStore);
    return null;
  }
}

/**
 * Validate that the current request fingerprint matches the session fingerprint.
 * Returns false if the session was created with a fingerprint and it doesn't match.
 */
export async function validateFingerprint(
  session: AdminSession,
  ip: string,
  userAgent: string
): Promise<boolean> {
  if (!session.fingerprint) return true; // Legacy sessions without fingerprint
  const currentFp = await generateFingerprint(ip, userAgent);
  return currentFp === session.fingerprint;
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
  });

  if (!admin || !admin.isActive) {
    if (session.sessionId) {
      await prisma.adminSession.updateMany({
        where: { id: session.sessionId, isActive: true },
        data: { isActive: false },
      }).catch(() => null);
    }
    await destroySession();
    throw new Error("UNAUTHORIZED");
  }

  if (session.sessionId) {
    await prisma.adminSession.updateMany({
      where: { id: session.sessionId, isActive: true },
      data: { lastActivity: new Date() },
    }).catch(() => null);
  }

  return session;
}

export async function requireRole(requiredRole: string): Promise<AdminSession> {
  const session = await requireAdmin();

  // Re-read role from DB to prevent stale JWT role claims (SEC-005)
  const freshAdmin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { role: true, isActive: true },
  });
  if (!freshAdmin || !freshAdmin.isActive) {
    throw new Error("UNAUTHORIZED");
  }
  const currentRole = freshAdmin.role;

  const roleHierarchy: Record<string, number> = {
    VIEWER: 0,
    MODERATOR: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };

  const userLevel = roleHierarchy[currentRole] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole] ?? 0;

  if (userLevel < requiredLevel) {
    throw new Error("FORBIDDEN");
  }

  return { ...session, role: currentRole };
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = await hashSessionToken(token).catch(() => null);
    if (tokenHash) {
      await prisma.adminSession.updateMany({
        where: { tokenHash, isActive: true },
        data: {
          isActive: false,
          lastActivity: new Date(),
        },
      }).catch(() => null);
    }
  }
  clearSessionCookie(cookieStore);
}

/**
 * Step-up authentication for sensitive operations.
 * Requires the admin to re-enter their password.
 * Uses a 15-minute grace window — if confirmed within the last 15 minutes, skips re-check.
 */
const recentConfirms = new Map<string, number>(); // adminId → timestamp
const CONFIRM_GRACE_MS = 15 * 60 * 1000; // 15 minutes

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentConfirms) {
    if (now - ts > CONFIRM_GRACE_MS) recentConfirms.delete(key);
  }
}, 10 * 60 * 1000);

export async function requirePasswordConfirm(
  session: AdminSession,
  password: string | undefined
): Promise<{ confirmed: boolean; error?: string }> {
  // Check grace window
  const lastConfirm = recentConfirms.get(session.adminId);
  if (lastConfirm && Date.now() - lastConfirm < CONFIRM_GRACE_MS) {
    return { confirmed: true };
  }

  if (!password) {
    return { confirmed: false, error: "Password confirmation required for this operation." };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.adminId },
    select: { password: true, isActive: true },
  });

  if (!admin || !admin.isActive) {
    return { confirmed: false, error: "Admin account not found or inactive." };
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    trackFailedPasswordConfirm(session.adminId, "unknown");
    return { confirmed: false, error: "Incorrect password." };
  }

  // Set grace window
  recentConfirms.set(session.adminId, Date.now());
  trackSensitiveOp(session.adminId, "unknown", "password_confirm");
  return { confirmed: true };
}

export async function requirePermission(
  resource: string,
  action: "canRead" | "canCreate" | "canUpdate" | "canDelete",
  options: { minimumRole?: string; fallbackResources?: string[] } = {}
): Promise<AdminSession> {
  const session = await requireRole(options.minimumRole || "VIEWER");
  const resources = [resource, ...(options.fallbackResources || [])];

  for (const currentResource of resources) {
    if (await checkPermission(session.adminId, currentResource, action)) {
      return session;
    }
  }

  throw new Error("FORBIDDEN");
}

function getLegacyRolePermission(role: string, resource: string) {
  if (role === "SUPER_ADMIN") {
    return { canRead: true, canCreate: true, canUpdate: true, canDelete: true };
  }

  if (role === "ADMIN") {
    return {
      canRead: true,
      canCreate: resource !== "admin_users",
      canUpdate: resource !== "admin_users",
      canDelete: resource !== "admin_users",
    };
  }

  if (role === "MODERATOR") {
    return {
      canRead: true,
      canCreate: resource === "reviews",
      canUpdate: resource === "reviews",
      canDelete: false,
    };
  }

  if (role === "VIEWER") {
    return { canRead: true, canCreate: false, canUpdate: false, canDelete: false };
  }

  return null;
}

export async function checkPermission(
  adminId: string,
  resource: string,
  action: "canRead" | "canCreate" | "canUpdate" | "canDelete"
): Promise<boolean> {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    include: { permissions: true },
  });

  if (!admin || !admin.isActive) return false;

  // SUPER_ADMIN has all permissions
  if (admin.role === "SUPER_ADMIN") return true;

  // Check specific permission
  const permission = admin.permissions.find((p: any) => p.resource === resource);
  if (permission) {
    return permission[action];
  }

  if (admin.permissions.length === 0) {
    const legacyPermission = getLegacyRolePermission(admin.role, resource);
    return legacyPermission ? legacyPermission[action] : false;
  }

  return false;
}
