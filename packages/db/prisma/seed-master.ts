import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { rebuildProviderCoverage } from "../src/provider-coverage";

const prisma = new PrismaClient();

async function upsertProvider(d: any) {
  const existing = await prisma.serviceProvider.findUnique({ where: { slug: d.slug } });
  if (existing) return false;
  const states = d.states || [];
  const zipCodes = d.zipCodes || [];
  const scope = d.scope;
  await prisma.$transaction(async (tx) => {
    const created = await tx.serviceProvider.create({
      data: {
        name: d.name, slug: d.slug, category: d.category, subCategory: d.subCategory,
        description: d.description, website: d.website, phone: d.phone,
        scope, states: JSON.stringify(states),
        zipCodes: JSON.stringify(zipCodes), tags: JSON.stringify(d.tags || []),
        popularityScore: d.popularityScore || 50, isActive: true, displayOrder: 0,
      },
    });
    await rebuildProviderCoverage(tx, { providerId: created.id, scope, states, zipCodes });
  });
  return true;
}

// Import data from separate files
import { FEDERAL_NEW, STATE_DMVS, STATE_PROVIDERS } from "./seed-data/providers";
import { STATE_RULES_ALL } from "./seed-data/state-rules";
import { EMAIL_TEMPLATES_ALL } from "./seed-data/email-templates";
import { HELP_ARTICLES_ALL, FAQS_ALL } from "./seed-data/help-center";

async function main() {
  console.log("🌱 Master Seed — Starting...\n");

  // P1: Federal Providers
  console.log("📦 P1: Federal Providers...");
  let created = 0;
  for (const prov of FEDERAL_NEW) { if (await upsertProvider(prov)) created++; }
  console.log(`   ✓ ${created} created (${FEDERAL_NEW.length} total)\n`);

  // P1b: State DMVs
  console.log("🪪 P1b: State DMVs...");
  created = 0;
  for (const dmv of STATE_DMVS) {
    if (await upsertProvider({ ...dmv, category: "GOVERNMENT_DMV", scope: "STATE" })) created++;
  }
  console.log(`   ✓ ${created} created (${STATE_DMVS.length} total)\n`);

  // P1c: State Providers (utilities, transit, health, toll, ISP, grocery)
  console.log("🏛️ P1c: State Providers...");
  created = 0;
  for (const prov of STATE_PROVIDERS) { if (await upsertProvider(prov)) created++; }
  console.log(`   ✓ ${created} created (${STATE_PROVIDERS.length} total)\n`);

  // P2: State Rules
  console.log("📋 P2: State Rules (all 50 + DC)...");
  created = 0;
  for (const rule of STATE_RULES_ALL) {
    await prisma.stateRule.upsert({
      where: { stateCode: rule.stateCode },
      update: { ...rule },
      create: { ...rule },
    });
    created++;
  }
  console.log(`   ✓ ${created} upserted\n`);

  // P4: Email Templates
  console.log("📧 P4: Email Templates...");
  created = 0;
  for (const tpl of EMAIL_TEMPLATES_ALL) {
    const existing = await prisma.emailTemplate.findUnique({ where: { slug: tpl.slug } });
    if (!existing) {
      await prisma.emailTemplate.create({ data: tpl });
      created++;
    }
  }
  console.log(`   ✓ ${created} created (${EMAIL_TEMPLATES_ALL.length} total)\n`);

  // P5: Help Articles + FAQs
  console.log("📖 P5: Help Articles...");
  created = 0;
  for (const art of HELP_ARTICLES_ALL) {
    const existing = await prisma.helpArticle.findUnique({ where: { slug: art.slug } });
    if (!existing) { await prisma.helpArticle.create({ data: art }); created++; }
  }
  console.log(`   ✓ ${created} articles created`);

  console.log("❓ P5b: FAQs...");
  const existingFaqs = await prisma.fAQ.count();
  if (existingFaqs === 0) {
    for (const faq of FAQS_ALL) { await prisma.fAQ.create({ data: faq }); }
    console.log(`   ✓ ${FAQS_ALL.length} FAQs created\n`);
  } else {
    console.log(`   → Skipped (${existingFaqs} already exist)\n`);
  }

  // Summary
  const counts = await Promise.all([
    prisma.serviceProvider.count(),
    prisma.stateRule.count(),
    prisma.emailTemplate.count(),
    prisma.helpArticle.count(),
    prisma.fAQ.count(),
  ]);
  console.log("═══════════════════════════════════");
  console.log("📊 FINAL COUNTS:");
  console.log(`   Providers:      ${counts[0]}`);
  console.log(`   State Rules:    ${counts[1]}`);
  console.log(`   Email Templates:${counts[2]}`);
  console.log(`   Help Articles:  ${counts[3]}`);
  console.log(`   FAQs:           ${counts[4]}`);
  console.log("═══════════════════════════════════");
}

main()
  .then(() => console.log("\n✅ Master seed complete!"))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
