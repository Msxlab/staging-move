import Stripe from "stripe";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

export type StripeCampaignPriceValidationInput = {
  accessType?: string | null;
  requiresPaymentMethod?: boolean | null;
  stripePriceId?: string | null;
  displayPriceLabel?: string | null;
  billingInterval?: string | null;
  status?: string | null;
};

export type StripeCampaignPriceValidationResult = {
  ok: boolean;
  code?: "PRICE_VALIDATION_FAILED";
  error?: string;
  warning?: string;
  skipped?: boolean;
  displayPriceLabel?: string | null;
  canonicalDisplayPriceLabel?: string | null;
  price?: {
    active: boolean;
    currency: string;
    interval: string | null;
    unitAmount: number | null;
  };
};

function isActiveWrite(input: StripeCampaignPriceValidationInput) {
  return input.status === "ACTIVE";
}

function paymentRequired(input: StripeCampaignPriceValidationInput) {
  if (input.accessType === "FREE_ACCESS" && input.requiresPaymentMethod === false) {
    return false;
  }
  return input.requiresPaymentMethod === true || input.accessType === "FREE_TRIAL" || input.accessType === "PAID";
}

function configuredCurrency() {
  return (process.env.STRIPE_CAMPAIGN_CURRENCY || process.env.STRIPE_CURRENCY || "usd").toLowerCase();
}

function intervalForBillingInterval(value?: string | null) {
  if (value === "YEAR") return "year";
  if (value === "MONTH") return "month";
  return value?.toLowerCase() || null;
}

function formatUsdAmount(unitAmount: number) {
  const amount = unitAmount / 100;
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function canonicalDisplayPriceLabel(input: {
  unitAmount: number;
  currency: string;
  interval: string;
}) {
  const currency = input.currency.toLowerCase();
  const amount = currency === "usd"
    ? formatUsdAmount(input.unitAmount)
    : `${currency.toUpperCase()} ${(input.unitAmount / 100).toFixed(2)}`;
  return `${amount}/${input.interval}`;
}

function normalizeDisplayPriceLabel(label?: string | null) {
  const trimmed = String(label || "").trim().toLowerCase();
  if (!trimmed) return null;
  const match = trimmed.match(/(?:usd\s*)?\$?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*\/\s*(year|yr|yearly|annual|month|mo|monthly)/i);
  if (!match) return null;
  const amountCents = Math.round(Number.parseFloat(match[1]) * 100);
  const rawInterval = match[2].toLowerCase();
  const interval = ["year", "yr", "yearly", "annual"].includes(rawInterval) ? "year" : "month";
  return `${amountCents}/${interval}`;
}

function validationProblem(
  message: string,
  input: StripeCampaignPriceValidationInput,
): StripeCampaignPriceValidationResult {
  if (isActiveWrite(input)) {
    return { ok: false, code: "PRICE_VALIDATION_FAILED", error: message };
  }
  return { ok: true, warning: message, displayPriceLabel: input.displayPriceLabel || null };
}

export async function validateStripeCampaignPrice(
  input: StripeCampaignPriceValidationInput,
): Promise<StripeCampaignPriceValidationResult> {
  if (!paymentRequired(input)) {
    return { ok: true, skipped: true, displayPriceLabel: input.displayPriceLabel || null };
  }

  const stripePriceId = input.stripePriceId?.trim();
  if (!stripePriceId) {
    return validationProblem("Stripe price is required for paid campaigns.", input);
  }

  const stripeSecretKey = await getAdminRuntimeConfigValue("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    return validationProblem("Stripe price could not be validated because STRIPE_SECRET_KEY is not configured.", input);
  }

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
    const price = await stripe.prices.retrieve(stripePriceId);
    const interval = price.recurring?.interval || null;
    const currency = price.currency?.toLowerCase() || "";
    const expectedCurrency = configuredCurrency();
    const expectedInterval = intervalForBillingInterval(input.billingInterval);

    if (!price.active) {
      return validationProblem("Stripe price is inactive.", input);
    }
    if (!price.unit_amount || price.unit_amount < 1) {
      return validationProblem("Stripe price must have a fixed amount.", input);
    }
    if (!interval || interval !== expectedInterval) {
      return validationProblem(`Stripe price must be ${expectedInterval || "the selected"} recurring interval.`, input);
    }
    if (currency !== expectedCurrency) {
      return validationProblem(`Stripe price currency must be ${expectedCurrency.toUpperCase()}.`, input);
    }

    const canonicalLabel = canonicalDisplayPriceLabel({
      unitAmount: price.unit_amount,
      currency,
      interval,
    });
    const normalizedDisplay = normalizeDisplayPriceLabel(input.displayPriceLabel);
    const normalizedCanonical = normalizeDisplayPriceLabel(canonicalLabel);

    if (!normalizedDisplay) {
      return {
        ok: true,
        displayPriceLabel: canonicalLabel,
        canonicalDisplayPriceLabel: canonicalLabel,
        price: {
          active: price.active,
          currency,
          interval,
          unitAmount: price.unit_amount,
        },
      };
    }

    if (normalizedDisplay !== normalizedCanonical) {
      return validationProblem(
        `Stripe price is ${canonicalLabel} but displayed label is ${input.displayPriceLabel}.`,
        input,
      );
    }

    return {
      ok: true,
      displayPriceLabel: input.displayPriceLabel || canonicalLabel,
      canonicalDisplayPriceLabel: canonicalLabel,
      price: {
        active: price.active,
        currency,
        interval,
        unitAmount: price.unit_amount,
      },
    };
  } catch {
    return validationProblem("Stripe price could not be validated. Try again before activating.", input);
  }
}
