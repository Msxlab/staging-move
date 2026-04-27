import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { createAuditLog, extractRequestMeta } from "@/lib/audit";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createAccountDeletionRequest, getActiveAccountDeletionRequest, processAccountDeletionRequest } from "@/lib/account-deletion";
import { sendSecurityNoticeEmail } from "@/lib/email-service";

// POST /api/account/delete — GDPR right to erasure
export async function POST(request: NextRequest) {
  try {
    const userId = await requireDbUserId();

    // Rate limit: 3 per minute (destructive action)
    const rlKey = getRateLimitKey(request, "account:delete");
    const rl = await rateLimit(rlKey, { limit: 3, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingRequest = await getActiveAccountDeletionRequest(userId);
    const deleteRequest = existingRequest || await (async () => {
      const subscription = await prisma.subscription.findUnique({ where: { userId } });

      const meta = extractRequestMeta(request);
      await createAuditLog({
        userId,
        action: "ACCOUNT_DELETE",
        entityType: "User",
        entityId: userId,
        changes: { email: user.email },
        ...meta,
      });

      return createAccountDeletionRequest({
        userId,
        source: "self_service",
        email: user.email,
        stripeSubscriptionId: subscription?.stripeSubscriptionId || null,
      });
    })();

    // Email the user only on initial request — re-clicks of "delete my
    // account" while a request is pending shouldn't spam.
    if (!existingRequest) {
      const isEs = (user.preferredLocale || "").toLowerCase().startsWith("es");
      void sendSecurityNoticeEmail({
        userEmail: user.email,
        userName: user.firstName || "there",
        kind: "account-deletion-requested",
        detail: isEs ? "Tus datos se eliminarán pronto." : "Your data will be removed shortly.",
        occurredAt: new Date(),
        locale: user.preferredLocale,
        dedupeKey: `account-deletion:${deleteRequest.id}`,
      }).catch((err) => console.error("[ACCOUNT] deletion-confirm email failed:", err));
    }

    const processed = await processAccountDeletionRequest(deleteRequest.id);
    const completed = processed.status === "COMPLETED";

    return NextResponse.json(
      {
        success: true,
        status: processed.status,
        requestId: deleteRequest.id,
        message: completed
          ? "Account deletion completed."
          : "Account deletion initiated. Remaining cleanup will continue automatically.",
      },
      { status: completed ? 200 : 202 }
    );
  } catch (error: any) {
    if (error?.message === "ACCOUNT_DELETED") {
      return NextResponse.json(
        {
          success: true,
          status: "PROCESSING",
          message: "Account deletion is already in progress.",
        },
        { status: 202 }
      );
    }
    console.error("Failed to delete account:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
