import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface P {
  name: string;
  slug: string;
  category: string;
  description?: string;
  website?: string;
  phone?: string;
  scope: "STATE";
  states: string[];
  tags?: string[];
  popularityScore?: number;
}

// ============================================================
// REMAINING STATES (not yet seeded)
// Already have: AZ, CA, CO, CT, DC, FL, GA, IL, MA, MD, MI, MN, NC, NH, NJ, NY, OH, PA, SC, TN, TX, VA, WA, WI
// Need: AL, AK, AR, DE, HI, ID, IN, IA, KS, KY, LA, ME, MS, MO, MT, NE, NV, NM, ND, OK, OR, RI, SD, UT, VT, WV, WY
// Also adding more providers for existing states
// ============================================================

const PROVIDERS: P[] = [
  // ── Alabama (AL) ──
  { name: "Alabama Power", slug: "alabama-power", category: "UTILITY_ELECTRIC", description: "Largest electric utility in Alabama", website: "https://www.alabamapower.com", phone: "1-800-245-2244", scope: "STATE", states: ["AL"], popularityScore: 92, tags: ["electric"] },
  { name: "Alagasco", slug: "alagasco", category: "UTILITY_GAS", description: "Alabama gas utility", website: "https://www.alagasco.com", phone: "1-800-292-4008", scope: "STATE", states: ["AL"], popularityScore: 78, tags: ["gas"] },
  { name: "Birmingham Water Works", slug: "bwwb", category: "UTILITY_WATER", description: "Water for Birmingham metro", website: "https://www.bwwb.org", phone: "1-205-244-4000", scope: "STATE", states: ["AL"], popularityScore: 70, tags: ["water"] },
  { name: "BCBS Alabama", slug: "bcbs-al", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Alabama", website: "https://www.bcbsal.org", phone: "1-800-292-8868", scope: "STATE", states: ["AL"], popularityScore: 85, tags: ["health"] },

  // ── Alaska (AK) ──
  { name: "Chugach Electric", slug: "chugach-electric", category: "UTILITY_ELECTRIC", description: "Largest electric utility in Alaska", website: "https://www.chugachelectric.com", phone: "1-907-563-7494", scope: "STATE", states: ["AK"], popularityScore: 85, tags: ["electric"] },
  { name: "ENSTAR Natural Gas", slug: "enstar", category: "UTILITY_GAS", description: "Natural gas for Anchorage area", website: "https://www.enstarnaturalgas.com", phone: "1-907-277-5551", scope: "STATE", states: ["AK"], popularityScore: 78, tags: ["gas"] },
  { name: "Anchorage Water & Wastewater", slug: "awwu", category: "UTILITY_WATER", description: "Water utility for Anchorage", website: "https://www.awwu.biz", scope: "STATE", states: ["AK"], popularityScore: 75, tags: ["water"] },
  { name: "Premera BCBS Alaska", slug: "premera-ak", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Alaska", website: "https://www.prior.premera.com", scope: "STATE", states: ["AK"], popularityScore: 80, tags: ["health"] },

  // ── Arkansas (AR) ──
  { name: "Entergy Arkansas", slug: "entergy-ar", category: "UTILITY_ELECTRIC", description: "Electric utility for Arkansas", website: "https://www.entergy-arkansas.com", phone: "1-800-368-3749", scope: "STATE", states: ["AR"], popularityScore: 88, tags: ["electric"] },
  { name: "CenterPoint Energy AR", slug: "centerpoint-ar", category: "UTILITY_GAS", description: "Natural gas for Arkansas", website: "https://www.centerpointenergy.com", scope: "STATE", states: ["AR"], popularityScore: 75, tags: ["gas"] },
  { name: "Central Arkansas Water", slug: "caw", category: "UTILITY_WATER", description: "Water for Little Rock area", website: "https://www.carkw.com", scope: "STATE", states: ["AR"], popularityScore: 72, tags: ["water"] },
  { name: "Arkansas BCBS", slug: "bcbs-ar", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Arkansas", website: "https://www.arkansasbluecross.com", phone: "1-800-238-8379", scope: "STATE", states: ["AR"], popularityScore: 85, tags: ["health"] },

  // ── Delaware (DE) ──
  { name: "Delmarva Power", slug: "delmarva-power", category: "UTILITY_ELECTRIC", description: "Electric for Delaware and Maryland", website: "https://www.delmarva.com", phone: "1-800-375-7117", scope: "STATE", states: ["DE", "MD"], popularityScore: 85, tags: ["electric"] },
  { name: "Chesapeake Utilities", slug: "chesapeake-util", category: "UTILITY_GAS", description: "Natural gas for Delaware", website: "https://www.chpk.com", scope: "STATE", states: ["DE"], popularityScore: 72, tags: ["gas"] },
  { name: "E-ZPass Delaware", slug: "de-ezpass", category: "TRANSPORTATION_TOLL", description: "Delaware toll pass", website: "https://www.ezpassde.com", scope: "STATE", states: ["DE"], popularityScore: 80, tags: ["toll", "car"] },
  { name: "Highmark BCBS Delaware", slug: "highmark-de", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance for Delaware", website: "https://www.highmarkbcbsde.com", scope: "STATE", states: ["DE"], popularityScore: 82, tags: ["health"] },

  // ── Hawaii (HI) ──
  { name: "Hawaiian Electric (HECO)", slug: "heco", category: "UTILITY_ELECTRIC", description: "Electric utility for Hawaii", website: "https://www.hawaiianelectric.com", phone: "1-808-548-7311", scope: "STATE", states: ["HI"], popularityScore: 92, tags: ["electric"] },
  { name: "Hawaii Gas", slug: "hawaii-gas", category: "UTILITY_GAS", description: "Gas utility for Hawaii", website: "https://www.hawaiigas.com", phone: "1-808-535-5933", scope: "STATE", states: ["HI"], popularityScore: 78, tags: ["gas"] },
  { name: "Board of Water Supply", slug: "honolulu-bws", category: "UTILITY_WATER", description: "Honolulu water utility", website: "https://www.boardofwatersupply.com", scope: "STATE", states: ["HI"], popularityScore: 80, tags: ["water"] },
  { name: "HMSA", slug: "hmsa", category: "FINANCIAL_INSURANCE_HEALTH", description: "Hawaii Medical Service Association", website: "https://www.hmsa.com", phone: "1-808-948-6111", scope: "STATE", states: ["HI"], popularityScore: 90, tags: ["health"] },

  // ── Idaho (ID) ──
  { name: "Idaho Power", slug: "idaho-power", category: "UTILITY_ELECTRIC", description: "Electric utility for southern Idaho", website: "https://www.idahopower.com", phone: "1-800-488-6151", scope: "STATE", states: ["ID"], popularityScore: 88, tags: ["electric"] },
  { name: "Intermountain Gas", slug: "intermountain-gas", category: "UTILITY_GAS", description: "Natural gas for Idaho", website: "https://www.intgas.com", phone: "1-800-548-3679", scope: "STATE", states: ["ID"], popularityScore: 75, tags: ["gas"] },
  { name: "Blue Cross of Idaho", slug: "bcbs-id", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross of Idaho", website: "https://www.bcidaho.com", scope: "STATE", states: ["ID"], popularityScore: 82, tags: ["health"] },

  // ── Indiana (IN) ──
  { name: "Indiana Michigan Power", slug: "imp", category: "UTILITY_ELECTRIC", description: "AEP subsidiary for Indiana", website: "https://www.indianamichiganpower.com", phone: "1-800-311-4634", scope: "STATE", states: ["IN"], popularityScore: 80, tags: ["electric"] },
  { name: "Duke Energy Indiana", slug: "duke-in", category: "UTILITY_ELECTRIC", description: "Electric for central Indiana", website: "https://www.duke-energy.com/indiana", phone: "1-800-521-2232", scope: "STATE", states: ["IN"], popularityScore: 85, tags: ["electric"] },
  { name: "Vectren (CenterPoint)", slug: "vectren", category: "UTILITY_GAS", description: "Natural gas for Indiana", website: "https://www.vectren.com", scope: "STATE", states: ["IN"], popularityScore: 75, tags: ["gas", "electric"] },
  { name: "Indiana American Water", slug: "in-american-water", category: "UTILITY_WATER", description: "Water for Indiana", website: "https://www.amwater.com/inaw", scope: "STATE", states: ["IN"], popularityScore: 72, tags: ["water"] },
  { name: "IndyGo", slug: "indygo", category: "TRANSPORTATION_TRANSIT", description: "Indianapolis public transit", website: "https://www.indygo.net", scope: "STATE", states: ["IN"], popularityScore: 70, tags: ["transit", "bus"] },
  { name: "Anthem BCBS Indiana", slug: "anthem-in", category: "FINANCIAL_INSURANCE_HEALTH", description: "Anthem Blue Cross Indiana", website: "https://www.anthem.com", scope: "STATE", states: ["IN"], popularityScore: 85, tags: ["health"] },

  // ── Iowa (IA) ──
  { name: "MidAmerican Energy", slug: "midamerican", category: "UTILITY_ELECTRIC", description: "Electric and gas for Iowa", website: "https://www.midamericanenergy.com", phone: "1-888-427-5632", scope: "STATE", states: ["IA"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Alliant Energy", slug: "alliant", category: "UTILITY_ELECTRIC", description: "Electric for Iowa and Wisconsin", website: "https://www.alliantenergy.com", phone: "1-800-255-4268", scope: "STATE", states: ["IA", "WI"], popularityScore: 82, tags: ["electric"] },
  { name: "Iowa American Water", slug: "ia-american-water", category: "UTILITY_WATER", description: "Water for Iowa", website: "https://www.amwater.com/iaaw", scope: "STATE", states: ["IA"], popularityScore: 70, tags: ["water"] },
  { name: "Wellmark BCBS", slug: "wellmark", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Iowa", website: "https://www.wellmark.com", phone: "1-800-524-9242", scope: "STATE", states: ["IA", "SD"], popularityScore: 85, tags: ["health"] },

  // ── Kansas (KS) ──
  { name: "Evergy", slug: "evergy", category: "UTILITY_ELECTRIC", description: "Electric for Kansas and Missouri", website: "https://www.evergy.com", phone: "1-888-471-5275", scope: "STATE", states: ["KS", "MO"], popularityScore: 88, tags: ["electric"] },
  { name: "Kansas Gas Service", slug: "kansas-gas", category: "UTILITY_GAS", description: "Natural gas for Kansas", website: "https://www.kansasgasservice.com", phone: "1-800-794-4780", scope: "STATE", states: ["KS"], popularityScore: 78, tags: ["gas"] },
  { name: "BCBS Kansas", slug: "bcbs-ks", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Kansas", website: "https://www.bcbsks.com", scope: "STATE", states: ["KS"], popularityScore: 82, tags: ["health"] },
  { name: "K-TAG", slug: "ktag", category: "TRANSPORTATION_TOLL", description: "Kansas Turnpike toll tag", website: "https://www.ksturnpike.com", scope: "STATE", states: ["KS"], popularityScore: 75, tags: ["toll", "car"] },

  // ── Kentucky (KY) ──
  { name: "Kentucky Utilities", slug: "ky-utilities", category: "UTILITY_ELECTRIC", description: "Electric for Kentucky", website: "https://www.lge-ku.com", phone: "1-800-981-0600", scope: "STATE", states: ["KY"], popularityScore: 85, tags: ["electric"] },
  { name: "Louisville Gas & Electric", slug: "lge", category: "UTILITY_GAS", description: "Gas and electric for Louisville", website: "https://www.lge-ku.com", phone: "1-800-331-7370", scope: "STATE", states: ["KY"], popularityScore: 82, tags: ["gas", "electric"] },
  { name: "Kentucky American Water", slug: "ky-american-water", category: "UTILITY_WATER", description: "Water for Kentucky", website: "https://www.amwater.com/kyaw", scope: "STATE", states: ["KY"], popularityScore: 70, tags: ["water"] },
  { name: "Anthem BCBS Kentucky", slug: "anthem-ky", category: "FINANCIAL_INSURANCE_HEALTH", description: "Anthem Blue Cross Kentucky", website: "https://www.anthem.com", scope: "STATE", states: ["KY"], popularityScore: 82, tags: ["health"] },
  { name: "TARC", slug: "tarc", category: "TRANSPORTATION_TRANSIT", description: "Transit Authority of River City Louisville", website: "https://www.ridetarc.org", scope: "STATE", states: ["KY"], popularityScore: 65, tags: ["transit", "bus"] },

  // ── Louisiana (LA) ──
  { name: "Entergy Louisiana", slug: "entergy-la", category: "UTILITY_ELECTRIC", description: "Electric for Louisiana", website: "https://www.entergy-louisiana.com", phone: "1-800-368-3749", scope: "STATE", states: ["LA"], popularityScore: 90, tags: ["electric"] },
  { name: "Atmos Energy LA", slug: "atmos-la", category: "UTILITY_GAS", description: "Natural gas for Louisiana", website: "https://www.atmosenergy.com", phone: "1-888-286-6700", scope: "STATE", states: ["LA", "TX", "MS", "KY", "TN"], popularityScore: 78, tags: ["gas"] },
  { name: "BCBS Louisiana", slug: "bcbs-la", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Louisiana", website: "https://www.bcbsla.com", phone: "1-800-599-2583", scope: "STATE", states: ["LA"], popularityScore: 85, tags: ["health"] },
  { name: "GeauxPass", slug: "geauxpass", category: "TRANSPORTATION_TOLL", description: "Louisiana toll tag", website: "https://www.geauxpass.com", scope: "STATE", states: ["LA"], popularityScore: 75, tags: ["toll", "car"] },
  { name: "New Orleans RTA", slug: "norta", category: "TRANSPORTATION_TRANSIT", description: "New Orleans transit", website: "https://www.norta.com", scope: "STATE", states: ["LA"], popularityScore: 70, tags: ["transit", "bus"] },

  // ── Maine (ME) ──
  { name: "Central Maine Power", slug: "cmp", category: "UTILITY_ELECTRIC", description: "Electric for Maine", website: "https://www.cmpco.com", phone: "1-800-750-4000", scope: "STATE", states: ["ME"], popularityScore: 88, tags: ["electric"] },
  { name: "Versant Power", slug: "versant", category: "UTILITY_ELECTRIC", description: "Electric for northern Maine", website: "https://www.versantpower.com", scope: "STATE", states: ["ME"], popularityScore: 72, tags: ["electric"] },
  { name: "Maine Natural Gas", slug: "maine-ng", category: "UTILITY_GAS", description: "Natural gas for Maine", website: "https://www.mainenaturalgas.com", scope: "STATE", states: ["ME"], popularityScore: 65, tags: ["gas"] },
  { name: "Anthem BCBS Maine", slug: "anthem-me", category: "FINANCIAL_INSURANCE_HEALTH", description: "Anthem Blue Cross Maine", website: "https://www.anthem.com", scope: "STATE", states: ["ME"], popularityScore: 80, tags: ["health"] },

  // ── Mississippi (MS) ──
  { name: "Mississippi Power", slug: "ms-power", category: "UTILITY_ELECTRIC", description: "Electric for SE Mississippi", website: "https://www.mississippipower.com", phone: "1-800-532-1502", scope: "STATE", states: ["MS"], popularityScore: 82, tags: ["electric"] },
  { name: "Entergy Mississippi", slug: "entergy-ms", category: "UTILITY_ELECTRIC", description: "Electric for Mississippi", website: "https://www.entergy-mississippi.com", scope: "STATE", states: ["MS"], popularityScore: 85, tags: ["electric"] },
  { name: "BCBS Mississippi", slug: "bcbs-ms", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Mississippi", website: "https://www.bcbsms.com", scope: "STATE", states: ["MS"], popularityScore: 85, tags: ["health"] },

  // ── Missouri (MO) ──
  { name: "Ameren Missouri", slug: "ameren-mo", category: "UTILITY_ELECTRIC", description: "Electric and gas for Missouri", website: "https://www.ameren.com", phone: "1-800-552-7583", scope: "STATE", states: ["MO", "IL"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Spire Missouri", slug: "spire-mo", category: "UTILITY_GAS", description: "Natural gas for Missouri", website: "https://www.spireenergy.com", phone: "1-800-887-4173", scope: "STATE", states: ["MO"], popularityScore: 80, tags: ["gas"] },
  { name: "Missouri American Water", slug: "mo-american-water", category: "UTILITY_WATER", description: "Water for Missouri", website: "https://www.amwater.com/moaw", scope: "STATE", states: ["MO"], popularityScore: 72, tags: ["water"] },
  { name: "BCBS Kansas City", slug: "bcbs-kc", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield Kansas City", website: "https://www.bluekc.com", scope: "STATE", states: ["MO", "KS"], popularityScore: 82, tags: ["health"] },
  { name: "Metro Transit STL", slug: "metro-stl", category: "TRANSPORTATION_TRANSIT", description: "St. Louis Metro Transit", website: "https://www.metrostlouis.org", scope: "STATE", states: ["MO"], popularityScore: 72, tags: ["transit", "bus", "train"] },

  // ── Montana (MT) ──
  { name: "NorthWestern Energy", slug: "northwestern-mt", category: "UTILITY_ELECTRIC", description: "Electric and gas for Montana", website: "https://www.northwesternenergy.com", phone: "1-888-467-2669", scope: "STATE", states: ["MT", "SD", "NE"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "BCBS Montana", slug: "bcbs-mt", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Montana", website: "https://www.bcbsmt.com", scope: "STATE", states: ["MT"], popularityScore: 80, tags: ["health"] },

  // ── Nebraska (NE) ──
  { name: "OPPD", slug: "oppd", category: "UTILITY_ELECTRIC", description: "Omaha Public Power District", website: "https://www.oppd.com", phone: "1-402-536-4131", scope: "STATE", states: ["NE"], popularityScore: 88, tags: ["electric"] },
  { name: "LES", slug: "les-ne", category: "UTILITY_ELECTRIC", description: "Lincoln Electric System", website: "https://www.les.com", scope: "STATE", states: ["NE"], popularityScore: 78, tags: ["electric"] },
  { name: "Metropolitan Utilities District", slug: "mud-ne", category: "UTILITY_GAS", description: "Gas and water for Omaha", website: "https://www.mudomaha.com", phone: "1-402-554-6666", scope: "STATE", states: ["NE"], popularityScore: 80, tags: ["gas", "water"] },
  { name: "BCBS Nebraska", slug: "bcbs-ne", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Nebraska", website: "https://www.nebraskablue.com", scope: "STATE", states: ["NE"], popularityScore: 82, tags: ["health"] },

  // ── Nevada (NV) ──
  { name: "NV Energy", slug: "nv-energy", category: "UTILITY_ELECTRIC", description: "Electric and gas for Nevada", website: "https://www.nvenergy.com", phone: "1-702-402-5555", scope: "STATE", states: ["NV"], popularityScore: 92, tags: ["electric", "gas"] },
  { name: "Southwest Gas NV", slug: "swgas-nv", category: "UTILITY_GAS", description: "Natural gas for Nevada", website: "https://www.swgas.com", phone: "1-877-860-6020", scope: "STATE", states: ["NV", "AZ"], popularityScore: 78, tags: ["gas"] },
  { name: "Las Vegas Valley Water", slug: "lvvwd", category: "UTILITY_WATER", description: "Water for Las Vegas", website: "https://www.lvvwd.com", phone: "1-702-870-4194", scope: "STATE", states: ["NV"], popularityScore: 82, tags: ["water"] },
  { name: "RTC Southern Nevada", slug: "rtc-nv", category: "TRANSPORTATION_TRANSIT", description: "Transit for Las Vegas area", website: "https://www.rtcsnv.com", scope: "STATE", states: ["NV"], popularityScore: 72, tags: ["transit", "bus"] },

  // ── New Mexico (NM) ──
  { name: "PNM", slug: "pnm", category: "UTILITY_ELECTRIC", description: "Public Service Company of New Mexico", website: "https://www.pnm.com", phone: "1-888-342-5766", scope: "STATE", states: ["NM"], popularityScore: 88, tags: ["electric"] },
  { name: "New Mexico Gas Company", slug: "nmgc", category: "UTILITY_GAS", description: "Natural gas for New Mexico", website: "https://www.nmgco.com", phone: "1-888-664-2726", scope: "STATE", states: ["NM"], popularityScore: 80, tags: ["gas"] },
  { name: "Albuquerque Bernalillo Water", slug: "abcwua", category: "UTILITY_WATER", description: "Water for Albuquerque", website: "https://www.abcwua.org", scope: "STATE", states: ["NM"], popularityScore: 75, tags: ["water"] },
  { name: "BCBS New Mexico", slug: "bcbs-nm", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of New Mexico", website: "https://www.bcbsnm.com", scope: "STATE", states: ["NM"], popularityScore: 82, tags: ["health"] },

  // ── North Dakota (ND) ──
  { name: "Xcel Energy ND", slug: "xcel-nd", category: "UTILITY_ELECTRIC", description: "Electric for North Dakota", website: "https://www.xcelenergy.com", scope: "STATE", states: ["ND"], popularityScore: 82, tags: ["electric"] },
  { name: "Montana-Dakota Utilities", slug: "mdu", category: "UTILITY_GAS", description: "Gas and electric for ND/MT/SD", website: "https://www.montana-dakota.com", scope: "STATE", states: ["ND", "MT", "SD"], popularityScore: 78, tags: ["gas", "electric"] },
  { name: "BCBS North Dakota", slug: "bcbs-nd", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of North Dakota", website: "https://www.bcbsnd.com", scope: "STATE", states: ["ND"], popularityScore: 82, tags: ["health"] },

  // ── Oklahoma (OK) ──
  { name: "OG&E", slug: "oge", category: "UTILITY_ELECTRIC", description: "Oklahoma Gas and Electric", website: "https://www.oge.com", phone: "1-405-272-9741", scope: "STATE", states: ["OK"], popularityScore: 90, tags: ["electric"] },
  { name: "PSO (AEP)", slug: "pso", category: "UTILITY_ELECTRIC", description: "Public Service Company of Oklahoma", website: "https://www.psoklahoma.com", scope: "STATE", states: ["OK"], popularityScore: 78, tags: ["electric"] },
  { name: "Oklahoma Natural Gas", slug: "ong", category: "UTILITY_GAS", description: "Natural gas for Oklahoma", website: "https://www.oklahomanaturalgas.com", phone: "1-800-664-5463", scope: "STATE", states: ["OK"], popularityScore: 80, tags: ["gas"] },
  { name: "PikePass", slug: "pikepass", category: "TRANSPORTATION_TOLL", description: "Oklahoma toll pass", website: "https://www.pikepass.com", scope: "STATE", states: ["OK"], popularityScore: 82, tags: ["toll", "car"] },
  { name: "BCBS Oklahoma", slug: "bcbs-ok", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Oklahoma", website: "https://www.bcbsok.com", scope: "STATE", states: ["OK"], popularityScore: 82, tags: ["health"] },

  // ── Oregon (OR) ──
  { name: "Portland General Electric", slug: "pge-or", category: "UTILITY_ELECTRIC", description: "Electric for Portland area", website: "https://www.portlandgeneral.com", phone: "1-503-228-6322", scope: "STATE", states: ["OR"], popularityScore: 88, tags: ["electric"] },
  { name: "Pacific Power", slug: "pacific-power", category: "UTILITY_ELECTRIC", description: "Electric for Oregon", website: "https://www.pacificpower.net", scope: "STATE", states: ["OR", "WA"], popularityScore: 78, tags: ["electric"] },
  { name: "NW Natural Gas", slug: "nw-natural", category: "UTILITY_GAS", description: "Natural gas for Oregon", website: "https://www.nwnatural.com", phone: "1-800-422-4012", scope: "STATE", states: ["OR"], popularityScore: 82, tags: ["gas"] },
  { name: "Portland Water Bureau", slug: "pdx-water", category: "UTILITY_WATER", description: "Water for Portland", website: "https://www.portlandoregon.gov/water", scope: "STATE", states: ["OR"], popularityScore: 78, tags: ["water"] },
  { name: "TriMet", slug: "trimet", category: "TRANSPORTATION_TRANSIT", description: "Portland area transit", website: "https://www.trimet.org", phone: "1-503-238-7433", scope: "STATE", states: ["OR"], popularityScore: 85, tags: ["transit", "bus", "train"] },
  { name: "Moda Health", slug: "moda-or", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance for Oregon", website: "https://www.modahealth.com", scope: "STATE", states: ["OR"], popularityScore: 78, tags: ["health"] },

  // ── Rhode Island (RI) ──
  { name: "Rhode Island Energy", slug: "ri-energy", category: "UTILITY_ELECTRIC", description: "Electric and gas for Rhode Island", website: "https://www.rienergy.com", phone: "1-855-743-2372", scope: "STATE", states: ["RI"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Providence Water", slug: "providence-water", category: "UTILITY_WATER", description: "Water for Providence", website: "https://www.provwater.com", scope: "STATE", states: ["RI"], popularityScore: 75, tags: ["water"] },
  { name: "RIPTA", slug: "ripta", category: "TRANSPORTATION_TRANSIT", description: "Rhode Island Public Transit Authority", website: "https://www.ripta.com", scope: "STATE", states: ["RI"], popularityScore: 72, tags: ["transit", "bus"] },
  { name: "BCBS Rhode Island", slug: "bcbs-ri", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Rhode Island", website: "https://www.bcbsri.com", scope: "STATE", states: ["RI"], popularityScore: 85, tags: ["health"] },

  // ── South Dakota (SD) ──
  { name: "Black Hills Energy SD", slug: "bhe-sd", category: "UTILITY_ELECTRIC", description: "Electric for South Dakota", website: "https://www.blackhillsenergy.com", scope: "STATE", states: ["SD", "WY", "CO"], popularityScore: 82, tags: ["electric", "gas"] },
  { name: "BCBS South Dakota", slug: "bcbs-sd", category: "FINANCIAL_INSURANCE_HEALTH", description: "Wellmark BCBS South Dakota", website: "https://www.wellmark.com", scope: "STATE", states: ["SD"], popularityScore: 80, tags: ["health"] },

  // ── Utah (UT) ──
  { name: "Rocky Mountain Power", slug: "rmp-ut", category: "UTILITY_ELECTRIC", description: "Electric for Utah", website: "https://www.rockymountainpower.net", phone: "1-888-221-7070", scope: "STATE", states: ["UT", "WY", "ID"], popularityScore: 88, tags: ["electric"] },
  { name: "Dominion Energy Utah", slug: "dominion-ut", category: "UTILITY_GAS", description: "Natural gas for Utah", website: "https://www.dominionenergy.com", scope: "STATE", states: ["UT"], popularityScore: 82, tags: ["gas"] },
  { name: "Jordan Valley Water", slug: "jvwcd", category: "UTILITY_WATER", description: "Water for Salt Lake area", website: "https://www.jvwcd.org", scope: "STATE", states: ["UT"], popularityScore: 72, tags: ["water"] },
  { name: "UTA", slug: "uta", category: "TRANSPORTATION_TRANSIT", description: "Utah Transit Authority", website: "https://www.rideuta.com", scope: "STATE", states: ["UT"], popularityScore: 82, tags: ["transit", "bus", "train"] },
  { name: "Express Pass UT", slug: "expresspass-ut", category: "TRANSPORTATION_TOLL", description: "Utah toll pass", website: "https://www.udot.utah.gov", scope: "STATE", states: ["UT"], popularityScore: 70, tags: ["toll", "car"] },
  { name: "SelectHealth", slug: "selecthealth", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance for Utah", website: "https://www.selecthealth.org", scope: "STATE", states: ["UT"], popularityScore: 82, tags: ["health"] },

  // ── Vermont (VT) ──
  { name: "Green Mountain Power", slug: "gmp-vt", category: "UTILITY_ELECTRIC", description: "Electric for Vermont", website: "https://www.greenmountainpower.com", phone: "1-888-835-4672", scope: "STATE", states: ["VT"], popularityScore: 90, tags: ["electric"] },
  { name: "Vermont Gas Systems", slug: "vt-gas", category: "UTILITY_GAS", description: "Natural gas for Vermont", website: "https://www.vermontgas.com", scope: "STATE", states: ["VT"], popularityScore: 72, tags: ["gas"] },
  { name: "BCBS Vermont", slug: "bcbs-vt", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Vermont", website: "https://www.bcbsvt.com", scope: "STATE", states: ["VT"], popularityScore: 85, tags: ["health"] },

  // ── West Virginia (WV) ──
  { name: "Appalachian Power WV", slug: "appalachian-wv", category: "UTILITY_ELECTRIC", description: "AEP electric for West Virginia", website: "https://www.appalachianpower.com", phone: "1-800-956-4237", scope: "STATE", states: ["WV", "VA"], popularityScore: 85, tags: ["electric"] },
  { name: "Mountaineer Gas", slug: "mountaineer-gas", category: "UTILITY_GAS", description: "Natural gas for West Virginia", website: "https://www.mountaineergas.com", scope: "STATE", states: ["WV"], popularityScore: 78, tags: ["gas"] },
  { name: "West Virginia American Water", slug: "wv-american-water", category: "UTILITY_WATER", description: "Water for West Virginia", website: "https://www.amwater.com/wvaw", scope: "STATE", states: ["WV"], popularityScore: 72, tags: ["water"] },
  { name: "Highmark BCBS WV", slug: "highmark-wv", category: "FINANCIAL_INSURANCE_HEALTH", description: "Highmark Blue Cross West Virginia", website: "https://www.highmark.com", scope: "STATE", states: ["WV"], popularityScore: 82, tags: ["health"] },

  // ── Wyoming (WY) ──
  { name: "Black Hills Energy WY", slug: "bhe-wy", category: "UTILITY_ELECTRIC", description: "Electric and gas for Wyoming", website: "https://www.blackhillsenergy.com", scope: "STATE", states: ["WY"], popularityScore: 82, tags: ["electric", "gas"] },
  { name: "BCBS Wyoming", slug: "bcbs-wy", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Wyoming", website: "https://www.bcbswy.com", scope: "STATE", states: ["WY"], popularityScore: 80, tags: ["health"] },

  // ── Additional providers for existing states ──

  // Maryland (MD)
  { name: "Baltimore Gas & Electric", slug: "bge", category: "UTILITY_ELECTRIC", description: "Electric and gas for Baltimore area", website: "https://www.bge.com", phone: "1-800-685-0123", scope: "STATE", states: ["MD"], popularityScore: 90, tags: ["electric", "gas"] },
  { name: "Maryland E-ZPass", slug: "md-ezpass", category: "TRANSPORTATION_TOLL", description: "Maryland toll pass", website: "https://www.ezpassmd.com", scope: "STATE", states: ["MD"], popularityScore: 85, tags: ["toll", "car"] },
  { name: "MTA Maryland", slug: "mta-md", category: "TRANSPORTATION_TRANSIT", description: "Maryland Transit Administration", website: "https://www.mta.maryland.gov", scope: "STATE", states: ["MD"], popularityScore: 78, tags: ["transit", "bus", "train"] },
  { name: "CareFirst BCBS", slug: "carefirst", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield for MD/DC/VA", website: "https://www.carefirst.com", scope: "STATE", states: ["MD", "DC", "VA"], popularityScore: 85, tags: ["health"] },

  // Connecticut (CT)
  { name: "United Illuminating", slug: "ui-ct", category: "UTILITY_ELECTRIC", description: "Electric for SW Connecticut", website: "https://www.uinet.com", scope: "STATE", states: ["CT"], popularityScore: 78, tags: ["electric"] },
  { name: "Connecticut Natural Gas", slug: "cng-ct", category: "UTILITY_GAS", description: "Natural gas for Connecticut", website: "https://www.cngcorp.com", scope: "STATE", states: ["CT"], popularityScore: 72, tags: ["gas"] },
  { name: "CT Transit", slug: "ct-transit", category: "TRANSPORTATION_TRANSIT", description: "Connecticut transit", website: "https://www.cttransit.com", scope: "STATE", states: ["CT"], popularityScore: 72, tags: ["transit", "bus"] },

  // New Hampshire (NH)
  { name: "Eversource NH", slug: "eversource-nh", category: "UTILITY_ELECTRIC", description: "Electric for New Hampshire", website: "https://www.eversource.com", scope: "STATE", states: ["NH"], popularityScore: 85, tags: ["electric"] },
  { name: "Liberty Utilities NH", slug: "liberty-nh", category: "UTILITY_GAS", description: "Gas for New Hampshire", website: "https://www.libertyutilities.com", scope: "STATE", states: ["NH"], popularityScore: 72, tags: ["gas"] },
  { name: "Anthem BCBS NH", slug: "anthem-nh", category: "FINANCIAL_INSURANCE_HEALTH", description: "Anthem Blue Cross New Hampshire", website: "https://www.anthem.com", scope: "STATE", states: ["NH"], popularityScore: 82, tags: ["health"] },

  // Minnesota (MN)
  { name: "Minnesota Energy Resources", slug: "mn-energy", category: "UTILITY_GAS", description: "Natural gas for Minnesota", website: "https://www.minnesotaenergyresources.com", scope: "STATE", states: ["MN"], popularityScore: 75, tags: ["gas"] },
  { name: "Metro Transit MN", slug: "metro-mn", category: "TRANSPORTATION_TRANSIT", description: "Minneapolis-St. Paul transit", website: "https://www.metrotransit.org", scope: "STATE", states: ["MN"], popularityScore: 82, tags: ["transit", "bus", "train"] },
  { name: "BCBS Minnesota", slug: "bcbs-mn", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Minnesota", website: "https://www.bluecrossmn.com", scope: "STATE", states: ["MN"], popularityScore: 85, tags: ["health"] },
  { name: "MnPass", slug: "mnpass", category: "TRANSPORTATION_TOLL", description: "Minnesota express lane pass", website: "https://www.mnpass.org", scope: "STATE", states: ["MN"], popularityScore: 70, tags: ["toll", "car"] },

  // Wisconsin (WI)
  { name: "We Energies", slug: "we-energies", category: "UTILITY_ELECTRIC", description: "Electric and gas for SE Wisconsin", website: "https://www.we-energies.com", phone: "1-800-242-9137", scope: "STATE", states: ["WI"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Madison Gas & Electric", slug: "mge", category: "UTILITY_GAS", description: "Gas and electric for Madison", website: "https://www.mge.com", scope: "STATE", states: ["WI"], popularityScore: 78, tags: ["gas", "electric"] },
  { name: "Milwaukee County Transit", slug: "mcts", category: "TRANSPORTATION_TRANSIT", description: "Milwaukee transit", website: "https://www.ridemcts.com", scope: "STATE", states: ["WI"], popularityScore: 72, tags: ["transit", "bus"] },

  // Tennessee (TN)
  { name: "Nashville Electric Service", slug: "nes-tn", category: "UTILITY_ELECTRIC", description: "Electric for Nashville", website: "https://www.nespower.com", phone: "1-615-736-6900", scope: "STATE", states: ["TN"], popularityScore: 85, tags: ["electric"] },
  { name: "Memphis Light Gas & Water", slug: "mlgw", category: "UTILITY_ELECTRIC", description: "Electric, gas and water for Memphis", website: "https://www.mlgw.com", phone: "1-901-544-6549", scope: "STATE", states: ["TN"], popularityScore: 82, tags: ["electric", "gas", "water"] },
  { name: "BCBS Tennessee", slug: "bcbs-tn", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Tennessee", website: "https://www.bcbst.com", phone: "1-800-565-9140", scope: "STATE", states: ["TN"], popularityScore: 88, tags: ["health"] },

  // South Carolina (SC)
  { name: "SCE&G (Dominion)", slug: "sceg", category: "UTILITY_ELECTRIC", description: "Electric and gas for South Carolina", website: "https://www.dominionenergy.com/south-carolina", scope: "STATE", states: ["SC"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "Palmetto Pass", slug: "palmetto-pass", category: "TRANSPORTATION_TOLL", description: "South Carolina toll pass", website: "https://www.palmettopass.com", scope: "STATE", states: ["SC"], popularityScore: 75, tags: ["toll", "car"] },
  { name: "BCBS South Carolina", slug: "bcbs-sc", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of SC", website: "https://www.bcbssc.com", scope: "STATE", states: ["SC"], popularityScore: 85, tags: ["health"] },

  // Virginia (VA) - additional
  { name: "Washington Gas VA", slug: "washington-gas-va", category: "UTILITY_GAS", description: "Natural gas for Northern Virginia", website: "https://www.washingtongas.com", phone: "1-844-927-4427", scope: "STATE", states: ["VA", "DC", "MD"], popularityScore: 80, tags: ["gas"] },
  { name: "Anthem BCBS Virginia", slug: "anthem-va", category: "FINANCIAL_INSURANCE_HEALTH", description: "Anthem Blue Cross Virginia", website: "https://www.anthem.com", scope: "STATE", states: ["VA"], popularityScore: 85, tags: ["health"] },

  // DC - additional
  { name: "Pepco", slug: "pepco", category: "UTILITY_ELECTRIC", description: "Electric for DC and Maryland", website: "https://www.pepco.com", phone: "1-202-833-7500", scope: "STATE", states: ["DC", "MD"], popularityScore: 88, tags: ["electric"] },
  { name: "Washington Gas DC", slug: "washington-gas-dc", category: "UTILITY_GAS", description: "Natural gas for DC", website: "https://www.washingtongas.com", scope: "STATE", states: ["DC"], popularityScore: 82, tags: ["gas"] },
  { name: "DC Water", slug: "dc-water", category: "UTILITY_WATER", description: "Water for Washington DC", website: "https://www.dcwater.com", phone: "1-202-354-3600", scope: "STATE", states: ["DC"], popularityScore: 85, tags: ["water"] },
];

async function main() {
  console.log("Seeding all-states providers...");

  let created = 0;
  let skipped = 0;

  for (const p of PROVIDERS) {
    const existing = await prisma.serviceProvider.findUnique({ where: { slug: p.slug } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.serviceProvider.create({
      data: {
        name: p.name,
        slug: p.slug,
        category: p.category,
        description: p.description,
        website: p.website,
        phone: p.phone,
        scope: p.scope,
        states: JSON.stringify(p.states),
        zipCodes: "[]",
        tags: JSON.stringify(p.tags || []),
        popularityScore: p.popularityScore || 50,
        isActive: true,
        displayOrder: 0,
      },
    });
    created++;
  }

  console.log(`Done! Created: ${created}, Skipped: ${skipped}, Total in file: ${PROVIDERS.length}`);

  const total = await prisma.serviceProvider.count();
  console.log(`Total providers in DB: ${total}`);

  // Verify all 50 states + DC covered
  const all = await prisma.serviceProvider.findMany({ select: { scope: true, states: true } });
  const stateSet = new Set<string>();
  all.forEach((r: any) => {
    if (r.scope === "STATE") {
      try { JSON.parse(r.states).forEach((s: string) => stateSet.add(s)); } catch {}
    }
  });
  console.log(`States covered: ${Array.from(stateSet).sort().join(", ")}`);
  console.log(`State count: ${stateSet.size}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
