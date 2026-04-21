#!/usr/bin/env tsx
/**
 * Stripe price sync — creates the Individual Product + two Prices
 * (monthly $7.99 and yearly $79) on your Stripe account, then prints the
 * Price IDs you should paste into `.env.production`
 * (STRIPE_PRICE_INDIVIDUAL + STRIPE_PRICE_INDIVIDUAL_YEARLY).
 *
 * Runs ONLY on your machine / server — reads STRIPE_SECRET_KEY from the
 * environment. Never paste that secret into chat.
 *
 * Usage:
 *   # Preview what will be created (no API writes):
 *   STRIPE_SECRET_KEY=sk_live_... pnpm stripe:sync-prices
 *
 *   # Create on Stripe:
 *   STRIPE_SECRET_KEY=sk_live_... pnpm stripe:sync-prices -- --apply
 *
 *   # Custom prices (cents):
 *   STRIPE_SECRET_KEY=sk_live_... pnpm stripe:sync-prices -- \
 *     --monthly-cents=799 --yearly-cents=7900 --apply
 *
 * Idempotency: looks up a Product whose metadata has
 * `locateflow_plan=INDIVIDUAL` and reuses it; skips Prices that already
 * match the target amount+interval. Safe to re-run.
 *
 * Note (pre-launch): there are no live subscribers yet, so nothing needs
 * to be migrated. If you re-run this later with new prices, Stripe Prices
 * are immutable — the script will create new rows next to the old ones.
 * To retire an old Price, archive it in the Stripe dashboard.
 */

import Stripe from "stripe";

interface CliFlags {
  apply: boolean;
  monthlyCents: number;
  yearlyCents: number;
  productName: string;
  productId?: string;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    apply: false,
    monthlyCents: 799,
    yearlyCents: 7900,
    productName: "LocateFlow Individual",
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--apply") flags.apply = true;
    else if (arg.startsWith("--monthly-cents="))
      flags.monthlyCents = Number(arg.split("=")[1]);
    else if (arg.startsWith("--yearly-cents="))
      flags.yearlyCents = Number(arg.split("=")[1]);
    else if (arg.startsWith("--product-name="))
      flags.productName = arg.split("=")[1];
    else if (arg.startsWith("--product-id="))
      flags.productId = arg.split("=")[1];
    else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(2);
    }
  }
  if (
    !Number.isFinite(flags.monthlyCents) ||
    flags.monthlyCents <= 0 ||
    !Number.isFinite(flags.yearlyCents) ||
    flags.yearlyCents <= 0
  ) {
    console.error("Invalid --monthly-cents / --yearly-cents");
    process.exit(2);
  }
  return flags;
}

async function findExistingProduct(
  stripe: Stripe,
  flags: CliFlags,
): Promise<Stripe.Product | null> {
  if (flags.productId) {
    return stripe.products.retrieve(flags.productId);
  }
  // Search is optional; fall back to list scan if the account doesn't support it.
  try {
    const res = await stripe.products.search({
      query: `metadata['locateflow_plan']:'INDIVIDUAL' AND active:'true'`,
      limit: 1,
    });
    if (res.data.length > 0) return res.data[0];
  } catch {
    // Fallback: scan recent products
    for await (const p of stripe.products.list({ active: true, limit: 100 })) {
      if (p.metadata?.locateflow_plan === "INDIVIDUAL") return p;
    }
  }
  return null;
}

async function findExistingPrice(
  stripe: Stripe,
  productId: string,
  interval: Stripe.Price.Recurring.Interval,
  unitAmount: number,
): Promise<Stripe.Price | null> {
  for await (const price of stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  })) {
    if (
      price.recurring?.interval === interval &&
      price.unit_amount === unitAmount &&
      price.currency === "usd"
    ) {
      return price;
    }
  }
  return null;
}

async function main() {
  const flags = parseFlags(process.argv);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY is required in the environment.");
    process.exit(1);
  }
  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  const mode = flags.apply ? "APPLY" : "DRY-RUN";
  console.log(`\n[stripe-sync] mode=${mode}`);
  console.log(
    `[stripe-sync] target prices: $${(flags.monthlyCents / 100).toFixed(2)}/mo, $${(flags.yearlyCents / 100).toFixed(2)}/yr\n`,
  );

  let product = await findExistingProduct(stripe, flags);
  if (product) {
    console.log(
      `[stripe-sync] reusing existing product: ${product.id} (${product.name})`,
    );
  } else {
    console.log(
      `[stripe-sync] product missing — would create "${flags.productName}"`,
    );
    if (flags.apply) {
      product = await stripe.products.create({
        name: flags.productName,
        description:
          "Track every service provider tied to your addresses. Individual plan.",
        metadata: { locateflow_plan: "INDIVIDUAL" },
      });
      console.log(`[stripe-sync] created product: ${product.id}`);
    }
  }

  async function ensurePrice(
    interval: Stripe.Price.Recurring.Interval,
    unitAmount: number,
    nickname: string,
  ): Promise<string | null> {
    if (!product) return null; // dry-run without existing product
    const existing = await findExistingPrice(stripe, product.id, interval, unitAmount);
    if (existing) {
      console.log(
        `[stripe-sync] reusing existing ${interval} price: ${existing.id} ($${(unitAmount / 100).toFixed(2)})`,
      );
      return existing.id;
    }
    console.log(
      `[stripe-sync] ${interval} price missing — would create at $${(unitAmount / 100).toFixed(2)}`,
    );
    if (!flags.apply) return null;
    const created = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: "usd",
      recurring: { interval },
      nickname,
      metadata: { locateflow_plan: "INDIVIDUAL", locateflow_cycle: interval },
    });
    console.log(`[stripe-sync] created ${interval} price: ${created.id}`);
    return created.id;
  }

  const monthlyPriceId = await ensurePrice(
    "month",
    flags.monthlyCents,
    "Individual — monthly",
  );
  const yearlyPriceId = await ensurePrice(
    "year",
    flags.yearlyCents,
    "Individual — yearly",
  );

  console.log("\n[stripe-sync] ===== result =====");
  console.log(`STRIPE_PRICE_INDIVIDUAL=${monthlyPriceId ?? "<would-create-on-apply>"}`);
  console.log(
    `STRIPE_PRICE_INDIVIDUAL_YEARLY=${yearlyPriceId ?? "<would-create-on-apply>"}`,
  );

  if (!flags.apply) {
    console.log(
      "\n[stripe-sync] dry-run complete. Re-run with --apply to create resources.",
    );
  } else {
    console.log(
      "\n[stripe-sync] Done. Paste the IDs above into .env.production and redeploy.",
    );
  }
}

main().catch((err) => {
  console.error("[stripe-sync] failed:", err);
  process.exit(1);
});
