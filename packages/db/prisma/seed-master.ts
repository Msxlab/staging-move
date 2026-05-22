import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { normalizeProviderRecord, sanitizeProviderSeedRecords } from "@locateflow/shared";
import { rebuildProviderCoverage } from "../src/provider-coverage";

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
  let refreshed = 0;
  for (const tpl of EMAIL_TEMPLATES_ALL) {
    const existing = await prisma.emailTemplate.findUnique({ where: { slug: tpl.slug } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: tpl });
      created++;
    } else if (existing.updatedBy === null) {
      // Refresh the default design/copy for templates no admin has edited
      // (updatedBy stays null until an admin saves a change via the panel).
      // We deliberately leave isActive/isDefault untouched so admin
      // activation choices and any customizations survive reseeds.
      await prisma.emailTemplate.update({
        where: { slug: tpl.slug },
        data: {
          name: tpl.name,
          subject: tpl.subject,
          body: tpl.body,
          category: tpl.category,
          variables: tpl.variables,
        },
      });
      refreshed++;
    }
  }
  console.log(`   created ${created}, refreshed ${refreshed} (${EMAIL_TEMPLATES_ALL.length} total)\n`);

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
