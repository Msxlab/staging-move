import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATE_RULES = [
  {
    stateCode: "CA",
    stateName: "California",
    dmvRules: "Must update DL within 10 days of establishing residency. Visit local DMV or apply online at dmv.ca.gov.",
    voterRegistration: "Register online at registertovote.ca.gov. Deadline: 15 days before election (conditional registration available).",
    utilityInfo: "Major providers: PG&E, SCE, SDG&E. Deregulated energy market in some areas.",
    taxInfo: "State income tax: 1%-13.3%. No tax on Social Security benefits. High property tax exemption for homeowners.",
    insuranceRules: "Auto insurance required: liability minimum 15/30/5. Earthquake insurance optional but recommended.",
    commonProviders: JSON.stringify(["PG&E", "Southern California Edison", "San Diego Gas & Electric", "AT&T", "Spectrum"]),
  },
  {
    stateCode: "TX",
    stateName: "Texas",
    dmvRules: "Must obtain TX DL within 90 days. Visit local DPS office. Vehicle inspection required within 90 days.",
    voterRegistration: "Register by mail or in person. Deadline: 30 days before election. No online registration.",
    utilityInfo: "Deregulated electricity market — choose your provider at powertochoose.org. Major gas: CenterPoint, Atmos.",
    taxInfo: "No state income tax. Property tax rates among highest in US (avg ~1.8%). Sales tax: 6.25% + local.",
    insuranceRules: "Auto insurance required: liability minimum 30/60/25. Flood insurance recommended in coastal areas.",
    commonProviders: JSON.stringify(["TXU Energy", "Reliant", "CenterPoint Energy", "AT&T", "Spectrum"]),
  },
  {
    stateCode: "NY",
    stateName: "New York",
    dmvRules: "Must obtain NY DL within 30 days. Visit local DMV. Vehicle inspection required annually.",
    voterRegistration: "Register online at elections.ny.gov. Deadline: 25 days before election.",
    utilityInfo: "Major providers: Con Edison, National Grid, NYSEG. Regulated market.",
    taxInfo: "State income tax: 4%-10.9%. NYC residents pay additional city tax. Property tax varies widely.",
    insuranceRules: "Auto insurance required: liability minimum 25/50/10. No-fault state. PIP required.",
    commonProviders: JSON.stringify(["Con Edison", "National Grid", "PSEG", "Optimum", "Verizon Fios"]),
  },
  {
    stateCode: "FL",
    stateName: "Florida",
    dmvRules: "Must obtain FL DL within 30 days. Visit local DHSMV office or apply at flhsmv.gov.",
    voterRegistration: "Register online at registertovoteflorida.gov. Deadline: 29 days before election.",
    utilityInfo: "Major providers: FPL, Duke Energy, TECO. Regulated market.",
    taxInfo: "No state income tax. Sales tax: 6% + local. Homestead exemption up to $50K for property tax.",
    insuranceRules: "Auto insurance: PIP ($10K) and property damage ($10K) required. Bodily injury recommended. Flood insurance critical in many areas.",
    commonProviders: JSON.stringify(["Florida Power & Light", "Duke Energy", "TECO", "AT&T", "Xfinity"]),
  },
  {
    stateCode: "IL",
    stateName: "Illinois",
    dmvRules: "Must obtain IL DL within 90 days. Visit Secretary of State office. Vehicle emissions test in Chicago metro.",
    voterRegistration: "Register online at ova.elections.il.gov. Same-day registration available.",
    utilityInfo: "Major providers: ComEd, Ameren, Nicor Gas. Deregulated electricity market.",
    taxInfo: "Flat state income tax: 4.95%. Property tax among highest in US. Sales tax: 6.25% + local.",
    insuranceRules: "Auto insurance required: liability minimum 25/50/20. Uninsured motorist coverage recommended.",
    commonProviders: JSON.stringify(["ComEd", "Ameren Illinois", "Nicor Gas", "Xfinity", "AT&T"]),
  },
];

const BADGES = [
  { code: "FIRST_ADDRESS", name: "Home Base", description: "Added your first address", category: "ADDRESS", requirement: "ADDRESS_COUNT_1", rarity: "COMMON", points: 10 },
  { code: "FIVE_ADDRESSES", name: "Nomad", description: "Managed 5 addresses", category: "ADDRESS", requirement: "ADDRESS_COUNT_5", rarity: "RARE", points: 50 },
  { code: "FIRST_SERVICE", name: "Connected", description: "Added your first service", category: "SERVICE", requirement: "SERVICE_COUNT_1", rarity: "COMMON", points: 10 },
  { code: "TEN_SERVICES", name: "Organized", description: "Managing 10 services", category: "SERVICE", requirement: "SERVICE_COUNT_10", rarity: "UNCOMMON", points: 30 },
  { code: "TWENTY_FIVE_SERVICES", name: "Master Organizer", description: "Managing 25 services", category: "SERVICE", requirement: "SERVICE_COUNT_25", rarity: "EPIC", points: 100 },
  { code: "FIRST_TASK", name: "Go-Getter", description: "Completed your first task", category: "TASK", requirement: "TASK_COMPLETED_1", rarity: "COMMON", points: 10 },
  { code: "TEN_TASKS", name: "Productive", description: "Completed 10 tasks", category: "TASK", requirement: "TASK_COMPLETED_10", rarity: "UNCOMMON", points: 30 },
  { code: "FIFTY_TASKS", name: "Unstoppable", description: "Completed 50 tasks", category: "TASK", requirement: "TASK_COMPLETED_50", rarity: "EPIC", points: 100 },
  { code: "FIRST_MOVE", name: "Mover", description: "Created your first moving plan", category: "MOVING", requirement: "MOVE_COUNT_1", rarity: "COMMON", points: 20 },
  { code: "THREE_MOVES", name: "Veteran Mover", description: "Managed 3 moves", category: "MOVING", requirement: "MOVE_COUNT_3", rarity: "RARE", points: 75 },
  { code: "FIRST_REVIEW", name: "Voice of the Community", description: "Wrote your first review", category: "COMMUNITY", requirement: "REVIEW_COUNT_1", rarity: "COMMON", points: 15 },
  { code: "FIVE_REVIEWS", name: "Trusted Reviewer", description: "Wrote 5 reviews", category: "COMMUNITY", requirement: "REVIEW_COUNT_5", rarity: "UNCOMMON", points: 50 },
  { code: "FIRST_DOCUMENT", name: "Archivist", description: "Uploaded your first document", category: "DOCUMENT", requirement: "DOCUMENT_COUNT_1", rarity: "COMMON", points: 10 },
  { code: "TEN_DOCUMENTS", name: "Filing Pro", description: "Uploaded 10 documents", category: "DOCUMENT", requirement: "DOCUMENT_COUNT_10", rarity: "UNCOMMON", points: 30 },
];

async function main() {
  console.log("Seeding state rules...");
  for (const rule of STATE_RULES) {
    await prisma.stateRule.upsert({
      where: { stateCode: rule.stateCode },
      update: rule,
      create: rule,
    });
  }
  console.log(`  ✓ ${STATE_RULES.length} state rules seeded`);

  console.log("Seeding badges...");
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: badge,
      create: badge,
    });
  }
  console.log(`  ✓ ${BADGES.length} badges seeded`);
}

main()
  .then(() => console.log("✅ Seed complete"))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
