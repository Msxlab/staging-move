import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface P {
  name: string;
  slug: string;
  category: string;
  subCategory?: string;
  description?: string;
  website?: string;
  phone?: string;
  scope: "FEDERAL" | "STATE";
  states?: string[];
  tags?: string[];
  popularityScore?: number;
}

// ============================================================
// PHASE 2: FILLING CATEGORY GAPS & PROFILE-RELEVANT PROVIDERS
// Focus: pet, kids, senior, storage, moving, home services,
//        auto, disability, motorcycle, boat/RV
// ============================================================

const FEDERAL_NEW: P[] = [
  // ── PET SERVICES (expanding beyond vet) ──
  { name: "Rover", slug: "rover", category: "SHOPPING_SUBSCRIPTION", description: "Dog walking, pet sitting marketplace", website: "https://www.rover.com", scope: "FEDERAL", popularityScore: 78, tags: ["pet", "dog", "cat", "subscription"] },
  { name: "Wag!", slug: "wag", category: "SHOPPING_SUBSCRIPTION", description: "On-demand dog walking and pet care", website: "https://www.wagwalking.com", scope: "FEDERAL", popularityScore: 68, tags: ["pet", "dog"] },
  { name: "Trupanion", slug: "trupanion", category: "FINANCIAL_INSURANCE_PET", description: "Medical insurance for cats and dogs", website: "https://www.trupanion.com", phone: "1-855-591-3100", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Healthy Paws", slug: "healthy-paws", category: "FINANCIAL_INSURANCE_PET", description: "Pet health insurance", website: "https://www.healthypawspetinsurance.com", scope: "FEDERAL", popularityScore: 70, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Embrace Pet Insurance", slug: "embrace-pet", category: "FINANCIAL_INSURANCE_PET", description: "Personalized pet insurance plans", website: "https://www.embracepetinsurance.com", phone: "1-800-511-9172", scope: "FEDERAL", popularityScore: 65, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Nationwide Pet Insurance", slug: "nationwide-pet", category: "FINANCIAL_INSURANCE_PET", description: "Pet insurance by Nationwide", website: "https://www.petinsurance.com", scope: "FEDERAL", popularityScore: 68, tags: ["pet", "insurance", "dog", "cat"] },

  // ── CHILDCARE & EDUCATION ──
  { name: "Care.com", slug: "care-com", category: "KIDS_DAYCARE", description: "Find babysitters, nannies, and daycares", website: "https://www.care.com", scope: "FEDERAL", popularityScore: 85, tags: ["kids", "daycare", "children", "senior"] },
  { name: "Sittercity", slug: "sittercity", category: "KIDS_DAYCARE", description: "Babysitter and nanny finder", website: "https://www.sittercity.com", scope: "FEDERAL", popularityScore: 68, tags: ["kids", "daycare", "children"] },
  { name: "ABCmouse", slug: "abcmouse", category: "KIDS_ACTIVITY", description: "Early learning academy for ages 2-8", website: "https://www.abcmouse.com", scope: "FEDERAL", popularityScore: 72, tags: ["kids", "education", "children"] },
  { name: "Tutor.com", slug: "tutor-com", category: "KIDS_ACTIVITY", description: "Online tutoring for all ages", website: "https://www.tutor.com", scope: "FEDERAL", popularityScore: 65, tags: ["kids", "education", "children"] },
  { name: "Sylvan Learning", slug: "sylvan", category: "KIDS_ACTIVITY", description: "Tutoring and learning centers", website: "https://www.sylvanlearning.com", phone: "1-888-338-2283", scope: "FEDERAL", popularityScore: 70, tags: ["kids", "education", "children"] },

  // ── HOME SERVICES ──
  { name: "Angi (Angie's List)", slug: "angi", category: "HOUSING_HOME_SERVICE", description: "Find local home service professionals", website: "https://www.angi.com", scope: "FEDERAL", popularityScore: 82, tags: ["home"] },
  { name: "TaskRabbit", slug: "taskrabbit", category: "HOUSING_HOME_SERVICE", description: "Hire people for odd jobs and tasks", website: "https://www.taskrabbit.com", scope: "FEDERAL", popularityScore: 78, tags: ["home"] },
  { name: "Thumbtack", slug: "thumbtack", category: "HOUSING_HOME_SERVICE", description: "Local professionals for any project", website: "https://www.thumbtack.com", scope: "FEDERAL", popularityScore: 75, tags: ["home"] },
  { name: "ADT Security", slug: "adt", category: "HOUSING_HOME_SERVICE", description: "Home security and alarm systems", website: "https://www.adt.com", phone: "1-800-716-3640", scope: "FEDERAL", popularityScore: 85, tags: ["home", "security"] },
  { name: "SimpliSafe", slug: "simplisafe", category: "HOUSING_HOME_SERVICE", description: "DIY home security systems", website: "https://www.simplisafe.com", scope: "FEDERAL", popularityScore: 78, tags: ["home", "security"] },
  { name: "Ring", slug: "ring-security", category: "HOUSING_HOME_SERVICE", description: "Video doorbells and home security", website: "https://www.ring.com", scope: "FEDERAL", popularityScore: 82, tags: ["home", "security"] },
  { name: "Vivint Smart Home", slug: "vivint", category: "HOUSING_HOME_SERVICE", description: "Smart home security and automation", website: "https://www.vivint.com", phone: "1-855-832-1550", scope: "FEDERAL", popularityScore: 72, tags: ["home", "security"] },
  { name: "Stanley Steemer", slug: "stanley-steemer", category: "HOUSING_HOME_SERVICE", description: "Carpet and floor cleaning services", website: "https://www.stanleysteemer.com", phone: "1-800-783-3637", scope: "FEDERAL", popularityScore: 70, tags: ["home"] },

  // ── AUTO SERVICES ──
  { name: "AAA (American Automobile Association)", slug: "aaa", category: "TRANSPORTATION_AUTO", description: "Roadside assistance, insurance, travel", website: "https://www.aaa.com", scope: "FEDERAL", popularityScore: 92, tags: ["car", "auto", "insurance", "driving"] },
  { name: "Jiffy Lube", slug: "jiffy-lube", category: "TRANSPORTATION_AUTO", description: "Oil change and auto maintenance", website: "https://www.jiffylube.com", scope: "FEDERAL", popularityScore: 78, tags: ["car", "auto"] },
  { name: "Safelite AutoGlass", slug: "safelite", category: "TRANSPORTATION_AUTO", description: "Windshield repair and replacement", website: "https://www.safelite.com", phone: "1-800-800-2727", scope: "FEDERAL", popularityScore: 80, tags: ["car", "auto"] },
  { name: "Midas", slug: "midas", category: "TRANSPORTATION_AUTO", description: "Auto repair and maintenance", website: "https://www.midas.com", scope: "FEDERAL", popularityScore: 72, tags: ["car", "auto"] },
  { name: "Firestone Complete Auto Care", slug: "firestone", category: "TRANSPORTATION_AUTO", description: "Tires and auto repair", website: "https://www.firestonecompleteautocare.com", scope: "FEDERAL", popularityScore: 78, tags: ["car", "auto"] },
  { name: "Pep Boys", slug: "pep-boys", category: "TRANSPORTATION_AUTO", description: "Auto parts, service and tires", website: "https://www.pepboys.com", scope: "FEDERAL", popularityScore: 70, tags: ["car", "auto"] },
  { name: "Valvoline Instant Oil Change", slug: "valvoline", category: "TRANSPORTATION_AUTO", description: "Quick oil change services", website: "https://www.vioc.com", scope: "FEDERAL", popularityScore: 75, tags: ["car", "auto"] },

  // ── MOTORCYCLE SERVICES ──
  { name: "Progressive Motorcycle Insurance", slug: "progressive-motorcycle", category: "FINANCIAL_INSURANCE_MOTORCYCLE", description: "#1 motorcycle insurance in the US", website: "https://www.progressive.com/motorcycle", scope: "FEDERAL", popularityScore: 88, tags: ["motorcycle", "insurance"] },
  { name: "GEICO Motorcycle Insurance", slug: "geico-motorcycle", category: "FINANCIAL_INSURANCE_MOTORCYCLE", description: "Motorcycle insurance by GEICO", website: "https://www.geico.com/motorcycle-insurance", scope: "FEDERAL", popularityScore: 85, tags: ["motorcycle", "insurance"] },
  { name: "Dairyland Motorcycle Insurance", slug: "dairyland-motorcycle", category: "FINANCIAL_INSURANCE_MOTORCYCLE", description: "Affordable motorcycle coverage", website: "https://www.dairylandinsurance.com", scope: "FEDERAL", popularityScore: 62, tags: ["motorcycle", "insurance"] },
  { name: "Cycle Trader", slug: "cycle-trader", category: "TRANSPORTATION_AUTO", description: "Buy and sell motorcycles", website: "https://www.cycletrader.com", scope: "FEDERAL", popularityScore: 68, tags: ["motorcycle"] },

  // ── BOAT / RV SERVICES ──
  { name: "Good Sam Club", slug: "good-sam", category: "SHOPPING_SUBSCRIPTION", description: "RV roadside assistance and campground discounts", website: "https://www.goodsam.com", scope: "FEDERAL", popularityScore: 75, tags: ["rv", "boat", "subscription"] },
  { name: "Progressive Boat Insurance", slug: "progressive-boat", category: "FINANCIAL_INSURANCE_BOAT", description: "#1 boat insurance in the US", website: "https://www.progressive.com/boat", scope: "FEDERAL", popularityScore: 82, tags: ["boat", "insurance"] },
  { name: "GEICO Boat Insurance", slug: "geico-boat", category: "FINANCIAL_INSURANCE_BOAT", description: "Boat and watercraft insurance", website: "https://www.geico.com/boat-insurance", scope: "FEDERAL", popularityScore: 78, tags: ["boat", "insurance"] },
  { name: "National General RV Insurance", slug: "natgen-rv", category: "FINANCIAL_INSURANCE_RV", description: "RV and motorhome insurance", website: "https://www.nationalgeneral.com/rv-insurance", scope: "FEDERAL", popularityScore: 70, tags: ["rv", "insurance"] },
  { name: "Camping World", slug: "camping-world", category: "SHOPPING_RETAIL", description: "RV parts, accessories and service", website: "https://www.campingworld.com", phone: "1-888-626-7576", scope: "FEDERAL", popularityScore: 78, tags: ["rv", "boat", "shopping"] },
  { name: "Boat Trader", slug: "boat-trader", category: "SHOPPING_RETAIL", description: "Buy and sell boats", website: "https://www.boattrader.com", scope: "FEDERAL", popularityScore: 68, tags: ["boat"] },

  // ── SENIOR SERVICES ──
  { name: "Visiting Angels", slug: "visiting-angels", category: "HEALTHCARE_SENIOR", description: "In-home senior care services", website: "https://www.visitingangels.com", phone: "1-800-365-4189", scope: "FEDERAL", popularityScore: 78, tags: ["senior"] },
  { name: "Home Instead", slug: "home-instead", category: "HEALTHCARE_SENIOR", description: "Personalized in-home senior care", website: "https://www.homeinstead.com", phone: "1-888-484-5759", scope: "FEDERAL", popularityScore: 80, tags: ["senior"] },
  { name: "Comfort Keepers", slug: "comfort-keepers", category: "HEALTHCARE_SENIOR", description: "Senior care and companionship", website: "https://www.comfortkeepers.com", phone: "1-888-963-4913", scope: "FEDERAL", popularityScore: 72, tags: ["senior"] },
  { name: "SilverSneakers", slug: "silversneakers", category: "FITNESS_GYM", description: "Fitness program for seniors 65+", website: "https://www.silversneakers.com", scope: "FEDERAL", popularityScore: 75, tags: ["senior", "fitness"] },
  { name: "Meals on Wheels", slug: "meals-on-wheels", category: "HEALTHCARE_SENIOR", description: "Home-delivered meals for seniors", website: "https://www.mealsonwheelsamerica.org", scope: "FEDERAL", popularityScore: 82, tags: ["senior"] },
  { name: "A Place for Mom", slug: "a-place-for-mom", category: "HEALTHCARE_SENIOR", description: "Senior living referral service", website: "https://www.aplaceformom.com", phone: "1-800-180-3242", scope: "FEDERAL", popularityScore: 75, tags: ["senior"] },

  // ── MOVING SERVICES ──
  { name: "Two Men and a Truck", slug: "two-men-truck", category: "HOUSING_MOVING", description: "Full-service moving company", website: "https://www.twomenandatruck.com", phone: "1-800-345-1070", scope: "FEDERAL", popularityScore: 80, tags: ["home", "storage"] },
  { name: "United Van Lines", slug: "united-van-lines", category: "HOUSING_MOVING", description: "Long-distance moving services", website: "https://www.unitedvanlines.com", phone: "1-877-740-0312", scope: "FEDERAL", popularityScore: 82, tags: ["home", "storage"] },
  { name: "Penske Truck Rental", slug: "penske", category: "HOUSING_MOVING", description: "Truck rental for DIY moves", website: "https://www.pensketruckrental.com", phone: "1-888-996-5415", scope: "FEDERAL", popularityScore: 78, tags: ["home", "storage", "car"] },
  { name: "Budget Truck Rental", slug: "budget-truck", category: "HOUSING_MOVING", description: "Affordable moving truck rental", website: "https://www.budgettruck.com", phone: "1-800-462-8343", scope: "FEDERAL", popularityScore: 72, tags: ["home", "storage", "car"] },
  { name: "U-Pack", slug: "upack", category: "HOUSING_MOVING", description: "You pack, we drive moving service", website: "https://www.upack.com", phone: "1-800-413-4799", scope: "FEDERAL", popularityScore: 68, tags: ["home", "storage"] },
  { name: "Mayflower Moving", slug: "mayflower", category: "HOUSING_MOVING", description: "Full-service interstate moving", website: "https://www.mayflower.com", phone: "1-877-720-4498", scope: "FEDERAL", popularityScore: 75, tags: ["home", "storage"] },
  { name: "Allied Van Lines", slug: "allied-van", category: "HOUSING_MOVING", description: "Residential and commercial moving", website: "https://www.allied.com", phone: "1-800-689-8684", scope: "FEDERAL", popularityScore: 72, tags: ["home", "storage"] },

  // ── REAL ESTATE ──
  { name: "Opendoor", slug: "opendoor", category: "HOUSING_REAL_ESTATE", description: "Buy and sell homes simply", website: "https://www.opendoor.com", scope: "FEDERAL", popularityScore: 78, tags: ["home"] },
  { name: "Zillow (Buy/Sell)", slug: "zillow-buy", category: "HOUSING_REAL_ESTATE", description: "Real estate listings and Zestimates", website: "https://www.zillow.com", scope: "FEDERAL", popularityScore: 92, tags: ["home"] },
  { name: "Redfin", slug: "redfin", category: "HOUSING_REAL_ESTATE", description: "Real estate brokerage with low fees", website: "https://www.redfin.com", scope: "FEDERAL", popularityScore: 85, tags: ["home"] },
  { name: "Realtor.com", slug: "realtor-com", category: "HOUSING_REAL_ESTATE", description: "Find homes for sale", website: "https://www.realtor.com", scope: "FEDERAL", popularityScore: 82, tags: ["home"] },
  { name: "Offerpad", slug: "offerpad", category: "HOUSING_REAL_ESTATE", description: "iBuyer: instant cash home offers", website: "https://www.offerpad.com", scope: "FEDERAL", popularityScore: 62, tags: ["home"] },

  // ── INSURANCE (GAP FILLING) ──
  { name: "Lemonade Insurance", slug: "lemonade", category: "FINANCIAL_INSURANCE_HOME", description: "AI-powered home and renters insurance", website: "https://www.lemonade.com", scope: "FEDERAL", popularityScore: 75, tags: ["home", "insurance"] },
  { name: "MetLife Home Insurance", slug: "metlife-home", category: "FINANCIAL_INSURANCE_HOME", description: "Home and property insurance", website: "https://www.metlife.com", scope: "FEDERAL", popularityScore: 78, tags: ["home", "insurance"] },
  { name: "Prudential Life Insurance", slug: "prudential", category: "FINANCIAL_INSURANCE_LIFE", description: "Life insurance and financial planning", website: "https://www.prudential.com", phone: "1-800-778-2255", scope: "FEDERAL", popularityScore: 82, tags: ["insurance", "senior"] },
  { name: "NFIP (Flood Insurance)", slug: "nfip-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "National Flood Insurance Program", website: "https://www.floodsmart.gov", scope: "FEDERAL", popularityScore: 70, tags: ["home", "insurance"] },

  // ── DISABILITY SERVICES ──
  { name: "SSA Disability (SSDI)", slug: "ssa-disability", category: "GOVERNMENT_BENEFITS", description: "Social Security Disability Insurance", website: "https://www.ssa.gov/disability", phone: "1-800-772-1213", scope: "FEDERAL", popularityScore: 88, tags: ["disability", "government", "essential"] },
  { name: "ADA National Network", slug: "ada-network", category: "GOVERNMENT_BENEFITS", description: "Americans with Disabilities Act info", website: "https://adata.org", phone: "1-800-949-4232", scope: "FEDERAL", popularityScore: 72, tags: ["disability", "government"] },
  { name: "National Disability Rights Network", slug: "ndrn", category: "GOVERNMENT_BENEFITS", description: "Protection and advocacy for disability rights", website: "https://www.ndrn.org", scope: "FEDERAL", popularityScore: 65, tags: ["disability", "government"] },

  // ── HEALTHCARE (expanded) ──
  { name: "Zocdoc", slug: "zocdoc", category: "HEALTHCARE_DOCTORS", description: "Find and book doctors online", website: "https://www.zocdoc.com", scope: "FEDERAL", popularityScore: 82, tags: ["health"] },
  { name: "Teladoc", slug: "teladoc", category: "HEALTHCARE_DOCTORS", description: "Virtual doctor visits 24/7", website: "https://www.teladoc.com", scope: "FEDERAL", popularityScore: 78, tags: ["health"] },
  { name: "GoodRx", slug: "goodrx", category: "HEALTHCARE_PHARMACY", description: "Prescription drug discounts and coupons", website: "https://www.goodrx.com", scope: "FEDERAL", popularityScore: 85, tags: ["health", "pharmacy"] },
];

// ============================================================
// RUN SEED
// ============================================================
async function main() {
  console.log("Seeding Phase 2 providers (profile-relevant expansions)...");

  const all = [...FEDERAL_NEW];
  let created = 0;
  let skipped = 0;

  for (const p of all) {
    const existing = await prisma.serviceProvider.findUnique({ where: { slug: p.slug } });
    if (existing) { skipped++; continue; }

    await prisma.serviceProvider.create({
      data: {
        name: p.name,
        slug: p.slug,
        category: p.category,
        subCategory: p.subCategory,
        description: p.description,
        website: p.website,
        phone: p.phone,
        scope: p.scope,
        states: JSON.stringify(p.states || []),
        zipCodes: "[]",
        tags: JSON.stringify(p.tags || []),
        popularityScore: p.popularityScore || 50,
        isActive: true,
        displayOrder: 0,
      },
    });
    created++;
  }

  console.log(`\nPhase 2 seed done!`);
  console.log(`Created: ${created}, Skipped (duplicate slug): ${skipped}`);
  console.log(`Providers in this file: ${all.length}`);

  const total = await prisma.serviceProvider.count();
  console.log(`Total providers in DB: ${total}`);

  // Category coverage
  const allRows = await prisma.serviceProvider.findMany({ select: { category: true } });
  const catCount: Record<string, number> = {};
  allRows.forEach((r: { category: string }) => {
    catCount[r.category] = (catCount[r.category] || 0) + 1;
  });
  console.log(`\nCategory coverage after Phase 2:`);
  Object.entries(catCount).sort((a, b) => a[0].localeCompare(b[0])).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
