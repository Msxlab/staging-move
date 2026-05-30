import { NextRequest, NextResponse } from "next/server";
import { can, getEffectiveEntitlement, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { rateLimit } from "@/lib/rate-limit";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import {
  countUsedSeats,
  generateInvitationToken,
  invitationExpiry,
  seatLimitForPlan,
} from "@/lib/workspace-invitations";
import { sendWorkspaceInvitationEmail } from "@/lib/email-service";

export const runtime = "nodejs";

const INVITABLE_ROLES = ["ADMIN", "MEMBER", "CHILD", "VIEW_ONLY"]; // never OWNER
const ROLE_LABELS: Record<string, string> = { ADMIN: "Admin", MEMBER: "Member", CHILD: "Child", VIEW_ONLY: "View only" };

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** GET /api/workspaces/[id]/invitations — pending invites (OWNER/ADMIN). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const caller = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(caller.role as WorkspaceRole, "member.invite", { status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitations = await prisma.workspaceInvitation.findMany({
    where: { workspaceId: id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, invitedEmail: true, role: true, status: true, expiresAt: true, tokenLast4: true, createdAt: true },
  });
  return NextResponse.json({ invitations }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/workspaces/[id]/invitations — invite a member. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await workspaceFeatureGate();
  if (off) return off;
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const caller = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: session.userId } });
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(caller.role as WorkspaceRole, "member.invite", { status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "Only owners and admins can invite." }, { status: 403 });
  }

  const rl = await rateLimit(`ws-invite:${id}`, { limit: 5, windowSeconds: 3600, failClosed: false });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many invitations. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const invitedEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "MEMBER";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 422 });
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 422 });
  }
  if (role === "ADMIN" && !can(caller.role as WorkspaceRole, "member.promoteAdmin", { status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "Only the owner can invite an Admin." }, { status: 403 });
  }

  // Seat ceiling from the owner's plan.
  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { ownerUserId: true, name: true } });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ownerSub = await prisma.subscription.findUnique({ where: { userId: workspace.ownerUserId } });
  const plan = String(getEffectiveEntitlement(ownerSub).effectivePlan);
  if (seatLimitForPlan(plan) <= 1) {
    return NextResponse.json({ error: "Upgrade to Family or Pro to invite members." }, { status: 403 });
  }
  if ((await countUsedSeats(id)) >= seatLimitForPlan(plan)) {
    return NextResponse.json({ error: "Workspace is at its seat limit." }, { status: 409 });
  }

  // Already a member?
  const existingUser = await prisma.user.findUnique({ where: { email: invitedEmail }, select: { id: true, preferredLocale: true } });
  if (existingUser) {
    const alreadyMember = await prisma.workspaceMember.findFirst({ where: { workspaceId: id, userId: existingUser.id } });
    if (alreadyMember) return NextResponse.json({ error: "Already a member." }, { status: 409 });
  }
  // Existing pending invite?
  const pending = await prisma.workspaceInvitation.findFirst({ where: { workspaceId: id, invitedEmail, status: "PENDING" } });
  if (pending) return NextResponse.json({ error: "An invitation is already pending for this email." }, { status: 409 });

  const { token, tokenHash, tokenLast4 } = generateInvitationToken();
  const expiresAt = invitationExpiry();
  const invitation = await prisma.workspaceInvitation.create({
    data: { workspaceId: id, invitedEmail, role, invitedByUserId: session.userId, tokenHash, tokenLast4, status: "PENDING", expiresAt },
    select: { id: true, invitedEmail: true, role: true, expiresAt: true, tokenLast4: true },
  });

  // Send the invitation email (doc 66). Transactional + inert when the feature
  // is off (this route 404s before reaching here). In dev with no email provider
  // configured, the send logs as failed and we still surface the link below.
  const inviteUrl = `${appBaseUrl()}/invitations/${token}`;
  const inviter = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true, preferredLocale: true },
  });
  const inviterName = [inviter?.firstName, inviter?.lastName].filter(Boolean).join(" ") || null;
  const emailSent = await sendWorkspaceInvitationEmail({
    invitedEmail,
    workspaceName: workspace.name,
    inviterName,
    roleLabel: ROLE_LABELS[role] ?? role,
    acceptUrl: inviteUrl,
    // Prefer the RECIPIENT's own language when they already have an account;
    // fall back to the inviter's locale as a household signal for brand-new
    // invitees (whose language we can't know yet).
    locale: existingUser?.preferredLocale ?? inviter?.preferredLocale,
    dedupeKey: `ws-invite:${invitation.id}`,
    metadata: { workspaceId: id },
  }).catch(() => false);

  return NextResponse.json({
    ...invitation,
    emailSent,
    ...(process.env.NODE_ENV !== "production" && !emailSent ? { devInviteUrl: inviteUrl } : {}),
  });
}
