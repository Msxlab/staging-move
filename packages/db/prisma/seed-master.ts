import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { normalizeProviderRecord, safeJsonArray, sanitizeProviderSeedRecords } from "@locateflow/shared";
import { rebuildProviderCoverage } from "../src/provider-coverage";
import {
  getControlledDraftProviderSeeds,
  getControlledExistingProviderUpdates,
  getControlledGovernanceIssueSeeds,
} from "./seed-data/controlled-provider-import";

const prisma = new PrismaClient();

async function upsertProvider(d: any) {
  const normalized = normalizeProviderRecord(d);
  const existing = await prisma.serviceProvider.findUnique({ where: { slug: normalized.slug } });
  if (existing) return false;

  const states = normalized.states;
  const zipCodes = normalized.zipCodes;
  const scope = normalized.scope;

  await prisma.$transaction(async (tx) => {
    const created = await tx.serviceProvider.create({
      data: {
        name: normalized.name,
        slug: normalized.slug,
        category: normalized.category,
        subCategory: normalized.subCategory,
        description: normalized.description,
        website: normalized.website,
        phone: normalized.phone,
        scope,
        states: JSON.stringify(states),
        zipCodes: JSON.stringify(zipCodes),
        tags: JSON.stringify(normalized.tags),
        popularityScore: normalized.popularityScore || 50,
        isActive: normalized.isActive ?? true,
        displayOrder: normalized.displayOrder || 0,
      },
    });
    await rebuildProviderCoverage(tx, { providerId: created.id, scope, states, zipCodes });
  });

  return true;
}

function mergeStringArrays(...values: Array<string[] | string | null | undefined>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of values) {
    for (const item of safeJsonArray(value)) {
      const clean = item.trim();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);
      merged.push(clean);
    }
  }
  return merged;
}

async function applyControlledProviderUpdate(update: ReturnType<typeof getControlledExistingProviderUpdates>[number]) {
  const existing = await prisma.serviceProvider.findUnique({ where: { slug: update.slug } });
  if (!existing || existing.deletedAt) return false;

  const states = update.states.length > 0 ? update.states : safeJsonArray(existing.states);
  const zipCodes = update.zipCodes.length > 0 ? update.zipCodes : safeJsonArray(existing.zipCodes);
  const tags = mergeStringArrays(existing.tags, update.tags);
  const description = update.isActive === false || !existing.description?.trim()
    ? update.description
    : existing.description;

  await prisma.$transaction(async (tx) => {
    await tx.serviceProvider.update({
      where: { id: existing.id },
      data: {
        states: JSON.stringify(states),
        zipCodes: JSON.stringify(zipCodes),
        tags: JSON.stringify(tags),
        description,
        subCategory: update.isActive === false ? update.subCategory : existing.subCategory || update.subCategory,
        ...(typeof update.isActive === "boolean" ? { isActive: update.isActive } : {}),
      },
    });
    await rebuildProviderCoverage(tx, {
      providerId: existing.id,
      scope: existing.scope,
      states,
      zipCodes,
    });
  });

  return true;
}

async function upsertControlledGovernanceIssue(issue: ReturnType<typeof getControlledGovernanceIssueSeeds>[number]) {
  const provider = issue.providerSlug
    ? await prisma.serviceProvider.findUnique({ where: { slug: issue.providerSlug } })
    : null;
  const existing = await prisma.providerGovernanceIssue.findFirst({
    where: {
      issueType: issue.issueType,
      title: issue.title,
    },
  });
  const data = {
    providerId: provider?.id || null,
    issueType: issue.issueType,
    status: issue.status,
    severity: issue.severity,
    title: issue.title,
    description: issue.description,
    metadata: issue.metadata,
  };

  if (existing) {
    await prisma.providerGovernanceIssue.update({
      where: { id: existing.id },
      data: {
        providerId: data.providerId,
        severity: data.severity,
        title: data.title,
        description: data.description,
        metadata: data.metadata,
      },
    });
    return false;
  }

  await prisma.providerGovernanceIssue.create({ data });
  return true;
}

import { FEDERAL_NEW, STATE_DMVS, STATE_PROVIDERS } from "./seed-data/provider-seed";
import { STATE_RULES_ALL } from "./seed-data/state-rules";
import { EMAIL_TEMPLATES_ALL } from "./seed-data/email-templates";
import { HELP_ARTICLES_ALL, FAQS_ALL } from "./seed-data/help-center";

async function main() {
  console.log("Master seed starting...\n");

  const federalProviders = sanitizeProviderSeedRecords(FEDERAL_NEW).providers;
  const stateDmvs = sanitizeProviderSeedRecords(
    STATE_DMVS.map((dmv) => ({ ...dmv, category: "GOVERNMENT_DMV", scope: "STATE" }))
  ).providers;
  const stateProviders = sanitizeProviderSeedRecords(STATE_PROVIDERS).providers;

  console.log("P1: Federal Providers...");
  let created = 0;
  for (const prov of federalProviders) {
    if (await upsertProvider(prov)) created++;
  }
  console.log(`   created ${created} (${federalProviders.length} total)\n`);

  console.log("P1b: State DMVs...");
  created = 0;
  for (const dmv of stateDmvs) {
    if (await upsertProvider(dmv)) created++;
  }
  console.log(`   created ${created} (${stateDmvs.length} total)\n`);

  console.log("P1c: State Providers...");
  created = 0;
  for (const prov of stateProviders) {
    if (await upsertProvider(prov)) created++;
  }
  console.log(`   created ${created} (${stateProviders.length} total)\n`);

  console.log("P1d: Controlled draft providers...");
  const controlledDraftProviders = sanitizeProviderSeedRecords(getControlledDraftProviderSeeds()).providers;
  created = 0;
  for (const prov of controlledDraftProviders) {
    if (await upsertProvider(prov)) created++;
  }
  console.log(`   created ${created} (${controlledDraftProviders.length} inactive draft total)\n`);

  console.log("P1e: Controlled provider scope/metadata updates...");
  created = 0;
  const controlledUpdates = getControlledExistingProviderUpdates();
  for (const update of controlledUpdates) {
    if (await applyControlledProviderUpdate(update)) created++;
  }
  console.log(`   updated ${created} (${controlledUpdates.length} controlled updates total)\n`);

  console.log("P1f: Controlled provider governance issues...");
  created = 0;
  const controlledIssues = getControlledGovernanceIssueSeeds();
  for (const issue of controlledIssues) {
    if (await upsertControlledGovernanceIssue(issue)) created++;
  }
  console.log(`   created ${created} (${controlledIssues.length} governed rows total)\n`);

  console.log("P2: State Rules...");
  created = 0;
  for (const rule of STATE_RULES_ALL) {
    await prisma.stateRule.upsert({
      where: { stateCode: rule.stateCode },
      update: { ...rule },
      create: { ...rule },
    });
    created++;
  }
  console.log(`   upserted ${created}\n`);

  console.log("P4: Email Templates...");
  created = 0;
  for (const tpl of EMAIL_TEMPLATES_ALL) {
    const existing = await prisma.emailTemplate.findUnique({ where: { slug: tpl.slug } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: tpl });
      created++;
    }
  }
  console.log(`   created ${created} (${EMAIL_TEMPLATES_ALL.length} total)\n`);

  console.log("P5: Help Articles...");
  created = 0;
  for (const art of HELP_ARTICLES_ALL) {
    const existing = await prisma.helpArticle.findUnique({ where: { slug: art.slug } });
    if (!existing) {
      await prisma.helpArticle.create({ data: art });
      created++;
    }
  }
  console.log(`   created ${created} articles`);

  console.log("P5b: FAQs...");
  const existingFaqs = await prisma.fAQ.count();
  if (existingFaqs === 0) {
    for (const faq of FAQS_ALL) {
      await prisma.fAQ.create({ data: faq });
    }
    console.log(`   created ${FAQS_ALL.length} FAQs\n`);
  } else {
    console.log(`   skipped (${existingFaqs} already exist)\n`);
  }

  const counts = await Promise.all([
    prisma.serviceProvider.count(),
    prisma.stateRule.count(),
    prisma.emailTemplate.count(),
    prisma.helpArticle.count(),
    prisma.fAQ.count(),
  ]);

  console.log("FINAL COUNTS:");
  console.log(`   Providers:       ${counts[0]}`);
  console.log(`   State Rules:     ${counts[1]}`);
  console.log(`   Email Templates: ${counts[2]}`);
  console.log(`   Help Articles:   ${counts[3]}`);
  console.log(`   FAQs:            ${counts[4]}`);
}

main()
  .then(() => console.log("\nMaster seed complete!"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
