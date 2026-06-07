import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePasswordConfirm, requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { getAdminStripeClient } from "@/lib/admin-stripe";
import { maskProviderIdentifier } from "@/lib/privacy";

/**
 * Admin lifecycle action: REFUND a paid invoice for a Stripe subscription via
 * refunds.create on that invoice's payment_intent.
 *
 * Supports both a FULL refund of the latest paid invoice (the original
 * behaviour) and two extensions:
 *   - PARTIAL amount — refund only part of the chosen invoice's paid amount.
 *   - PICK an invoice — refund a SPECIFIC paid invoice (by its human-facing
 *     invoice number) instead of always the latest, so an operator can refund
 *     an older charge.
 *
 *  - GET  → read-only PREVIEW. Returns the latest refundable invoice (amount +
 *           currency + masked id) AND, when `?invoiceNumber=` is supplied, the
 *           refundable amount for THAT specific invoice. So the confirm dialog
 *           can state EXACTLY which invoice and amount BEFORE the operator
 *           steps up. Money moves only on POST.
 *  - POST → performs the refund behind the full step-up (password + MFA) and
 *           writes START/COMPLETE/FAIL audit rows including the amount.
 *
 * SECURITY — the invoice is always re-resolved SERVER-SIDE against this
 * subscription's own invoice list (the client only supplies a human invoice
 * number, never a raw Stripe id). The `expectedAmount` guard still applies:
 * the server refuses if the refundable amount changed since the preview. A
 * partial `amount` is clamped to the invoice's paid amount so an operator can
 * never refund more than was charged.
 *
 * Keyed by Subscription.id.
 */

const refundSchema = z
  .object({
    // Optional human-facing invoice number (e.g. "ABCD-0001") selecting a
    // SPECIFIC invoice. Omitted → the latest paid invoice (original behaviour).
    invoiceNumber: z.string().trim().min(1).max(64).optional(),
    // Optional PARTIAL refund amount in minor units. Omitted → full refund of
    // the resolved invoice's paid amount.
    amount: z.number().int().positive().optional(),
    // Caller echoes back the previewed PAID amount (minor units) of the
    // resolved invoice so the server can refuse if it changed between preview
    // and confirm — the operator never refunds against a different invoice
    // state than the dialog showed. This is the invoice's full paid amount,
    // NOT the partial `amount` being refunded.
    expectedAmount: z.number().int().nonnegative().optional(),
    confirmPassword: z.string().max(256).optional(),
    mfaCode: z.string().trim().max(16).optional(),
    backupCode: z.string().trim().max(64).optional(),
  })
  .strict();

interface RefundableInvoice {
  invoiceId: string;
  number: string | null;
  paymentIntentId: string;
  amount: number; // minor units (e.g. cents) already paid
  alreadyRefunded: number; // minor units already refunded against this charge
  currency: string;
  created: number | null;
}

/**
 * Resolve a refundable invoice for the subscription. When `invoiceNumber` is
 * supplied, find THAT paid invoice; otherwise return the latest paid invoice.
 * Returns null when there is nothing refundable for the request. Always scoped
 * to the subscription so a number from another customer can never be targeted.
 */
async function findRefundable(
  stripe: Stripe,
  stripeSubscriptionId: string,
  invoiceNumber: string | null,
): Promise<RefundableInvoice | null> {
  // When picking a specific invoice we may need to scan further back than the
  // single latest; the read-only invoices route caps history at 24, so match.
  const invoices = await stripe.invoices.list({
    subscription: stripeSubscriptionId,
    status: "paid",
    limit: invoiceNumber ? 24 : 1,
    expand: ["data.charge"],
  });

  const invoice = invoiceNumber
    ? invoices.data.find((inv) => inv.number === invoiceNumber)
    : invoices.data[0];
  if (!invoice || !invoice.id) return null;

  const amountPaid = invoice.amount_paid ?? 0;
  if (amountPaid <= 0) return null;

  const paymentIntentId =
    typeof invoice.payment_intent === "string"
      ? invoice.payment_intent
      : invoice.payment_intent?.id || null;
  if (!paymentIntentId) return null;

  // How much has already been refunded against this invoice's charge, so the
  // preview/guard can cap a partial refund to the remaining refundable amount.
  const charge = invoice.charge;
  const alreadyRefunded =
    charge && typeof charge !== "string" && typeof charge.amount_refunded === "number"
      ? charge.amount_refunded
      : 0;

  return {
    invoiceId: invoice.id,
    number: invoice.number || null,
    paymentIntentId,
    amount: amountPaid,
    alreadyRefunded,
    currency: invoice.currency || "usd",
    created: invoice.created ?? null,
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
    const invoiceNumber = request.nextUrl.searchParams.get("invoiceNumber");
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
    const latest = await findRefundable(stripe, subscription.stripeSubscriptionId, invoiceNumber || null);
    if (!latest) {
      return NextResponse.json(
        { refundable: false, reason: invoiceNumber ? "invoice_not_refundable" : "no_paid_invoice" },
        { status: 200 },
      );
    }

    const remaining = Math.max(latest.amount - latest.alreadyRefunded, 0);
    return NextResponse.json({
      refundable: remaining > 0,
      reason: remaining > 0 ? undefined : "already_fully_refunded",
      amount: latest.amount,
      alreadyRefunded: latest.alreadyRefunded,
      remainingRefundable: remaining,
      currency: latest.currency,
      invoiceNumber: latest.number,
      maskedInvoiceId: maskProviderIdentifier(latest.invoiceId),
      created: latest.created ? new Date(latest.created * 1000).toISOString() : null,
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
    const { invoiceNumber, amount, expectedAmount, confirmPassword, mfaCode, backupCode } = parsed.data;
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
    const latest = await findRefundable(stripe, subscription.stripeSubscriptionId, invoiceNumber || null);
    if (!latest) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REFUND_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_refund",
          status: "failed",
          reasonCode: invoiceNumber ? "invoice_not_refundable" : "no_paid_invoice",
          targetUserId: userId,
          invoiceNumber: invoiceNumber || null,
          before: refundAuditBase(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        {
          error: invoiceNumber
            ? "That invoice is not available to refund for this subscription."
            : "No paid invoice is available to refund for this subscription.",
        },
        { status: 409 },
      );
    }

    // Guard against a different invoice/amount than the operator confirmed: the
    // echoed expectedAmount must still equal the resolved invoice's paid amount.
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
          invoiceNumber: latest.number,
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

    // Resolve the amount to refund. Default = full remaining refundable amount.
    // A partial amount is rejected (not silently clamped) when it exceeds what
    // remains refundable, so the operator is told exactly why rather than
    // refunding a surprise smaller figure.
    const remaining = Math.max(latest.amount - latest.alreadyRefunded, 0);
    if (remaining <= 0) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REFUND_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_refund",
          status: "failed",
          reasonCode: "already_fully_refunded",
          targetUserId: userId,
          invoiceNumber: latest.number,
          before: refundAuditBase(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "This invoice has already been fully refunded." },
        { status: 409 },
      );
    }
    const isPartial = typeof amount === "number";
    if (isPartial && amount! > remaining) {
      await writeAdminAudit(session, {
        action: "SUBSCRIPTION_REFUND_FAILED",
        entityType: "Subscription",
        entityId: subscription.id,
        metadata: {
          operation: "billing_subscription_refund",
          status: "failed",
          reasonCode: "amount_exceeds_remaining",
          targetUserId: userId,
          invoiceNumber: latest.number,
          requestedAmount: amount,
          remainingRefundable: remaining,
          currency: latest.currency,
          before: refundAuditBase(subscription),
        },
        request: requestMeta,
      });
      return NextResponse.json(
        { error: "The requested amount is more than what remains refundable on this invoice." },
        { status: 409 },
      );
    }
    const refundAmount = isPartial ? amount! : remaining;

    // Stripe idempotency key embeds the payment_intent + amount so a retry of
    // the SAME partial/full refund is a no-op, but a different amount is a new
    // refund. The audit `operationId` uses a MASKED id so no raw provider
    // identifier ever lands in the log (parity with the other lifecycle routes).
    const idempotencyKey = `admin-subscription-refund:${subscription.id}:${latest.paymentIntentId}:${refundAmount}`
      .replace(/[^A-Za-z0-9:_-]/g, "_")
      .slice(0, 255);
    const operationId = `admin-subscription-refund:${subscription.id}:${maskProviderIdentifier(latest.paymentIntentId)}:${refundAmount}`;

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_REFUND_STARTED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        operation: "billing_subscription_refund",
        status: "started",
        operationId,
        targetUserId: userId,
        refundKind: isPartial ? "partial" : "full",
        amount: refundAmount,
        invoicePaidAmount: latest.amount,
        remainingRefundable: remaining,
        currency: latest.currency,
        invoiceNumber: latest.number,
        maskedInvoiceId: maskProviderIdentifier(latest.invoiceId),
        before: refundAuditBase(subscription),
      },
      request: requestMeta,
    });

    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create(
        { payment_intent: latest.paymentIntentId, amount: refundAmount },
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
          refundKind: isPartial ? "partial" : "full",
          amount: refundAmount,
          currency: latest.currency,
          invoiceNumber: latest.number,
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
        refundKind: isPartial ? "partial" : "full",
        amount: refund.amount ?? refundAmount,
        currency: refund.currency || latest.currency,
        invoiceNumber: latest.number,
        refundStatus: refund.status || null,
        maskedRefundId: maskProviderIdentifier(refund.id),
        maskedInvoiceId: maskProviderIdentifier(latest.invoiceId),
        before: refundAuditBase(subscription),
      },
      request: requestMeta,
    });

    return NextResponse.json({
      refunded: true,
      refundKind: isPartial ? "partial" : "full",
      amount: refund.amount ?? refundAmount,
      currency: refund.currency || latest.currency,
      invoiceNumber: latest.number,
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
