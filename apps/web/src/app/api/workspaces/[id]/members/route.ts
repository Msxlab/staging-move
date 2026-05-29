import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { maskEmail, workspaceFeatureGate } from "@/lib/workspace-routes";

export const runtime = "nodejs";

/** GET /api/workspaces/[id]/members — emails are masked for non-managers. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const caller = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isManager = caller.role === "OWNER" || caller.role === "ADMIN";

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: id },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
      lastActiveAt: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  const out = members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    status: m.status,
    joinedAt: m.joinedAt,
    lastActiveAt: m.lastActiveAt,
    displayName: [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || null,
    email: isManager ? m.user.email : maskEmail(m.user.email),
  }));

  return NextResponse.json({ members: out }, { headers: { "Cache-Control": "no-store" } });
}
