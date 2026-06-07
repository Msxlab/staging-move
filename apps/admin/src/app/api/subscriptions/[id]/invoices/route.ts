import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";
import { getAdminStripeClient } from "@/lib/admin-stripe";
import { maskProviderIdentifier } from "@/lib/privacy";

/**
 * Read-only INVOICE / PAYMENT history for a single subscription.
 *
 * GET → lists the Stripe invoices for the subscription (amount, date, status,
 * and the hosted-invoice / receipt links) so an operator can see the billing
 * history in the detail view WITHOUT leaving the admin. Strictly read-only:
 * it never moves money or mutates local state.
 *
 * Privacy posture (matches the rest of the subscriptions module):
 *   - Permission floor is subscriptions:canRead (VIEWER) — same as the refund
 *     PREVIEW — because reading invoice amounts is a billing read, not a
 *     mutation. The actual money-moving routes stay ADMIN + step-up.
 *   - Raw Stripe identifiers (invoice id, payment-intent id, customer id) are
 *     MASKED via maskProviderIdentifier; no card/PII fields are ever returned.
 *   - The hosted-invoice and receipt URLs are Stripe-issued links the operator
 *     would otherwise open from the Stripe dashboard; they are returned as-is
 *     so the operator can open the canonical document.
 *
 * Keyed by Subscription.id.
 */

const MAX_INVOICES = 24;

interface InvoiceHistoryEntry {
  maskedInvoiceId: string;
  number: string | null; // human-facing invoice number (e.g. ABCD-0001)
  status: string | null; // draft | open | paid | uncollectible | void
  created: string | null; // ISO timestamp of invoice creation
  periodStart: string | null;
  periodEnd: string | null;
  amountDue: number; // minor units
  amountPaid: number; // minor units
  currency: string;
  paid: boolean;
  refunded: boolean; // any amount refunded against this invoice's charge
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  receiptUrl: string | null; // charge receipt, when the invoice was paid
}

function toIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Pull the receipt URL + refund flag off the expanded charge, when present.
 * We expand `charge` only (one extra object per invoice), never the customer
 * or payment-method, to keep the surface free of PII.
 */
function readChargeFacts(invoice: Stripe.Invoice): {
  receiptUrl: string | null;
  refunded: boolean;
} {
  const charge = invoice.charge;
  if (!charge || typeof charge === "string") {
    return { receiptUrl: null, refunded: false };
  }
  const refunded =
    Boolean(charge.refunded) || (typeof charge.amount_refunded === "number" && charge.amount_refunded > 0);
  return { receiptUrl: charge.receipt_url || null, refunded };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePermission("subscriptions", "canRead", { minimumRole: "VIEWER" });
    const { id: subscriptionId } = await params;
    const requestMeta = getAuditRequestMeta(request);

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        userId: true,
        provider: true,
        stripeSubscriptionId: true,
      },
    });

    if (
      !subscription ||
      subscription.provider !== "STRIPE" ||
      !subscription.stripeSubscriptionId
    ) {
      // Not an error — store / trial subscriptions simply have no Stripe
      // invoice history. The UI renders an explanatory empty state.
      return NextResponse.json(
        { supported: false, reason: "no_stripe_subscription", invoices: [] },
        { status: 200 },
      );
    }

    const stripe = await getAdminStripeClient();
    let list: Stripe.ApiList<Stripe.Invoice>;
    try {
      list = await stripe.invoices.list({
        subscription: subscription.stripeSubscriptionId,
        limit: MAX_INVOICES,
        expand: ["data.charge"],
      });
    } catch (stripeError: any) {
      console.error("Stripe invoice list failed", {
        userId: subscription.userId,
        maskedStripeSubscriptionId: maskProviderIdentifier(subscription.stripeSubscriptionId),
        type: stripeError?.type || null,
        code: stripeError?.code || null,
      });
      return NextResponse.json(
        { error: "Failed to load invoices from the billing provider. Please try again." },
        { status: 502 },
      );
    }

    const invoices: InvoiceHistoryEntry[] = list.data.map((invoice) => {
      const { receiptUrl, refunded } = readChargeFacts(invoice);
      return {
        maskedInvoiceId: maskProviderIdentifier(invoice.id),
        number: invoice.number || null,
        status: invoice.status || null,
        created: toIso(invoice.created),
        periodStart: toIso(invoice.period_start),
        periodEnd: toIso(invoice.period_end),
        amountDue: invoice.amount_due ?? 0,
        amountPaid: invoice.amount_paid ?? 0,
        currency: invoice.currency || "usd",
        paid: Boolean(invoice.paid),
        refunded,
        hostedInvoiceUrl: invoice.hosted_invoice_url || null,
        invoicePdfUrl: invoice.invoice_pdf || null,
        receiptUrl,
      };
    });

    await writeAdminAudit(session, {
      action: "SUBSCRIPTION_INVOICES_VIEWED",
      entityType: "Subscription",
      entityId: subscription.id,
      metadata: {
        operation: "billing_subscription_invoices_view",
        status: "success",
        targetUserId: subscription.userId,
        invoiceCount: invoices.length,
        maskedProviderId: maskProviderIdentifier(subscription.stripeSubscriptionId),
      },
      request: requestMeta,
    }).catch(() => null);

    return NextResponse.json({ supported: true, invoices });
  } catch (error: any) {
    if (error?.message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error?.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("Subscription invoices failed", {
      message: typeof error?.message === "string" ? error.message.slice(0, 500) : "unknown",
    });
    return NextResponse.json(
      { error: "Failed to load invoice history. Please try again." },
      { status: 500 },
    );
  }
}
