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
// FEDERAL GOVERNMENT AGENCIES
// ============================================================
const FEDERAL_GOV: P[] = [
  // ── Tax & Revenue ──
  { name: "IRS (Internal Revenue Service)", slug: "irs", category: "GOVERNMENT_TAX", description: "Federal tax administration — address change, tax returns, refunds", website: "https://www.irs.gov", phone: "1-800-829-1040", scope: "FEDERAL", popularityScore: 98, tags: ["tax", "government", "essential"] },

  // ── Mail & Postal ──
  { name: "USPS (US Postal Service)", slug: "usps", category: "GOVERNMENT_POSTAL", description: "Mail forwarding, address change, PO boxes", website: "https://www.usps.com", phone: "1-800-275-8777", scope: "FEDERAL", popularityScore: 99, tags: ["mail", "government", "essential"] },
  { name: "UPS", slug: "ups", category: "GOVERNMENT_POSTAL", description: "Package delivery and shipping", website: "https://www.ups.com", phone: "1-800-742-5877", scope: "FEDERAL", popularityScore: 85, tags: ["mail", "shipping"] },
  { name: "FedEx", slug: "fedex", category: "GOVERNMENT_POSTAL", description: "Express shipping and delivery", website: "https://www.fedex.com", phone: "1-800-463-3339", scope: "FEDERAL", popularityScore: 85, tags: ["mail", "shipping"] },

  // ── Immigration ──
  { name: "USCIS (US Citizenship & Immigration)", slug: "uscis", category: "GOVERNMENT_IMMIGRATION", description: "Immigration services — green card, citizenship, visa", website: "https://www.uscis.gov", phone: "1-800-375-5283", scope: "FEDERAL", popularityScore: 92, tags: ["immigration", "government", "essential"] },

  // ── Social Security ──
  { name: "SSA (Social Security Administration)", slug: "ssa", category: "GOVERNMENT_BENEFITS", description: "Social Security cards, benefits, retirement", website: "https://www.ssa.gov", phone: "1-800-772-1213", scope: "FEDERAL", popularityScore: 95, tags: ["social-security", "government", "essential", "senior"] },

  // ── Veterans ──
  { name: "VA (Department of Veterans Affairs)", slug: "va", category: "GOVERNMENT_BENEFITS", description: "Veteran benefits, healthcare, disability", website: "https://www.va.gov", phone: "1-800-827-1000", scope: "FEDERAL", popularityScore: 88, tags: ["veterans", "government", "military"] },

  // ── Emergency ──
  { name: "FEMA", slug: "fema", category: "GOVERNMENT_EMERGENCY", description: "Federal Emergency Management Agency", website: "https://www.fema.gov", phone: "1-800-621-3362", scope: "FEDERAL", popularityScore: 78, tags: ["emergency", "government"] },

  // ── Health ──
  { name: "Medicare.gov", slug: "medicare-gov", category: "GOVERNMENT_HEALTH", description: "Federal health insurance for 65+ and disabled", website: "https://www.medicare.gov", phone: "1-800-633-4227", scope: "FEDERAL", popularityScore: 92, tags: ["health", "government", "senior", "essential"] },
  { name: "Medicaid.gov", slug: "medicaid-gov", category: "GOVERNMENT_HEALTH", description: "Health coverage for low-income individuals", website: "https://www.medicaid.gov", phone: "1-877-267-2323", scope: "FEDERAL", popularityScore: 88, tags: ["health", "government", "essential"] },
  { name: "Healthcare.gov", slug: "healthcare-gov", category: "GOVERNMENT_HEALTH", description: "Health Insurance Marketplace (ACA/Obamacare)", website: "https://www.healthcare.gov", phone: "1-800-318-2596", scope: "FEDERAL", popularityScore: 90, tags: ["health", "government", "essential"] },

  // ── Education ──
  { name: "Federal Student Aid (FAFSA)", slug: "fafsa", category: "GOVERNMENT_EDUCATION", description: "Federal student loans and financial aid", website: "https://studentaid.gov", phone: "1-800-433-3243", scope: "FEDERAL", popularityScore: 85, tags: ["education", "government", "loan"] },
  { name: "Department of Education", slug: "ed-gov", category: "GOVERNMENT_EDUCATION", description: "Federal education policies and programs", website: "https://www.ed.gov", phone: "1-800-872-5327", scope: "FEDERAL", popularityScore: 72, tags: ["education", "government"] },

  // ── Voter Registration ──
  { name: "Vote.gov", slug: "vote-gov", category: "GOVERNMENT_VOTER", description: "Voter registration and election info", website: "https://www.vote.gov", scope: "FEDERAL", popularityScore: 82, tags: ["voter", "government", "essential"] },

  // ── Selective Service ──
  { name: "Selective Service System", slug: "sss", category: "GOVERNMENT_OTHER", description: "Military draft registration (required for males 18-25)", website: "https://www.sss.gov", phone: "1-888-655-1825", scope: "FEDERAL", popularityScore: 60, tags: ["military", "government"] },

  // ── Passport ──
  { name: "US Passport Services (State Dept)", slug: "us-passport", category: "GOVERNMENT_ID", description: "Passport applications, renewals, name changes", website: "https://travel.state.gov/passport", phone: "1-877-487-2778", scope: "FEDERAL", popularityScore: 90, tags: ["passport", "government", "essential", "id"] },

  // ── Homeland Security ──
  { name: "TSA (Transportation Security)", slug: "tsa", category: "GOVERNMENT_OTHER", description: "TSA PreCheck, Global Entry, airport security", website: "https://www.tsa.gov", phone: "1-866-289-9673", scope: "FEDERAL", popularityScore: 75, tags: ["travel", "government"] },
  { name: "CBP (Customs & Border Protection)", slug: "cbp", category: "GOVERNMENT_OTHER", description: "Global Entry, NEXUS, customs declarations", website: "https://www.cbp.gov", phone: "1-877-227-5511", scope: "FEDERAL", popularityScore: 72, tags: ["travel", "government", "immigration"] },

  // ── Consumer Protection ──
  { name: "FTC (Federal Trade Commission)", slug: "ftc", category: "GOVERNMENT_OTHER", description: "Consumer protection, identity theft reporting", website: "https://www.ftc.gov", phone: "1-877-382-4357", scope: "FEDERAL", popularityScore: 68, tags: ["consumer", "government"] },

  // ── Small Business ──
  { name: "SBA (Small Business Administration)", slug: "sba", category: "GOVERNMENT_OTHER", description: "Small business loans, grants, resources", website: "https://www.sba.gov", phone: "1-800-827-5722", scope: "FEDERAL", popularityScore: 72, tags: ["business", "government", "loan"] },

  // ── Housing ──
  { name: "HUD (Housing & Urban Development)", slug: "hud", category: "GOVERNMENT_HOUSING", description: "Fair housing, FHA loans, rental assistance", website: "https://www.hud.gov", phone: "1-800-569-4287", scope: "FEDERAL", popularityScore: 75, tags: ["housing", "government"] },

  // ── Labor ──
  { name: "Department of Labor", slug: "dol", category: "GOVERNMENT_OTHER", description: "Employment laws, unemployment insurance, worker rights", website: "https://www.dol.gov", phone: "1-866-487-2365", scope: "FEDERAL", popularityScore: 72, tags: ["employment", "government"] },
  { name: "OSHA", slug: "osha", category: "GOVERNMENT_OTHER", description: "Workplace safety and health", website: "https://www.osha.gov", phone: "1-800-321-6742", scope: "FEDERAL", popularityScore: 62, tags: ["employment", "government"] },

  // ── Environment ──
  { name: "EPA (Environmental Protection Agency)", slug: "epa", category: "GOVERNMENT_OTHER", description: "Environmental regulations, water quality, air quality", website: "https://www.epa.gov", phone: "1-202-564-4700", scope: "FEDERAL", popularityScore: 65, tags: ["environment", "government"] },
];

// ============================================================
// STATE-LEVEL GOVERNMENT AGENCIES (DMV, Courts, etc.)
// ============================================================
const STATE_GOV: P[] = [
  // ── DMV / Motor Vehicle ──
  { name: "Alabama DMV", slug: "al-dmv", category: "GOVERNMENT_DMV", description: "Driver license and vehicle registration", website: "https://www.alea.gov", scope: "STATE", states: ["AL"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Alaska DMV", slug: "ak-dmv", category: "GOVERNMENT_DMV", description: "Driver license and vehicle registration", website: "https://doa.alaska.gov/dmv", scope: "STATE", states: ["AK"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Arizona MVD", slug: "az-mvd", category: "GOVERNMENT_DMV", description: "Motor Vehicle Division", website: "https://azdot.gov/mvd", scope: "STATE", states: ["AZ"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Arkansas DFA", slug: "ar-dfa", category: "GOVERNMENT_DMV", description: "Driver Services", website: "https://www.dfa.arkansas.gov", scope: "STATE", states: ["AR"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "California DMV", slug: "ca-dmv", category: "GOVERNMENT_DMV", description: "Driver license and vehicle registration", website: "https://www.dmv.ca.gov", phone: "1-800-777-0133", scope: "STATE", states: ["CA"], popularityScore: 95, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Colorado DMV", slug: "co-dmv", category: "GOVERNMENT_DMV", description: "Division of Motor Vehicles", website: "https://dmv.colorado.gov", scope: "STATE", states: ["CO"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Connecticut DMV", slug: "ct-dmv", category: "GOVERNMENT_DMV", description: "Department of Motor Vehicles", website: "https://portal.ct.gov/dmv", scope: "STATE", states: ["CT"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Delaware DMV", slug: "de-dmv", category: "GOVERNMENT_DMV", description: "Division of Motor Vehicles", website: "https://www.dmv.de.gov", scope: "STATE", states: ["DE"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "DC DMV", slug: "dc-dmv", category: "GOVERNMENT_DMV", description: "DC Department of Motor Vehicles", website: "https://dmv.dc.gov", scope: "STATE", states: ["DC"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Florida DHSMV", slug: "fl-dmv", category: "GOVERNMENT_DMV", description: "Highway Safety and Motor Vehicles", website: "https://www.flhsmv.gov", scope: "STATE", states: ["FL"], popularityScore: 92, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Georgia DDS", slug: "ga-dds", category: "GOVERNMENT_DMV", description: "Department of Driver Services", website: "https://dds.georgia.gov", scope: "STATE", states: ["GA"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Hawaii DMV", slug: "hi-dmv", category: "GOVERNMENT_DMV", description: "County DMV offices", website: "https://hidot.hawaii.gov", scope: "STATE", states: ["HI"], popularityScore: 88, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Idaho DMV (ITD)", slug: "id-dmv", category: "GOVERNMENT_DMV", description: "Transportation Department DMV", website: "https://itd.idaho.gov/dmv", scope: "STATE", states: ["ID"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Illinois Secretary of State", slug: "il-sos", category: "GOVERNMENT_DMV", description: "Driver services and vehicle registration", website: "https://www.ilsos.gov", phone: "1-800-252-8980", scope: "STATE", states: ["IL"], popularityScore: 92, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Indiana BMV", slug: "in-bmv", category: "GOVERNMENT_DMV", description: "Bureau of Motor Vehicles", website: "https://www.in.gov/bmv", scope: "STATE", states: ["IN"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Iowa DOT", slug: "ia-dot", category: "GOVERNMENT_DMV", description: "Motor Vehicle Division", website: "https://iowadot.gov/mvd", scope: "STATE", states: ["IA"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Kansas DMV", slug: "ks-dmv", category: "GOVERNMENT_DMV", description: "Division of Vehicles", website: "https://www.ksrevenue.gov/dovindex.html", scope: "STATE", states: ["KS"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Kentucky DMV (KYTC)", slug: "ky-dmv", category: "GOVERNMENT_DMV", description: "Division of Driver Licensing", website: "https://drive.ky.gov", scope: "STATE", states: ["KY"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Louisiana OMV", slug: "la-omv", category: "GOVERNMENT_DMV", description: "Office of Motor Vehicles", website: "https://expresslane.org", scope: "STATE", states: ["LA"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Maine BMV", slug: "me-bmv", category: "GOVERNMENT_DMV", description: "Bureau of Motor Vehicles", website: "https://www.maine.gov/sos/bmv", scope: "STATE", states: ["ME"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Maryland MVA", slug: "md-mva", category: "GOVERNMENT_DMV", description: "Motor Vehicle Administration", website: "https://mva.maryland.gov", scope: "STATE", states: ["MD"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Massachusetts RMV", slug: "ma-rmv", category: "GOVERNMENT_DMV", description: "Registry of Motor Vehicles", website: "https://www.mass.gov/rmv", scope: "STATE", states: ["MA"], popularityScore: 92, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Michigan SOS", slug: "mi-sos", category: "GOVERNMENT_DMV", description: "Secretary of State — driver license", website: "https://www.michigan.gov/sos", scope: "STATE", states: ["MI"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Minnesota DVS", slug: "mn-dvs", category: "GOVERNMENT_DMV", description: "Driver and Vehicle Services", website: "https://dps.mn.gov/dvs", scope: "STATE", states: ["MN"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Mississippi DPS", slug: "ms-dps", category: "GOVERNMENT_DMV", description: "Driver Services Bureau", website: "https://www.dps.ms.gov", scope: "STATE", states: ["MS"], popularityScore: 88, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Missouri DOR", slug: "mo-dor", category: "GOVERNMENT_DMV", description: "Department of Revenue — Motor Vehicle", website: "https://dor.mo.gov/motor-vehicle", scope: "STATE", states: ["MO"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Montana MVD", slug: "mt-mvd", category: "GOVERNMENT_DMV", description: "Motor Vehicle Division", website: "https://dojmt.gov/driving", scope: "STATE", states: ["MT"], popularityScore: 88, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Nebraska DMV", slug: "ne-dmv", category: "GOVERNMENT_DMV", description: "Department of Motor Vehicles", website: "https://dmv.nebraska.gov", scope: "STATE", states: ["NE"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Nevada DMV", slug: "nv-dmv", category: "GOVERNMENT_DMV", description: "Department of Motor Vehicles", website: "https://dmvnv.com", scope: "STATE", states: ["NV"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "New Hampshire DMV", slug: "nh-dmv", category: "GOVERNMENT_DMV", description: "Division of Motor Vehicles", website: "https://www.dmv.nh.gov", scope: "STATE", states: ["NH"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "New Jersey MVC", slug: "nj-mvc", category: "GOVERNMENT_DMV", description: "Motor Vehicle Commission", website: "https://www.nj.gov/mvc", phone: "1-609-292-6500", scope: "STATE", states: ["NJ"], popularityScore: 92, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "New Mexico MVD", slug: "nm-mvd", category: "GOVERNMENT_DMV", description: "Motor Vehicle Division", website: "https://www.mvd.newmexico.gov", scope: "STATE", states: ["NM"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "New York DMV", slug: "ny-dmv", category: "GOVERNMENT_DMV", description: "Department of Motor Vehicles", website: "https://dmv.ny.gov", phone: "1-518-486-9786", scope: "STATE", states: ["NY"], popularityScore: 95, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "North Carolina DMV", slug: "nc-dmv", category: "GOVERNMENT_DMV", description: "Division of Motor Vehicles", website: "https://www.ncdot.gov/dmv", scope: "STATE", states: ["NC"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "North Dakota DOT", slug: "nd-dot", category: "GOVERNMENT_DMV", description: "Drivers License Division", website: "https://www.dot.nd.gov/divisions/driverslicense", scope: "STATE", states: ["ND"], popularityScore: 88, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Ohio BMV", slug: "oh-bmv", category: "GOVERNMENT_DMV", description: "Bureau of Motor Vehicles", website: "https://bmv.ohio.gov", scope: "STATE", states: ["OH"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Oklahoma DPS", slug: "ok-dps", category: "GOVERNMENT_DMV", description: "Department of Public Safety — Driver License", website: "https://oklahoma.gov/dps", scope: "STATE", states: ["OK"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Oregon DMV", slug: "or-dmv", category: "GOVERNMENT_DMV", description: "Driver and Motor Vehicle Services", website: "https://www.oregon.gov/odot/dmv", scope: "STATE", states: ["OR"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Pennsylvania DMV (PennDOT)", slug: "pa-dmv", category: "GOVERNMENT_DMV", description: "Driver and Vehicle Services", website: "https://www.dmv.pa.gov", scope: "STATE", states: ["PA"], popularityScore: 92, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Rhode Island DMV", slug: "ri-dmv", category: "GOVERNMENT_DMV", description: "Division of Motor Vehicles", website: "https://dmv.ri.gov", scope: "STATE", states: ["RI"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "South Carolina DMV", slug: "sc-dmv", category: "GOVERNMENT_DMV", description: "Department of Motor Vehicles", website: "https://www.scdmvonline.com", scope: "STATE", states: ["SC"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "South Dakota DPS", slug: "sd-dps", category: "GOVERNMENT_DMV", description: "Driver Licensing", website: "https://dps.sd.gov/driver-licensing", scope: "STATE", states: ["SD"], popularityScore: 88, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Tennessee DOR", slug: "tn-dor", category: "GOVERNMENT_DMV", description: "Department of Revenue — Driver Services", website: "https://www.tn.gov/revenue/title-and-registration", scope: "STATE", states: ["TN"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Texas DPS", slug: "tx-dps", category: "GOVERNMENT_DMV", description: "Driver License Division", website: "https://www.dps.texas.gov/section/driver-license", phone: "1-512-424-2600", scope: "STATE", states: ["TX"], popularityScore: 95, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Utah DLD", slug: "ut-dld", category: "GOVERNMENT_DMV", description: "Driver License Division", website: "https://dld.utah.gov", scope: "STATE", states: ["UT"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Vermont DMV", slug: "vt-dmv", category: "GOVERNMENT_DMV", description: "Department of Motor Vehicles", website: "https://dmv.vermont.gov", scope: "STATE", states: ["VT"], popularityScore: 88, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Virginia DMV", slug: "va-dmv", category: "GOVERNMENT_DMV", description: "Department of Motor Vehicles", website: "https://www.dmv.virginia.gov", scope: "STATE", states: ["VA"], popularityScore: 92, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Washington DOL", slug: "wa-dol", category: "GOVERNMENT_DMV", description: "Department of Licensing", website: "https://www.dol.wa.gov", scope: "STATE", states: ["WA"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "West Virginia DMV", slug: "wv-dmv", category: "GOVERNMENT_DMV", description: "Division of Motor Vehicles", website: "https://transportation.wv.gov/dmv", scope: "STATE", states: ["WV"], popularityScore: 88, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Wisconsin DMV", slug: "wi-dmv", category: "GOVERNMENT_DMV", description: "Division of Motor Vehicles", website: "https://wisconsindot.gov/pages/dmv", scope: "STATE", states: ["WI"], popularityScore: 90, tags: ["dmv", "government", "car", "essential", "id"] },
  { name: "Wyoming DMV (WYDOT)", slug: "wy-dmv", category: "GOVERNMENT_DMV", description: "Driver Services", website: "https://www.dot.state.wy.us", scope: "STATE", states: ["WY"], popularityScore: 88, tags: ["dmv", "government", "car", "essential", "id"] },

  // ── State Tax Agencies ──
  { name: "California FTB", slug: "ca-ftb", category: "GOVERNMENT_TAX", description: "Franchise Tax Board — state income tax", website: "https://www.ftb.ca.gov", phone: "1-800-852-5711", scope: "STATE", states: ["CA"], popularityScore: 88, tags: ["tax", "government"] },
  { name: "New York Tax (DTF)", slug: "ny-dtf", category: "GOVERNMENT_TAX", description: "Department of Taxation and Finance", website: "https://www.tax.ny.gov", phone: "1-518-457-5181", scope: "STATE", states: ["NY"], popularityScore: 85, tags: ["tax", "government"] },
  { name: "Texas Comptroller", slug: "tx-comptroller", category: "GOVERNMENT_TAX", description: "Texas tax information (no state income tax)", website: "https://comptroller.texas.gov", scope: "STATE", states: ["TX"], popularityScore: 82, tags: ["tax", "government"] },
  { name: "New Jersey Division of Taxation", slug: "nj-tax", category: "GOVERNMENT_TAX", description: "NJ state income tax", website: "https://www.nj.gov/treasury/taxation", scope: "STATE", states: ["NJ"], popularityScore: 85, tags: ["tax", "government"] },
  { name: "Florida DOR", slug: "fl-dor", category: "GOVERNMENT_TAX", description: "Department of Revenue (no state income tax)", website: "https://floridarevenue.com", scope: "STATE", states: ["FL"], popularityScore: 80, tags: ["tax", "government"] },
  { name: "Illinois DOR", slug: "il-dor", category: "GOVERNMENT_TAX", description: "Department of Revenue — state taxes", website: "https://www2.illinois.gov/rev", scope: "STATE", states: ["IL"], popularityScore: 82, tags: ["tax", "government"] },
  { name: "Pennsylvania DOR", slug: "pa-dor", category: "GOVERNMENT_TAX", description: "Department of Revenue — state taxes", website: "https://www.revenue.pa.gov", scope: "STATE", states: ["PA"], popularityScore: 82, tags: ["tax", "government"] },
];

// ============================================================
// RUN SEED
// ============================================================
async function main() {
  console.log("Seeding government agencies...");

  const all = [...FEDERAL_GOV, ...STATE_GOV];
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

  console.log(`\nGovernment seed done!`);
  console.log(`Created: ${created}, Skipped: ${skipped}`);
  console.log(`Providers in this file: ${all.length}`);

  const total = await prisma.serviceProvider.count();
  console.log(`Total providers in DB: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
