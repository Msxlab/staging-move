import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";

function parseUA(ua: string) {
  const result = { browser: "Unknown", os: "Unknown", deviceType: "Desktop" };
  if (!ua) return result;

  // Browser
  if (ua.includes("Chrome") && !ua.includes("Edg")) result.browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) result.browser = "Safari";
  else if (ua.includes("Firefox")) result.browser = "Firefox";
  else if (ua.includes("Edg")) result.browser = "Edge";
  else if (ua.includes("Opera") || ua.includes("OPR")) result.browser = "Opera";

  // OS
  if (ua.includes("Windows")) result.os = "Windows";
  else if (ua.includes("Mac OS")) result.os = "macOS";
  else if (ua.includes("Android")) result.os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) result.os = "iOS";
  else if (ua.includes("Linux")) result.os = "Linux";
  else if (ua.includes("CrOS")) result.os = "ChromeOS";

  // Device
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) result.deviceType = "Mobile";
  else if (ua.includes("iPad") || ua.includes("Tablet")) result.deviceType = "Tablet";

  return result;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission("users", "canRead", { minimumRole: "ADMIN" });

    // Get sessions with parsed UA data
    const sessions = await prisma.userSession.findMany({
      select: {
        id: true, browser: true, os: true, deviceType: true, platform: true,
        country: true, region: true, city: true, language: true,
        sessionStart: true, pageViews: true, isActive: true, userAgent: true,
      },
      orderBy: { sessionStart: "desc" },
      take: 5000,
    });

    // Also parse AuditLog userAgents for historical data
    const auditLogs = await prisma.auditLog.findMany({
      select: { userAgent: true, ipAddress: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    // Combine session data + parsed audit log data
    const browserMap: Record<string, number> = {};
    const osMap: Record<string, number> = {};
    const deviceMap: Record<string, number> = {};
    const platformMap: Record<string, number> = {};
    const regionMap: Record<string, number> = {};

    // From sessions
    sessions.forEach((s: any) => {
      const b = s.browser || "Unknown";
      const o = s.os || "Unknown";
      const d = s.deviceType || "Desktop";
      const p = s.platform || "WEB";
      browserMap[b] = (browserMap[b] || 0) + 1;
      osMap[o] = (osMap[o] || 0) + 1;
      deviceMap[d] = (deviceMap[d] || 0) + 1;
      platformMap[p] = (platformMap[p] || 0) + 1;
      if (s.region) regionMap[s.region] = (regionMap[s.region] || 0) + 1;
    });

    // From audit logs (fallback when no sessions exist)
    if (sessions.length === 0) {
      auditLogs.forEach((log: any) => {
        if (log.userAgent) {
          const parsed = parseUA(log.userAgent);
          browserMap[parsed.browser] = (browserMap[parsed.browser] || 0) + 1;
          osMap[parsed.os] = (osMap[parsed.os] || 0) + 1;
          deviceMap[parsed.deviceType] = (deviceMap[parsed.deviceType] || 0) + 1;
          platformMap["WEB"] = (platformMap["WEB"] || 0) + 1;
        }
      });
    }

    // Active users
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, todayActive, weekActive, monthActive] = await Promise.all([
      prisma.user.count(),
      prisma.userSession.count({ where: { sessionStart: { gte: today } } }),
      prisma.userSession.count({ where: { sessionStart: { gte: weekAgo } } }),
      prisma.userSession.count({ where: { sessionStart: { gte: monthAgo } } }),
    ]);

    // Daily registrations (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyRegistrations: Record<string, number> = {};
    recentUsers.forEach((u: any) => {
      const day = u.createdAt.toISOString().split("T")[0];
      dailyRegistrations[day] = (dailyRegistrations[day] || 0) + 1;
    });

    // Popular pages from events
    const pageEvents = await prisma.userEvent.groupBy({
      by: ["page"],
      where: { event: "PAGE_VIEW", page: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    // Recent sessions — SEC-005: data minimization, no PII in bulk response.
    // Admins can click through to /users/:userId to see full details (separate authz + audit log).
    const recentSessions = await prisma.userSession.findMany({
      select: {
        id: true, userId: true,
        browser: true, os: true, deviceType: true, platform: true,
        country: true, city: true, region: true,
        sessionStart: true, pageViews: true, isActive: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { sessionStart: "desc" },
      take: 20,
    });

    const maskInitials = (firstName?: string | null, lastName?: string | null) => {
      const f = (firstName || "").trim().charAt(0).toUpperCase();
      const l = (lastName || "").trim().charAt(0).toUpperCase();
      return (f + l) || "?";
    };

    return NextResponse.json({
      activeUsers: { total: totalUsers, today: todayActive, week: weekActive, month: monthActive },
      browsers: Object.entries(browserMap).sort((a, b) => b[1] - a[1]),
      operatingSystems: Object.entries(osMap).sort((a, b) => b[1] - a[1]),
      devices: Object.entries(deviceMap).sort((a, b) => b[1] - a[1]),
      platforms: Object.entries(platformMap).sort((a, b) => b[1] - a[1]),
      regions: Object.entries(regionMap).sort((a, b) => b[1] - a[1]).slice(0, 20),
      dailyRegistrations,
      popularPages: pageEvents.map((p: any) => ({ page: p.page, views: p._count.id })),
      recentSessions: recentSessions.map((s: any) => ({
        id: s.id,
        userId: s.userId,
        initials: maskInitials(s.user?.firstName, s.user?.lastName),
        browser: s.browser,
        os: s.os,
        deviceType: s.deviceType,
        platform: s.platform,
        country: s.country,
        city: s.city,
        region: s.region,
        sessionStart: s.sessionStart,
        pageViews: s.pageViews,
        isActive: s.isActive,
      })),
      totalSessions: sessions.length,
      totalEvents: await prisma.userEvent.count(),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
