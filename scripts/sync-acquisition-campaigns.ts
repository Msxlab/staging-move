import { db } from "../packages/db/src/index";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  activeSubscriberMutationGuidance,
  getCampaignSyncTargets,
} from "./lib/acquisition-campaign-sync";

const APPLY = process.argv.includes("--apply");
const TARGET_CODES = ["INDIVIDUAL90", "INDIVIDUALMONTHLY"] as const;

async function main() {
  const targets = getCampaignSyncTargets(process.env);
  const targetByCode = new Map(targets.map((target) => [target.code, target]));

  const campaigns = await db.acquisitionCampaign.findMany({
    where: {
      code: { in: [...TARGET_CODES] },
      status: "ACTIVE",
    },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      displayPriceLabel: true,
      stripePriceId: true,
      checkoutDisclosureCopy: true,
    },
  });

  const activeSubscriberCount = await db.subscription.count({
    where: {
      OR: [
        { campaignCode: { in: [...TARGET_CODES] } },
        { campaignId: { in: campaigns.map((campaign) => campaign.id) } },
      ],
      status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] },
    },
  });

  console.log(activeSubscriberMutationGuidance(activeSubscriberCount));

  if (!campaigns.length) {
    console.log("No active INDIVIDUAL90 or INDIVIDUALMONTHLY campaigns found.");
    return;
  }

  for (const campaign of campaigns) {
    if (campaign.code !== "INDIVIDUAL90" && campaign.code !== "INDIVIDUALMONTHLY") {
      continue;
    }
    const target = targetByCode.get(campaign.code);
    if (!target) {
      console.warn(
        `Skipping ${campaign.code}: missing required Stripe price env for this campaign.`,
      );
      continue;
    }

    const data = {
      displayPriceLabel: target.displayPriceLabel,
      stripePriceId: target.stripePriceId,
      checkoutDisclosureCopy: target.checkoutDisclosureCopy,
    };

    console.log(`${APPLY ? "Updating" : "Would update"} ${campaign.code}`, {
      before: {
        displayPriceLabel: campaign.displayPriceLabel,
        stripePriceId: campaign.stripePriceId,
        checkoutDisclosureCopy: campaign.checkoutDisclosureCopy,
      },
      after: data,
    });

    if (APPLY) {
      await db.acquisitionCampaign.update({
        where: { id: campaign.id },
        data,
      });
    }
  }

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply to write these campaign updates.");
  }
}

main()
  .catch((error) => {
    console.error("Campaign sync failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
