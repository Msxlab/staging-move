import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { getAdminStripeClient } from "@/lib/admin-stripe";
import { maskProviderIdentifier } from "@/lib/privacy";

/**
 * Admin lifecycle action: REFUND the latest paid invoice for a Stripe
 * subscription via refunds.create on that invoice's payment_intent.
 *
 *  - GET  → read-only PREVIEW of the refundable amount + currency + masked
 *           user so the UI confirm dialog can state EXACTLY what will be
 *           refunded and to whom BEFORE the operator steps up. Money moves
 *           only on POST.
 *  - POST → performs the refund behind the full step-up (password + MFA) and
 *           writes START/COMPLETE/FAIL audit rows including the amount.
 *
 * Keyed by Subscription.id.
 */

const refundSchema = z
  .object({
    // Caller echoes back the previewed amount (minor units) so the server can
    // refuse if the latest invoice changed between preview and confirm — the
    // operator never refunds a different amount than the dialog showed.
    expectedAmount: z.number().int().nonnegative().optional(),
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

interface LatestPaidInvoice {
  invoiceId: string;
  paymentIntentId: string;
  amount: number; // minor units (e.g. cents) already paid
  currency: string;
}

/**
 * Resolve the latest PAID invoice for the subscription and the payment_intent
 * that funded it. Returns null when there is nothing refundable.
 */
async function findLatestRefundable(
  stripe: Stripe,
  stripeSubscriptionId: string,
): Promise<LatestPaidInvoice | null> {
  const invoices = await stripe.invoices.list({
    subscription: stripeSubscriptionId,
    status: "paid",
    limit: 1,
  });
  const invoice = invoices.data[0];
  if (!invoice || !invoice.id) return null;

  const amountPaid = invoice.amount_paid ?? 0;
  if (amountPaid <= 0) return null;

  // payment_intent may be an id string or an expanded object depending on
  // expansion; we requested neither so it is an id string here.
  const paymentIntentId =
    typeof invoice.payment_intent === "string"
      ? invoice.payment_intent
      : invoice.payment_intent?.id || null;
  if (!paymentIntentId) return null;

  return {
    invoiceId: invoice.id,
    paymentIntentId,
    amount: amountPaid,
    currency: invoice.currency || "usd",
  };
}

async function loadSubscriptionForRefund(subscriptionId: string) {
  return prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      userId: true,
      provider: true,
      plan: true,
      status: true,
      stripeSubscriptionId: true,
      user: { select: { id: true, email: true } },
    },
  });
}

function refundAuditBase(subscription: any) {
  return {
    rowId: subscription?.id || null,
    userId: subscription?.userId || null,
    plan: subscription?.plan || null,
    status: subscription?.status || null,
    maskedProviderId: maskProviderIdentifier(subscription?.stripeSubscriptionId),
  };
}

/** Read-only preview of the refundable amount for the confirm dialog. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Reading invoice amounts is a billing read — VIEWER floor is fine for the
    // preview; the actual refund (POST) requires ADMIN + step-up below.
    await requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" });
    const { id: subscriptionId } = await params;
    const subscription = await loadSubscriptionForRefund(subscriptionId);
    if (
      !subscription ||
      subscription.provider !== "STRIPE" ||
      !subscription.stripeSubscriptionId
    ) {
      return NextResponse.json(
        { refundable: false, reason: "no_stripe_subscription" },
        { status: 200 },
      );
    }

    const stripe = await getAdminStripeClient();
    const latest = await findLatestRefundable(stripe, subscription.stripeSubscriptionId);
    if (!latest) {
      return NextResponse.json({ refundable: false, reason: "no_paid_invoice" }, { status: 200 });
    }

    return NextResponse.json({
      refundable: true,
      amount: latest.amount,
      currency: latest.currency,
      maskedInvoiceId: maskProviderIdentifier(latest.invoiceId),
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Refund preview failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json({ error: "Failed to load refund preview." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canUpdate", { minimumRole: "ADMIN" });
    const raw = await request.json().catch(() => null);
    const parsed = refundSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid refund request." }, { status: 400 });
    }
    const { expectedAmount, confirmPassword, mfaCode, backupCode } = parsed.data;
    const { id: subscriptionId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    // Refunds move money irreversibly — always require MFA step-up.
    const confirm = await requirePasswordConfirm(session, confirmPassword, {
      operation: "billing_subscription_refund",
      requireMfa: true,
      mfaCode,
      backupCode,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
    if (!confirm.confirmed) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REFUND_FAILED",
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: {
          operation: "billing_subscription_refund",
          status: "failed",
          reasonCode: "step_up_failed",
          requiresMfa: Boolean(confirm.requiresMfa),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: confirm.error, requiresPassword: true, requiresMfa: confirm.requiresMfa || undefined },
        { status: 403 },
      );
    }

    const subscription = await loadSubscriptionForRefund(subscriptionId);
    if (
      !subscription ||
      subscription.provider !== "STRIPE" ||
      !subscription.stripeSubscriptionId
    ) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REFUND_FAILED",
        entityType: "Subscription",
        entityId: subscription?.id || subscriptionId,
        metadata: {
          operation: "billing_subscription_refund",
          status: "failed",
          reasonCode: "no_stripe_subscription",
          before: refundAuditBase(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "This subscription has no Stripe invoice to refund." },
        { status: 409 },
      );
    }
    const userId = subscription.userId;

    const stripe = await getAdminStripeClient();
    const latest = await findLatestRefundable(stripe, subscription.stripeSubscriptionId);
    if (!latest) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REFUND_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_refund",
          status: "failed",
          reasonCode: "no_paid_invoice",
          targetUserId: userId,
          before: refundAuditBase(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "No paid invoice is available to refund for this subscription." },
        { status: 409 },
      );
    }

    // Guard against a different invoice/amount than the operator confirmed.
    if (typeof expectedAmount === "number" && expectedAmount !== latest.amount) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REFUND_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_refund",
          status: "failed",
          reasonCode: "amount_mismatch",
          targetUserId: userId,
          confirmedAmount: expectedAmount,
          actualAmount: latest.amount,
          currency: latest.currency,
          before: refundAuditBase(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "The refundable amount changed since you confirmed. Re-open the dialog and review the new amount." },
        { status: 409 },
      );
    }

    // Stripe idempotency key embeds the payment_intent so a retry refunds the
    // SAME charge; the audit `operationId` uses a MASKED id so no raw provider
    // identifier ever lands in the log (parity with the other lifecycle routes).
    const idempotencyKey = `admin-subscription-refund:${subscription.id}:${latest.paymentIntentId}`
      .replace(/[^A-Za-z0-9:_-]/g, "_")
      .slice(0, 255);
    const operationId = `admin-subscription-refund:${subscription.id}:${maskProviderIdentifier(latest.paymentIntentId)}`;

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_REFUND_STARTED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        operation: "billing_subscription_refund",
        status: "started",
        operationId,
        targetUserId: userId,
        amount: latest.amount,
        currency: latest.currency,
        maskedInvoiceId: maskProviderIdentifier(latest.invoiceId),
        before: refundAuditBase(subscription),
      },
      request: requestMeta,
    });

    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create(
        { payment_intent: latest.paymentIntentId },
        { idempotencyKey },
      );
    } catch (stripeError: any) {
      console.error("Stripe refund failed", {
        userId,
        maskedPaymentIntentId: maskProviderIdentifier(latest.paymentIntentId),
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REFUND_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_refund",
          status: "failed",
          reasonCode: "provider_refund_failed",
          operationId,
          targetUserId: userId,
          amount: latest.amount,
          currency: latest.currency,
          errorType: stripeError?.type || null,
          errorCode: stripeError?.code || null,
          before: refundAuditBase(subscription),
        },
        request: requestMeta,
      }).catch(() => null);
      return NextResponse.json(
        { error: "Failed to issue the refund with the billing provider. Please try again." },
        { status: 502 },
      );
    }

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_REFUND_COMPLETED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        operation: "billing_subscription_refund",
        status: "completed",
        operationId,
        targetUserId: userId,
        amount: refund.amount ?? latest.amount,
        currency: refund.currency || latest.currency,
        refundStatus: refund.status || null,
        maskedRefundId: maskProviderIdentifier(refund.id),
        maskedInvoiceId: maskProviderIdentifier(latest.invoiceId),
        before: refundAuditBase(subscription),
      },
      request: requestMeta,
    });

    return NextResponse.json({
      refunded: true,
      amount: refund.amount ?? latest.amount,
      currency: refund.currency || latest.currency,
      status: refund.status || null,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Subscription refund failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to refund subscription. Please try again." },
      { status: 500 },
    );
  }
}
