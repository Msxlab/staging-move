/**
 * Security Monitor — Suspicious activity detection & alerting.
 *
 * Tracks patterns across login attempts, API usage, and admin operations
 * to detect anomalies like brute-force, credential stuffing, and privilege escalation.
 */

import { prisma } from "./db";
import { dispatchAlert } from "./alert-dispatcher";
import { maskIpAddress } from "./privacy";

// ── Types ──────────────────────────────────────────────────────

export type SecurityEventType =
  | "BRUTE_FORCE_DETECTED"
  | "CREDENTIAL_STUFFING"
  | "SESSION_HIJACK_ATTEMPT"
  | "UNUSUAL_HOUR_LOGIN"
  | "MULTI_IP_LOGIN"
  | "RAPID_SENSITIVE_OPS"
  | "BULK_DATA_ACCESS"
  | "FAILED_PASSWORD_CONFIRM"
  | "BLACKLISTED_IP_ATTEMPT";

interface SecurityEvent {
  type: SecurityEventType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  adminId?: string;
  ip: string;
  details: string;
  timestamp: number;
}

// ── In-memory tracking stores ──────────────────────────────────

interface LoginTracker {
  failedCount: number;
  failedIPs: Set<string>;
  lastFailedAt: number;
  successIPs: Set<string>;
  lastSuccessAt: number;
}

// Per-email login tracking
const loginTrackers = new Map<string, LoginTracker>();
// Per-IP failed login tracking (cross-account)
const ipFailedLogins = new Map<string, { count: number; emails: Set<string>; resetAt: number }>();
// Per-admin sensitive operation tracking
const sensitiveOps = new Map<string, { count: number; resetAt: number }>();

const TRACKER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const BRUTE_FORCE_THRESHOLD = 5; // 5 failed attempts in window
const CREDENTIAL_STUFFING_THRESHOLD = 3; // 3 different emails from same IP
const RAPID_OPS_THRESHOLD = 10; // 10 sensitive ops in 5 minutes
const RAPID_OPS_WINDOW_MS = 5 * 60 * 1000;

// Cleanup every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, t] of loginTrackers) {
    if (now - t.lastFailedAt > TRACKER_WINDOW_MS && now - t.lastSuccessAt > TRACKER_WINDOW_MS) {
      loginTrackers.delete(key);
    }
  }
  for (const [key, t] of ipFailedLogins) {
    if (t.resetAt < now) ipFailedLogins.delete(key);
  }
  for (const [key, t] of sensitiveOps) {
    if (t.resetAt < now) sensitiveOps.delete(key);
  }
}, 15 * 60 * 1000);

// ── Event Queue & Persistence ──────────────────────────────────

const eventQueue: SecurityEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cachedSystemAdminId: string | null = null;

async function resolveSystemAdminId(): Promise<string | null> {
  if (cachedSystemAdminId) return cachedSystemAdminId;

  try {
    const admin = await prisma.adminUser.findFirst({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    cachedSystemAdminId = admin?.id || null;
    return cachedSystemAdminId;
  } catch {
    return null;
  }
}

function uniqueValues(values: Iterable<string>) {
  return [...new Set([...values].filter(Boolean))];
}

function extractEmailDomains(details: string) {
  const matches = details.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/gi) || [];
  return uniqueValues(matches.map((email) => email.split("@")[1]?.toLowerCase() || ""));
}

function extractIpCount(details: string, eventIp: string) {
  const ipv4Matches = details.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
  const ipv6Matches = details.match(/\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7}\b/gi) || [];
  return uniqueValues([...ipv4Matches, ...ipv6Matches, eventIp]).length;
}

function extractFirstNumber(details: string) {
  const match = details.match(/\b(\d{1,6})\b/);
  return match ? Number(match[1]) : undefined;
}

function sanitizeSecurityEvent(event: SecurityEvent) {
  const emailDomains = extractEmailDomains(event.details);
  return {
    alertType: event.type,
    severity: event.severity,
    targetAdminId: event.adminId || null,
    maskedIp: maskIpAddress(event.ip),
    emailDomain: emailDomains.length === 1 ? emailDomains[0] : undefined,
    emailDomainCount: emailDomains.length,
    ipCount: extractIpCount(event.details, event.ip),
    count: extractFirstNumber(event.details),
    reasonCode: event.type.toLowerCase(),
    detailLength: event.details.length,
  };
}

function autoBanReasonCode(reason: string) {
  const lower = reason.toLowerCase();
  if (lower.includes("credential")) return "credential_stuffing";
  if (lower.includes("brute")) return "brute_force";
  return "automated_security_rule";
}

async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, 50);

  try {
    const systemAdminId = await resolveSystemAdminId();
    const persistedBatch = batch.flatMap((event) => {
      const adminUserId = event.adminId || systemAdminId;
      if (!adminUserId) return [];
      return [{
        adminUserId,
        action: "SECURITY_ALERT",
        entityType: event.type,
        entityId: event.severity,
        changes: JSON.stringify({ metadata: sanitizeSecurityEvent(event) }),
        ipAddress: maskIpAddress(event.ip),
      }];
    });
    if (persistedBatch.length === 0) return;
    await prisma.adminAuditLog.createMany({
      data: persistedBatch,
    });
  } catch (err) {
    console.error("[SECURITY-MONITOR] Failed to flush events:", err);
    // Re-queue failed events (max 200 to prevent memory leak)
    if (eventQueue.length < 200) {
      eventQueue.push(...batch);
    }
  }
}

function emitEvent(event: SecurityEvent): void {
  eventQueue.push(event);
  const safeMetadata = sanitizeSecurityEvent(event);
  console.warn(`[SECURITY-ALERT] ${event.severity} | ${event.type} | metadata=${JSON.stringify(safeMetadata)}`);

  // Debounce flush — persist after 2 seconds of quiet
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushEvents, 2000);

  // Immediate flush for CRITICAL
  if (event.severity === "CRITICAL") {
    if (flushTimer) clearTimeout(flushTimer);
    flushEvents();
  }

  // Dispatch real-time alert for HIGH/CRITICAL (non-blocking)
  if (event.severity === "HIGH" || event.severity === "CRITICAL") {
    dispatchAlert(
      event.type,
      event.severity,
      safeMetadata.maskedIp || "unknown",
      JSON.stringify(safeMetadata),
      event.adminId,
    ).catch(() => {});
  }
}

// ── Auto IP Ban ───────────────────────────────────────────────────

const AUTO_BAN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const recentBans = new Set<string>(); // Prevent duplicate bans in same process

async function autoBlacklistIP(ip: string, reason: string): Promise<void> {
  if (!ip || ip === "unknown" || recentBans.has(ip)) return;
  recentBans.add(ip);
  const safeReason = autoBanReasonCode(reason);

  try {
    await prisma.iPRule.upsert({
      where: { ipAddress_type: { ipAddress: ip, type: "BLACKLIST" } },
      create: {
        ipAddress: ip,
        type: "BLACKLIST",
        reason: `[AUTO] ${safeReason}`,
        isActive: true,
        createdBy: "SYSTEM",
        expiresAt: new Date(Date.now() + AUTO_BAN_DURATION_MS),
      },
      update: {
        reason: `[AUTO] ${safeReason}`,
        isActive: true,
        expiresAt: new Date(Date.now() + AUTO_BAN_DURATION_MS),
      },
    });
    console.warn(`[AUTO-BAN] ${maskIpAddress(ip) || "unknown"} blacklisted for 24h: ${safeReason}`);
  } catch (err) {
    console.error("[AUTO-BAN] Failed to blacklist IP:", err);
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Track a failed login attempt. Detects brute-force and credential stuffing.
 */
export function trackFailedLogin(email: string, ip: string): void {
  const now = Date.now();

  // Per-email tracking
  let tracker = loginTrackers.get(email);
  if (!tracker || now - tracker.lastFailedAt > TRACKER_WINDOW_MS) {
    tracker = { failedCount: 0, failedIPs: new Set(), successIPs: new Set(), lastFailedAt: 0, lastSuccessAt: 0 };
    loginTrackers.set(email, tracker);
  }
  tracker.failedCount++;
  tracker.failedIPs.add(ip);
  tracker.lastFailedAt = now;

  // Brute-force detection (many failed attempts for same email)
  if (tracker.failedCount >= BRUTE_FORCE_THRESHOLD) {
    const details = `${tracker.failedCount} failed login attempts for ${email} from ${tracker.failedIPs.size} IPs in ${TRACKER_WINDOW_MS / 60000}min`;
    emitEvent({
      type: "BRUTE_FORCE_DETECTED",
      severity: "HIGH",
      ip,
      details,
      timestamp: now,
    });
    // Auto-ban the attacking IP
    autoBlacklistIP(ip, `Brute-force: ${details}`);
  }

  // Per-IP cross-account tracking
  let ipTracker = ipFailedLogins.get(ip);
  if (!ipTracker || ipTracker.resetAt < now) {
    ipTracker = { count: 0, emails: new Set(), resetAt: now + TRACKER_WINDOW_MS };
    ipFailedLogins.set(ip, ipTracker);
  }
  ipTracker.count++;
  ipTracker.emails.add(email);

  // Credential stuffing detection (same IP trying multiple emails)
  if (ipTracker.emails.size >= CREDENTIAL_STUFFING_THRESHOLD) {
    const details = `IP ${ip} tried ${ipTracker.emails.size} different emails: ${[...ipTracker.emails].join(", ")}`;
    emitEvent({
      type: "CREDENTIAL_STUFFING",
      severity: "CRITICAL",
      ip,
      details,
      timestamp: now,
    });
    // Auto-ban immediately for credential stuffing
    autoBlacklistIP(ip, `Credential stuffing: ${details}`);
  }
}

/**
 * Track a successful login. Detects unusual patterns.
 */
export function trackSuccessfulLogin(email: string, ip: string, adminId: string): void {
  const now = Date.now();
  const hour = new Date().getUTCHours();

  // Unusual hour detection (1 AM - 5 AM UTC)
  if (hour >= 1 && hour <= 5) {
    emitEvent({
      type: "UNUSUAL_HOUR_LOGIN",
      severity: "LOW",
      adminId,
      ip,
      details: `Login at unusual hour (${hour}:00 UTC) for ${email}`,
      timestamp: now,
    });
  }

  // Multi-IP detection
  let tracker = loginTrackers.get(email);
  if (!tracker) {
    tracker = { failedCount: 0, failedIPs: new Set(), successIPs: new Set(), lastFailedAt: 0, lastSuccessAt: 0 };
    loginTrackers.set(email, tracker);
  }
  tracker.successIPs.add(ip);
  tracker.lastSuccessAt = now;

  if (tracker.successIPs.size > 2) {
    emitEvent({
      type: "MULTI_IP_LOGIN",
      severity: "MEDIUM",
      adminId,
      ip,
      details: `${email} logged in from ${tracker.successIPs.size} different IPs: ${[...tracker.successIPs].join(", ")}`,
      timestamp: now,
    });
  }
}

/**
 * Track session hijack attempts (fingerprint mismatch in middleware).
 */
export function trackSessionHijackAttempt(ip: string, adminId?: string): void {
  emitEvent({
    type: "SESSION_HIJACK_ATTEMPT",
    severity: "CRITICAL",
    adminId,
    ip,
    details: `Session fingerprint mismatch detected from IP ${ip}. Possible session hijacking.`,
    timestamp: Date.now(),
  });
}

/**
 * Track sensitive operations. Detects rapid-fire abuse.
 */
export function trackSensitiveOp(adminId: string, ip: string, operation: string): void {
  const now = Date.now();
  const key = `${adminId}`;
  let ops = sensitiveOps.get(key);
  if (!ops || ops.resetAt < now) {
    ops = { count: 0, resetAt: now + RAPID_OPS_WINDOW_MS };
    sensitiveOps.set(key, ops);
  }
  ops.count++;

  if (ops.count >= RAPID_OPS_THRESHOLD) {
    emitEvent({
      type: "RAPID_SENSITIVE_OPS",
      severity: "HIGH",
      adminId,
      ip,
      details: `Admin ${adminId} performed ${ops.count} sensitive operations in ${RAPID_OPS_WINDOW_MS / 60000}min. Latest: ${operation}`,
      timestamp: now,
    });
  }
}

/**
 * Track failed password confirmation attempts.
 */
export function trackFailedPasswordConfirm(adminId: string, ip: string): void {
  emitEvent({
    type: "FAILED_PASSWORD_CONFIRM",
    severity: "MEDIUM",
    adminId,
    ip,
    details: `Failed password re-confirmation for admin ${adminId}`,
    timestamp: Date.now(),
  });
}

/**
 * Track blocked IP access attempts.
 */
export function trackBlockedIPAttempt(ip: string, pathname: string): void {
  emitEvent({
    type: "BLACKLISTED_IP_ATTEMPT",
    severity: "MEDIUM",
    ip,
    details: `Blacklisted IP ${ip} attempted to access ${pathname}`,
    timestamp: Date.now(),
  });
}

/**
 * Get recent security events (for dashboard).
 */
export async function getRecentSecurityEvents(limit: number = 50): Promise<any[]> {
  try {
    return await prisma.adminAuditLog.findMany({
      where: { action: "SECURITY_ALERT" },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}
