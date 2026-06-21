import { NextRequest, NextResponse } from "next/server";
import { can, type WorkspaceMemberStatus, type WorkspaceRole } from "@locateflow/shared";
import { Prisma } from "@locateflow/db";
import { prisma } from "@/lib/db";
import { resolveConsumerEntitlement } from "@/lib/consumer-entitlement";
import { getUserSession } from "@/lib/user-auth";
import { rateLimit } from "@/lib/rate-limit";
import { workspaceFeatureGate } from "@/lib/workspace-routes";
import {
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

  const caller = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: session.userId, workspace: { deletedAt: null } },
  });
  if (!caller) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!can(caller.role as WorkspaceRole, "member.invite", { status: caller.status as WorkspaceMemberStatus })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only surface invitations that can still be accepted. An expired PENDING
  // invite no longer consumes a seat (see countUsedSeats) and shouldn't appear
  // as actionable in the roster UI either — keep both views consistent.
  const invitations = await prisma.workspaceInvitation.findMany({
    where: { workspaceId: id, status: "PENDING", expiresAt: { gte: new Date() } },
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

  const caller = await prisma.workspaceMember.findFirst({
    where: { workspaceId: id, userId: session.userId, workspace: { deletedAt: null } },
  });
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

  // COPPA: inviting a CHILD knowingly onboards a minor, so when the age gate is
  // on the inviter must affirm guardian consent (simplified parental consent,
  // doc 22). Inert when COPPA_AGE_GATE_ENABLED is off — pairs with the register
  // age gate so both flip together at launch (behind legal sign-off).
  const ageGateOn = ["true", "1"].includes((process.env.COPPA_AGE_GATE_ENABLED || "").toLowerCase());
  if (ageGateOn && role === "CHILD" && body?.guardianConsent !== true) {
    return NextResponse.json(
      {
        error: "Confirm you are this child's parent or guardian and consent to LocateFlow processing their information.",
        code: "GUARDIAN_CONSENT_REQUIRED",
      },
      { status: 400 },
    );
  }

  // Seat ceiling from the owner's plan.
  const workspace = await prisma.workspace.findFirst({ where: { id, deletedAt: null }, select: { ownerUserId: true, name: true } });
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ownerSub = await prisma.subscription.findUnique({ where: { userId: workspace.ownerUserId } });
  // Consumer seat gate → consumer-free override (audit P1-2): under CONSUMER_FREE
  // a free owner resolves to PRO and may invite, instead of being dead-ended at 1.
  const plan = String((await resolveConsumerEntitlement(ownerSub)).entitlement.effectivePlan);
  if (seatLimitForPlan(plan) <= 1) {
    return NextResponse.json({ error: "Upgrade to Family or Pro to invite members." }, { status: 403 });
  }
  const { token, tokenHash, tokenLast4 } = generateInvitationToken();
  const expiresAt = invitationExpiry();
  let invitation;
  let inviteeLocale: string | null | undefined;
  try {
    invitation = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: invitedEmail }, select: { id: true, preferredLocale: true } });
      inviteeLocale = existingUser?.preferredLocale ?? null;
      if (existingUser) {
        const alreadyMember = await tx.workspaceMember.findFirst({ where: { workspaceId: id, userId: existingUser.id } });
        if (alreadyMember) throw new Error("ALREADY_MEMBER");
      }

      // Block a duplicate while a prior invite is still LIVE — i.e. PENDING and
      // not yet expired. Mirrors countUsedSeats / the pending-list filter, which
      // also treat an expired PENDING invite as no longer outstanding. This keeps
      // a legitimate re-invite possible once the prior invite expired (or was
      // REVOKED — that status already falls outside this filter), instead of
      // permanently wedging the email behind a stale invitation.
      const pending = await tx.workspaceInvitation.findFirst({
        where: { workspaceId: id, invitedEmail, status: "PENDING", expiresAt: { gte: new Date() } },
      });
      if (pending) throw new Error("PENDING_INVITE");

      const [memberCount, pendingCount] = await Promise.all([
        tx.workspaceMember.count({ where: { workspaceId: id, status: { not: "SUSPENDED" } } }),
        tx.workspaceInvitation.count({ where: { workspaceId: id, status: "PENDING", expiresAt: { gte: new Date() } } }),
      ]);
      if (memberCount + pendingCount >= seatLimitForPlan(plan)) throw new Error("SEAT_FULL");

      return tx.workspaceInvitation.create({
        data: { workspaceId: id, invitedEmail, role, invitedByUserId: session.userId, tokenHash, tokenLast4, status: "PENDING", expiresAt },
        select: { id: true, invitedEmail: true, role: true, expiresAt: true, tokenLast4: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_MEMBER") {
      return NextResponse.json({ error: "Already a member." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "PENDING_INVITE") {
      return NextResponse.json({ error: "An invitation is already pending for this email." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "SEAT_FULL") {
      return NextResponse.json({ error: "Workspace is at its seat limit." }, { status: 409 });
    }
    if ((error as { code?: string })?.code === "P2034") {
      return NextResponse.json({ error: "Please try again." }, { status: 409 });
    }
    // The unique index can collide on a near-simultaneous re-invite — translate
    // it to a clean 409 instead of an unhandled 500.
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "An invitation for this email was just created. Try again in a moment." }, { status: 409 });
    }
    throw error;
  }

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
    locale: inviteeLocale ?? inviter?.preferredLocale,
    dedupeKey: `ws-invite:${invitation.id}`,
    metadata: { workspaceId: id },
  }).catch(() => false);

  return NextResponse.json({
    ...invitation,
    emailSent,
    ...(process.env.NODE_ENV !== "production" && !emailSent ? { devInviteUrl: inviteUrl } : {}),
  });
}
