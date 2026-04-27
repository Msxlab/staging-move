import { db } from "../packages/db/src";
import {
  DEFAULT_BILLING_PLAN,
  DEFAULT_SUBSCRIPTION_STATUS,
  TRIAL_DURATION_DAYS,
} from "../packages/shared/src/billing";

const apply = process.argv.includes("--apply");

function trialEndsAtFromCreatedAt(createdAt: Date) {
  return new Date(createdAt.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

async function main() {
  const users = await db.user.findMany({
    where: {
      deletedAt: null,
      subscription: null,
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${users.length} active user(s) without subscription rows.`);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to create canonical subscription rows.");
    return;
  }

  for (const user of users) {
    const trialEndsAt = trialEndsAtFromCreatedAt(user.createdAt);
    await db.subscription.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        plan: DEFAULT_BILLING_PLAN,
        status: Date.now() > trialEndsAt.getTime() ? "EXPIRED" : DEFAULT_SUBSCRIPTION_STATUS,
        provider: "TRIAL",
        platform: "web",
        trialEndsAt,
      },
    });
  }

  console.log(`Created subscription rows for ${users.length} user(s).`);
}

main()
  .catch((error) => {
    console.error("Failed to backfill missing subscriptions:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
