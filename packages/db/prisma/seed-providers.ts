import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ProviderSeed {
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
// FEDERAL PROVIDERS (available nationwide)
// ============================================================
const FEDERAL_PROVIDERS: ProviderSeed[] = [
  // ── Banks ──
  { name: "Chase", slug: "chase", category: "FINANCIAL_BANK", description: "JPMorgan Chase - largest bank in the US", website: "https://www.chase.com", phone: "1-800-935-9935", scope: "FEDERAL", popularityScore: 98, tags: ["banking", "credit-card"] },
  { name: "Bank of America", slug: "bank-of-america", category: "FINANCIAL_BANK", description: "One of the largest banks in the US", website: "https://www.bankofamerica.com", phone: "1-800-432-1000", scope: "FEDERAL", popularityScore: 95, tags: ["banking", "credit-card"] },
  { name: "Wells Fargo", slug: "wells-fargo", category: "FINANCIAL_BANK", description: "Diversified financial services company", website: "https://www.wellsfargo.com", phone: "1-800-869-3557", scope: "FEDERAL", popularityScore: 90, tags: ["banking", "credit-card"] },
  { name: "Citibank", slug: "citibank", category: "FINANCIAL_BANK", description: "Global banking and financial services", website: "https://www.citi.com", phone: "1-800-374-9700", scope: "FEDERAL", popularityScore: 85, tags: ["banking", "credit-card"] },
  { name: "Capital One", slug: "capital-one", category: "FINANCIAL_BANK", description: "Banking and credit card company", website: "https://www.capitalone.com", phone: "1-877-383-4802", scope: "FEDERAL", popularityScore: 82, tags: ["banking", "credit-card"] },
  { name: "US Bank", slug: "us-bank", category: "FINANCIAL_BANK", description: "Fifth-largest bank in the US", website: "https://www.usbank.com", phone: "1-800-872-2657", scope: "FEDERAL", popularityScore: 78, tags: ["banking"] },
  { name: "PNC Bank", slug: "pnc-bank", category: "FINANCIAL_BANK", description: "Regional bank with nationwide presence", website: "https://www.pnc.com", phone: "1-888-762-2265", scope: "FEDERAL", popularityScore: 70, tags: ["banking"] },
  { name: "TD Bank", slug: "td-bank", category: "FINANCIAL_BANK", description: "America's most convenient bank", website: "https://www.td.com", phone: "1-888-751-9000", scope: "FEDERAL", popularityScore: 68, tags: ["banking"] },
  { name: "Ally Bank", slug: "ally-bank", category: "FINANCIAL_BANK", subCategory: "ONLINE", description: "Online-only bank with competitive rates", website: "https://www.ally.com", phone: "1-877-247-2559", scope: "FEDERAL", popularityScore: 72, tags: ["banking", "online"] },
  { name: "Discover Bank", slug: "discover-bank", category: "FINANCIAL_BANK", description: "Online banking and credit cards", website: "https://www.discover.com", phone: "1-800-347-2683", scope: "FEDERAL", popularityScore: 65, tags: ["banking", "credit-card"] },

  // ── Credit Cards ──
  { name: "American Express", slug: "amex", category: "FINANCIAL_CREDIT_CARD", description: "Premium credit cards and financial services", website: "https://www.americanexpress.com", phone: "1-800-528-4800", scope: "FEDERAL", popularityScore: 88, tags: ["credit-card"] },

  // ── Insurance - Auto ──
  { name: "GEICO", slug: "geico", category: "FINANCIAL_INSURANCE_AUTO", description: "Government Employees Insurance Company", website: "https://www.geico.com", phone: "1-800-207-7847", scope: "FEDERAL", popularityScore: 92, tags: ["auto", "car"] },
  { name: "State Farm", slug: "state-farm", category: "FINANCIAL_INSURANCE_AUTO", description: "Insurance and financial services", website: "https://www.statefarm.com", phone: "1-800-782-8332", scope: "FEDERAL", popularityScore: 90, tags: ["auto", "home", "car"] },
  { name: "Progressive", slug: "progressive", category: "FINANCIAL_INSURANCE_AUTO", description: "Auto insurance and more", website: "https://www.progressive.com", phone: "1-800-776-4737", scope: "FEDERAL", popularityScore: 88, tags: ["auto", "car"] },
  { name: "Allstate", slug: "allstate", category: "FINANCIAL_INSURANCE_AUTO", description: "You're in good hands", website: "https://www.allstate.com", phone: "1-800-255-7828", scope: "FEDERAL", popularityScore: 85, tags: ["auto", "home", "car"] },
  { name: "Liberty Mutual", slug: "liberty-mutual", category: "FINANCIAL_INSURANCE_AUTO", description: "Auto, home, and life insurance", website: "https://www.libertymutual.com", phone: "1-800-290-8206", scope: "FEDERAL", popularityScore: 78, tags: ["auto", "home", "car"] },
  { name: "USAA", slug: "usaa", category: "FINANCIAL_INSURANCE_AUTO", description: "For military members and families", website: "https://www.usaa.com", phone: "1-800-531-8722", scope: "FEDERAL", popularityScore: 82, tags: ["auto", "home", "military"] },
  { name: "Nationwide", slug: "nationwide", category: "FINANCIAL_INSURANCE_AUTO", description: "Insurance and financial services", website: "https://www.nationwide.com", phone: "1-877-669-6877", scope: "FEDERAL", popularityScore: 75, tags: ["auto", "home", "car"] },

  // ── Insurance - Home ──
  { name: "Lemonade", slug: "lemonade", category: "FINANCIAL_INSURANCE_HOME", description: "AI-powered renters and homeowners insurance", website: "https://www.lemonade.com", phone: "1-844-733-8666", scope: "FEDERAL", popularityScore: 70, tags: ["home", "renters"] },

  // ── Insurance - Health ──
  { name: "UnitedHealthcare", slug: "unitedhealthcare", category: "FINANCIAL_INSURANCE_HEALTH", description: "Largest health insurance company in the US", website: "https://www.uhc.com", phone: "1-800-328-5979", scope: "FEDERAL", popularityScore: 88, tags: ["health"] },
  { name: "Blue Cross Blue Shield", slug: "bcbs", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance federation", website: "https://www.bcbs.com", phone: "1-888-630-2583", scope: "FEDERAL", popularityScore: 90, tags: ["health"] },
  { name: "Aetna", slug: "aetna", category: "FINANCIAL_INSURANCE_HEALTH", description: "CVS Health company", website: "https://www.aetna.com", phone: "1-800-872-3862", scope: "FEDERAL", popularityScore: 82, tags: ["health"] },
  { name: "Cigna", slug: "cigna", category: "FINANCIAL_INSURANCE_HEALTH", description: "Global health service company", website: "https://www.cigna.com", phone: "1-800-997-1654", scope: "FEDERAL", popularityScore: 80, tags: ["health"] },
  { name: "Kaiser Permanente", slug: "kaiser", category: "FINANCIAL_INSURANCE_HEALTH", description: "Integrated managed care consortium", website: "https://www.kp.org", phone: "1-800-464-4000", scope: "FEDERAL", popularityScore: 75, tags: ["health"] },
  { name: "Humana", slug: "humana", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance and wellness", website: "https://www.humana.com", phone: "1-800-457-4708", scope: "FEDERAL", popularityScore: 72, tags: ["health", "senior", "medicare"] },

  // ── Phone Carriers ──
  { name: "AT&T", slug: "att", category: "UTILITY_PHONE", description: "Wireless, internet, and TV services", website: "https://www.att.com", phone: "1-800-331-0500", scope: "FEDERAL", popularityScore: 92, tags: ["phone", "internet", "tv"] },
  { name: "Verizon", slug: "verizon", category: "UTILITY_PHONE", description: "Wireless and fiber services", website: "https://www.verizon.com", phone: "1-800-922-0204", scope: "FEDERAL", popularityScore: 90, tags: ["phone", "internet", "fiber"] },
  { name: "T-Mobile", slug: "t-mobile", category: "UTILITY_PHONE", description: "Un-carrier wireless service", website: "https://www.t-mobile.com", phone: "1-800-937-8997", scope: "FEDERAL", popularityScore: 88, tags: ["phone"] },
  { name: "Mint Mobile", slug: "mint-mobile", category: "UTILITY_PHONE", description: "Budget-friendly wireless", website: "https://www.mintmobile.com", scope: "FEDERAL", popularityScore: 65, tags: ["phone", "budget"] },
  { name: "Google Fi", slug: "google-fi", category: "UTILITY_PHONE", description: "Flexible phone plan by Google", website: "https://fi.google.com", scope: "FEDERAL", popularityScore: 55, tags: ["phone"] },
  { name: "Visible", slug: "visible", category: "UTILITY_PHONE", description: "Simple wireless by Verizon", website: "https://www.visible.com", scope: "FEDERAL", popularityScore: 50, tags: ["phone", "budget"] },

  // ── Internet (nationwide) ──
  { name: "Xfinity (Comcast)", slug: "xfinity", category: "UTILITY_INTERNET", description: "Internet, TV, and streaming", website: "https://www.xfinity.com", phone: "1-800-934-6489", scope: "FEDERAL", popularityScore: 85, tags: ["internet", "tv", "cable"] },
  { name: "Spectrum", slug: "spectrum", category: "UTILITY_INTERNET", description: "Internet, TV, and voice", website: "https://www.spectrum.com", phone: "1-833-267-6094", scope: "FEDERAL", popularityScore: 80, tags: ["internet", "tv", "cable"] },
  { name: "AT&T Fiber", slug: "att-fiber", category: "UTILITY_INTERNET", description: "Fiber internet service", website: "https://www.att.com/internet/fiber", phone: "1-855-220-5211", scope: "FEDERAL", popularityScore: 78, tags: ["internet", "fiber"] },
  { name: "Verizon Fios", slug: "verizon-fios", category: "UTILITY_INTERNET", description: "100% fiber optic internet", website: "https://www.verizon.com/fios", phone: "1-800-837-4966", scope: "FEDERAL", popularityScore: 76, tags: ["internet", "fiber"] },
  { name: "T-Mobile Home Internet", slug: "t-mobile-home", category: "UTILITY_INTERNET", description: "5G home internet", website: "https://www.t-mobile.com/home-internet", scope: "FEDERAL", popularityScore: 60, tags: ["internet", "5g"] },
  { name: "Starlink", slug: "starlink", category: "UTILITY_INTERNET", description: "Satellite internet by SpaceX", website: "https://www.starlink.com", scope: "FEDERAL", popularityScore: 55, tags: ["internet", "satellite", "rural"] },

  // ── Cable / TV ──
  { name: "DirecTV", slug: "directv", category: "UTILITY_CABLE", description: "Satellite TV service", website: "https://www.directv.com", phone: "1-800-531-5000", scope: "FEDERAL", popularityScore: 65, tags: ["tv", "satellite"] },
  { name: "YouTube TV", slug: "youtube-tv", category: "UTILITY_CABLE", description: "Live TV streaming", website: "https://tv.youtube.com", scope: "FEDERAL", popularityScore: 72, tags: ["tv", "streaming"] },
  { name: "Hulu + Live TV", slug: "hulu-live", category: "UTILITY_CABLE", description: "Live and on-demand TV streaming", website: "https://www.hulu.com/live-tv", scope: "FEDERAL", popularityScore: 68, tags: ["tv", "streaming"] },

  // ── Fitness / Gym ──
  { name: "Planet Fitness", slug: "planet-fitness", category: "FITNESS_GYM", description: "Judgement free zone", website: "https://www.planetfitness.com", phone: "1-844-880-7180", scope: "FEDERAL", popularityScore: 90, tags: ["gym", "fitness", "budget"] },
  { name: "LA Fitness", slug: "la-fitness", category: "FITNESS_GYM", description: "Full-service health club", website: "https://www.lafitness.com", phone: "1-949-255-7200", scope: "FEDERAL", popularityScore: 78, tags: ["gym", "fitness"] },
  { name: "24 Hour Fitness", slug: "24-hour-fitness", category: "FITNESS_GYM", description: "Fitness clubs open 24/7", website: "https://www.24hourfitness.com", phone: "1-800-224-0240", scope: "FEDERAL", popularityScore: 72, tags: ["gym", "fitness"] },
  { name: "Anytime Fitness", slug: "anytime-fitness", category: "FITNESS_GYM", description: "24/7 gym access worldwide", website: "https://www.anytimefitness.com", phone: "1-800-704-5004", scope: "FEDERAL", popularityScore: 75, tags: ["gym", "fitness"] },
  { name: "Equinox", slug: "equinox", category: "FITNESS_GYM", description: "High-performance luxury fitness", website: "https://www.equinox.com", scope: "FEDERAL", popularityScore: 60, tags: ["gym", "fitness", "luxury"] },
  { name: "Orangetheory Fitness", slug: "orangetheory", category: "FITNESS_GYM", description: "Heart-rate based interval training", website: "https://www.orangetheory.com", scope: "FEDERAL", popularityScore: 65, tags: ["gym", "fitness", "classes"] },
  { name: "CrossFit", slug: "crossfit", category: "FITNESS_GYM", description: "High-intensity functional training", website: "https://www.crossfit.com", scope: "FEDERAL", popularityScore: 58, tags: ["gym", "fitness", "crossfit"] },
  { name: "Peloton", slug: "peloton", category: "FITNESS_GYM", subCategory: "ONLINE", description: "Connected fitness at home", website: "https://www.onepeloton.com", scope: "FEDERAL", popularityScore: 62, tags: ["fitness", "home", "online"] },

  // ── Subscriptions ──
  { name: "Amazon Prime", slug: "amazon-prime", category: "SHOPPING_SUBSCRIPTION", description: "Free shipping, video, music, and more", website: "https://www.amazon.com/prime", scope: "FEDERAL", popularityScore: 98, tags: ["subscription", "shopping", "streaming"] },
  { name: "Netflix", slug: "netflix", category: "SHOPPING_SUBSCRIPTION", description: "Streaming movies and TV shows", website: "https://www.netflix.com", scope: "FEDERAL", popularityScore: 95, tags: ["subscription", "streaming"] },
  { name: "Spotify", slug: "spotify", category: "SHOPPING_SUBSCRIPTION", description: "Music and podcast streaming", website: "https://www.spotify.com", scope: "FEDERAL", popularityScore: 88, tags: ["subscription", "music"] },
  { name: "Apple One", slug: "apple-one", category: "SHOPPING_SUBSCRIPTION", description: "Apple Music, TV+, Arcade, iCloud+", website: "https://www.apple.com/apple-one", scope: "FEDERAL", popularityScore: 75, tags: ["subscription", "streaming"] },
  { name: "Disney+", slug: "disney-plus", category: "SHOPPING_SUBSCRIPTION", description: "Disney, Pixar, Marvel, Star Wars", website: "https://www.disneyplus.com", scope: "FEDERAL", popularityScore: 80, tags: ["subscription", "streaming", "kids"] },
  { name: "Costco", slug: "costco", category: "SHOPPING_SUBSCRIPTION", description: "Wholesale club membership", website: "https://www.costco.com", scope: "FEDERAL", popularityScore: 82, tags: ["subscription", "shopping"] },
  { name: "Sam's Club", slug: "sams-club", category: "SHOPPING_SUBSCRIPTION", description: "Walmart wholesale club", website: "https://www.samsclub.com", scope: "FEDERAL", popularityScore: 70, tags: ["subscription", "shopping"] },

  // ── Mortgage / Rent ──
  { name: "Rocket Mortgage", slug: "rocket-mortgage", category: "FINANCIAL_MORTGAGE", description: "Online mortgage lender", website: "https://www.rocketmortgage.com", phone: "1-800-785-4632", scope: "FEDERAL", popularityScore: 82, tags: ["mortgage", "home"] },
  { name: "Better.com", slug: "better", category: "FINANCIAL_MORTGAGE", description: "Digital mortgage lender", website: "https://www.better.com", scope: "FEDERAL", popularityScore: 65, tags: ["mortgage", "home"] },

  // ── Healthcare ──
  { name: "CVS Pharmacy", slug: "cvs", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and health services", website: "https://www.cvs.com", phone: "1-800-746-7287", scope: "FEDERAL", popularityScore: 88, tags: ["pharmacy", "health"] },
  { name: "Walgreens", slug: "walgreens", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and health services", website: "https://www.walgreens.com", phone: "1-800-925-4733", scope: "FEDERAL", popularityScore: 85, tags: ["pharmacy", "health"] },

  // ── Kids ──
  { name: "Kumon", slug: "kumon", category: "KIDS_ACTIVITY", description: "After-school math and reading program", website: "https://www.kumon.com", phone: "1-800-222-6284", scope: "FEDERAL", popularityScore: 60, tags: ["kids", "education", "children"] },
  { name: "KinderCare", slug: "kindercare", category: "KIDS_DAYCARE", description: "Early childhood education", website: "https://www.kindercare.com", scope: "FEDERAL", popularityScore: 65, tags: ["kids", "daycare", "children"] },
  { name: "Bright Horizons", slug: "bright-horizons", category: "KIDS_DAYCARE", description: "Child care and early education", website: "https://www.brighthorizons.com", scope: "FEDERAL", popularityScore: 62, tags: ["kids", "daycare", "children"] },

  // ── Transportation - Toll ──
  { name: "E-ZPass", slug: "ezpass", category: "TRANSPORTATION_TOLL", description: "Electronic toll collection (multi-state)", website: "https://www.e-zpassiag.com", scope: "FEDERAL", popularityScore: 85, tags: ["toll", "car", "driving"] },

  // ── Trash / Waste ──
  { name: "Waste Management", slug: "waste-management", category: "UTILITY_TRASH", description: "Largest waste services provider in the US", website: "https://www.wm.com", phone: "1-866-797-9018", scope: "FEDERAL", popularityScore: 80, tags: ["trash", "waste", "recycling"] },
  { name: "Republic Services", slug: "republic-services", category: "UTILITY_TRASH", description: "Environmental services", website: "https://www.republicservices.com", phone: "1-800-422-2733", scope: "FEDERAL", popularityScore: 70, tags: ["trash", "waste"] },

  // ── Pet ──
  { name: "Banfield Pet Hospital", slug: "banfield", category: "HEALTHCARE_VET", description: "Preventive pet care", website: "https://www.banfield.com", phone: "1-866-894-7927", scope: "FEDERAL", popularityScore: 70, tags: ["pet", "vet", "dog", "cat"] },
  { name: "VCA Animal Hospitals", slug: "vca", category: "HEALTHCARE_VET", description: "Veterinary care network", website: "https://www.vcahospitals.com", scope: "FEDERAL", popularityScore: 65, tags: ["pet", "vet"] },
  { name: "Chewy", slug: "chewy", category: "SHOPPING_SUBSCRIPTION", description: "Pet food and supplies subscription", website: "https://www.chewy.com", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "subscription", "dog", "cat"] },
  { name: "BarkBox", slug: "barkbox", category: "SHOPPING_SUBSCRIPTION", description: "Monthly box of dog toys and treats", website: "https://www.barkbox.com", scope: "FEDERAL", popularityScore: 55, tags: ["pet", "subscription", "dog"] },

  // ── Senior ──
  { name: "AARP", slug: "aarp", category: "SHOPPING_SUBSCRIPTION", description: "Membership for age 50+", website: "https://www.aarp.org", scope: "FEDERAL", popularityScore: 75, tags: ["senior", "subscription", "medicare"] },
  { name: "Medicare.gov", slug: "medicare", category: "FINANCIAL_INSURANCE_HEALTH", description: "Federal health insurance for 65+", website: "https://www.medicare.gov", phone: "1-800-633-4227", scope: "FEDERAL", popularityScore: 90, tags: ["senior", "health", "medicare"] },
];

// ============================================================
// STATE PROVIDERS (available in specific states)
// ============================================================
const STATE_PROVIDERS: ProviderSeed[] = [
  // ── New Jersey ──
  { name: "PSE&G", slug: "pseg", category: "UTILITY_ELECTRIC", description: "Public Service Electric and Gas", website: "https://www.pseg.com", phone: "1-800-436-7734", scope: "STATE", states: ["NJ"], popularityScore: 95, tags: ["electric", "gas"] },
  { name: "JCP&L", slug: "jcpl", category: "UTILITY_ELECTRIC", description: "Jersey Central Power & Light", website: "https://www.firstenergycorp.com/jcpl", phone: "1-800-662-3115", scope: "STATE", states: ["NJ"], popularityScore: 70, tags: ["electric"] },
  { name: "New Jersey American Water", slug: "nj-american-water", category: "UTILITY_WATER", description: "Water utility for NJ", website: "https://www.amwater.com/njaw", phone: "1-800-652-6987", scope: "STATE", states: ["NJ"], popularityScore: 80, tags: ["water"] },
  { name: "NJ E-ZPass", slug: "nj-ezpass", category: "TRANSPORTATION_TOLL", description: "NJ Turnpike toll pass", website: "https://www.ezpassnj.com", phone: "1-888-288-6865", scope: "STATE", states: ["NJ"], popularityScore: 90, tags: ["toll", "car", "driving"] },
  { name: "NJ Transit", slug: "nj-transit", category: "TRANSPORTATION_TRANSIT", description: "NJ public transportation", website: "https://www.njtransit.com", phone: "1-973-275-5555", scope: "STATE", states: ["NJ"], popularityScore: 85, tags: ["transit", "bus", "train"] },
  { name: "Elizabethtown Gas", slug: "elizabethtown-gas", category: "UTILITY_GAS", description: "Natural gas utility NJ", website: "https://www.southerncompanygas.com/elizabethtown-gas", scope: "STATE", states: ["NJ"], popularityScore: 65, tags: ["gas"] },
  { name: "Horizon BCBS NJ", slug: "horizon-bcbs-nj", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of New Jersey", website: "https://www.horizonblue.com", phone: "1-800-355-2583", scope: "STATE", states: ["NJ"], popularityScore: 88, tags: ["health"] },
  { name: "NJ Natural Gas", slug: "njng", category: "UTILITY_GAS", description: "New Jersey Natural Gas", website: "https://www.njng.com", phone: "1-800-221-0051", scope: "STATE", states: ["NJ"], popularityScore: 72, tags: ["gas"] },

  // ── New York ──
  { name: "Con Edison", slug: "con-edison", category: "UTILITY_ELECTRIC", description: "Consolidated Edison", website: "https://www.coned.com", phone: "1-800-752-6633", scope: "STATE", states: ["NY"], popularityScore: 95, tags: ["electric", "gas"] },
  { name: "National Grid NY", slug: "national-grid-ny", category: "UTILITY_GAS", description: "Gas and electric for upstate NY", website: "https://www.nationalgridus.com", phone: "1-800-642-4272", scope: "STATE", states: ["NY"], popularityScore: 75, tags: ["gas", "electric"] },
  { name: "NYC Water Board", slug: "nyc-water", category: "UTILITY_WATER", description: "NYC water and sewer", website: "https://www1.nyc.gov/site/dep", scope: "STATE", states: ["NY"], popularityScore: 85, tags: ["water"] },
  { name: "MTA", slug: "mta", category: "TRANSPORTATION_TRANSIT", description: "Metropolitan Transportation Authority", website: "https://www.mta.info", scope: "STATE", states: ["NY"], popularityScore: 95, tags: ["transit", "subway", "bus"] },
  { name: "NY E-ZPass", slug: "ny-ezpass", category: "TRANSPORTATION_TOLL", description: "New York toll pass", website: "https://www.e-zpassny.com", scope: "STATE", states: ["NY"], popularityScore: 88, tags: ["toll", "car"] },
  { name: "Optimum", slug: "optimum", category: "UTILITY_INTERNET", description: "Internet and TV for NY/NJ/CT", website: "https://www.optimum.com", phone: "1-866-347-4784", scope: "STATE", states: ["NY", "NJ", "CT"], popularityScore: 72, tags: ["internet", "cable", "tv"] },
  { name: "RCN", slug: "rcn", category: "UTILITY_INTERNET", description: "Internet, TV, phone", website: "https://www.rcn.com", scope: "STATE", states: ["NY", "NJ", "PA", "MA", "DC", "IL"], popularityScore: 55, tags: ["internet", "cable"] },

  // ── Texas ──
  { name: "TXU Energy", slug: "txu-energy", category: "UTILITY_ELECTRIC", description: "Texas electricity provider", website: "https://www.txu.com", phone: "1-800-818-6132", scope: "STATE", states: ["TX"], popularityScore: 88, tags: ["electric"] },
  { name: "Reliant Energy", slug: "reliant", category: "UTILITY_ELECTRIC", description: "Texas electricity provider", website: "https://www.reliant.com", phone: "1-866-222-7100", scope: "STATE", states: ["TX"], popularityScore: 82, tags: ["electric"] },
  { name: "Green Mountain Energy", slug: "green-mountain", category: "UTILITY_ELECTRIC", description: "Clean energy in Texas", website: "https://www.greenmountainenergy.com", scope: "STATE", states: ["TX"], popularityScore: 65, tags: ["electric", "green"] },
  { name: "CenterPoint Energy", slug: "centerpoint", category: "UTILITY_GAS", description: "Natural gas delivery in TX", website: "https://www.centerpointenergy.com", phone: "1-800-332-7143", scope: "STATE", states: ["TX"], popularityScore: 80, tags: ["gas"] },
  { name: "TxTag", slug: "txtag", category: "TRANSPORTATION_TOLL", description: "Texas toll tag", website: "https://www.txtag.org", phone: "1-888-468-9824", scope: "STATE", states: ["TX"], popularityScore: 88, tags: ["toll", "car", "driving"] },
  { name: "DART", slug: "dart", category: "TRANSPORTATION_TRANSIT", description: "Dallas Area Rapid Transit", website: "https://www.dart.org", phone: "1-214-979-1111", scope: "STATE", states: ["TX"], popularityScore: 65, tags: ["transit", "bus", "train"] },
  { name: "BCBS Texas", slug: "bcbs-tx", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Texas", website: "https://www.bcbstx.com", phone: "1-800-521-2227", scope: "STATE", states: ["TX"], popularityScore: 85, tags: ["health"] },

  // ── California ──
  { name: "PG&E", slug: "pge", category: "UTILITY_ELECTRIC", description: "Pacific Gas and Electric", website: "https://www.pge.com", phone: "1-800-743-5000", scope: "STATE", states: ["CA"], popularityScore: 92, tags: ["electric", "gas"] },
  { name: "SoCal Edison", slug: "sce", category: "UTILITY_ELECTRIC", description: "Southern California Edison", website: "https://www.sce.com", phone: "1-800-655-4555", scope: "STATE", states: ["CA"], popularityScore: 88, tags: ["electric"] },
  { name: "SoCal Gas", slug: "socalgas", category: "UTILITY_GAS", description: "Southern California Gas", website: "https://www.socalgas.com", phone: "1-800-427-2200", scope: "STATE", states: ["CA"], popularityScore: 85, tags: ["gas"] },
  { name: "LADWP", slug: "ladwp", category: "UTILITY_WATER", description: "LA Dept of Water and Power", website: "https://www.ladwp.com", phone: "1-800-342-5397", scope: "STATE", states: ["CA"], popularityScore: 82, tags: ["water", "electric"] },
  { name: "FasTrak", slug: "fastrak", category: "TRANSPORTATION_TOLL", description: "California toll pass", website: "https://www.bayareafastrak.org", scope: "STATE", states: ["CA"], popularityScore: 85, tags: ["toll", "car", "driving"] },
  { name: "LA Metro", slug: "la-metro", category: "TRANSPORTATION_TRANSIT", description: "Los Angeles Metro", website: "https://www.metro.net", scope: "STATE", states: ["CA"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "BART", slug: "bart", category: "TRANSPORTATION_TRANSIT", description: "Bay Area Rapid Transit", website: "https://www.bart.gov", scope: "STATE", states: ["CA"], popularityScore: 78, tags: ["transit", "train"] },
  { name: "Covered California", slug: "covered-ca", category: "FINANCIAL_INSURANCE_HEALTH", description: "CA health insurance marketplace", website: "https://www.coveredca.com", phone: "1-800-300-1506", scope: "STATE", states: ["CA"], popularityScore: 80, tags: ["health"] },

  // ── Florida ──
  { name: "FPL (Florida Power & Light)", slug: "fpl", category: "UTILITY_ELECTRIC", description: "Largest electric utility in FL", website: "https://www.fpl.com", phone: "1-800-468-8243", scope: "STATE", states: ["FL"], popularityScore: 92, tags: ["electric"] },
  { name: "Duke Energy Florida", slug: "duke-fl", category: "UTILITY_ELECTRIC", description: "Electric utility in FL", website: "https://www.duke-energy.com/florida", phone: "1-800-700-8744", scope: "STATE", states: ["FL"], popularityScore: 78, tags: ["electric"] },
  { name: "TECO Energy", slug: "teco", category: "UTILITY_ELECTRIC", description: "Tampa Electric", website: "https://www.tampaelectric.com", phone: "1-813-223-0800", scope: "STATE", states: ["FL"], popularityScore: 70, tags: ["electric", "gas"] },
  { name: "SunPass", slug: "sunpass", category: "TRANSPORTATION_TOLL", description: "Florida toll pass", website: "https://www.sunpass.com", phone: "1-888-865-5352", scope: "STATE", states: ["FL"], popularityScore: 90, tags: ["toll", "car", "driving"] },
  { name: "Florida Blue", slug: "florida-blue", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Florida", website: "https://www.floridablue.com", phone: "1-800-352-2583", scope: "STATE", states: ["FL"], popularityScore: 85, tags: ["health"] },

  // ── Pennsylvania ──
  { name: "PECO Energy", slug: "peco", category: "UTILITY_ELECTRIC", description: "Electric and gas for SE Pennsylvania", website: "https://www.peco.com", phone: "1-800-494-4000", scope: "STATE", states: ["PA"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "PPL Electric", slug: "ppl", category: "UTILITY_ELECTRIC", description: "Electric for central/eastern PA", website: "https://www.pplelectric.com", phone: "1-800-342-5775", scope: "STATE", states: ["PA"], popularityScore: 75, tags: ["electric"] },
  { name: "PA Turnpike E-ZPass", slug: "pa-ezpass", category: "TRANSPORTATION_TOLL", description: "Pennsylvania toll pass", website: "https://www.paturnpike.com/ezpass", scope: "STATE", states: ["PA"], popularityScore: 85, tags: ["toll", "car"] },
  { name: "SEPTA", slug: "septa", category: "TRANSPORTATION_TRANSIT", description: "Southeastern PA Transportation", website: "https://www.septa.org", phone: "1-215-580-7800", scope: "STATE", states: ["PA"], popularityScore: 80, tags: ["transit", "bus", "train"] },

  // ── Illinois ──
  { name: "ComEd", slug: "comed", category: "UTILITY_ELECTRIC", description: "Commonwealth Edison", website: "https://www.comed.com", phone: "1-800-334-7661", scope: "STATE", states: ["IL"], popularityScore: 92, tags: ["electric"] },
  { name: "Peoples Gas", slug: "peoples-gas", category: "UTILITY_GAS", description: "Natural gas for Chicago", website: "https://www.peoplesgasdelivery.com", phone: "1-866-556-6001", scope: "STATE", states: ["IL"], popularityScore: 80, tags: ["gas"] },
  { name: "I-PASS", slug: "ipass", category: "TRANSPORTATION_TOLL", description: "Illinois toll pass", website: "https://www.getipass.com", scope: "STATE", states: ["IL"], popularityScore: 85, tags: ["toll", "car"] },
  { name: "CTA", slug: "cta", category: "TRANSPORTATION_TRANSIT", description: "Chicago Transit Authority", website: "https://www.transitchicago.com", scope: "STATE", states: ["IL"], popularityScore: 90, tags: ["transit", "bus", "train"] },

  // ── Georgia ──
  { name: "Georgia Power", slug: "georgia-power", category: "UTILITY_ELECTRIC", description: "Largest electric utility in GA", website: "https://www.georgiapower.com", phone: "1-888-660-5890", scope: "STATE", states: ["GA"], popularityScore: 92, tags: ["electric"] },
  { name: "Peach Pass", slug: "peach-pass", category: "TRANSPORTATION_TOLL", description: "Georgia toll pass", website: "https://www.peachpass.com", scope: "STATE", states: ["GA"], popularityScore: 80, tags: ["toll", "car"] },
  { name: "MARTA", slug: "marta", category: "TRANSPORTATION_TRANSIT", description: "Metropolitan Atlanta Rapid Transit", website: "https://www.itsmarta.com", scope: "STATE", states: ["GA"], popularityScore: 78, tags: ["transit", "bus", "train"] },

  // ── Ohio ──
  { name: "Ohio Edison", slug: "ohio-edison", category: "UTILITY_ELECTRIC", description: "Electric utility for NE Ohio", website: "https://www.firstenergycorp.com/ohio-edison", scope: "STATE", states: ["OH"], popularityScore: 80, tags: ["electric"] },
  { name: "AEP Ohio", slug: "aep-ohio", category: "UTILITY_ELECTRIC", description: "American Electric Power Ohio", website: "https://www.aepohio.com", phone: "1-800-672-2231", scope: "STATE", states: ["OH"], popularityScore: 78, tags: ["electric"] },
  { name: "Columbia Gas of Ohio", slug: "columbia-gas-oh", category: "UTILITY_GAS", description: "Natural gas utility", website: "https://www.columbiagasohio.com", scope: "STATE", states: ["OH"], popularityScore: 75, tags: ["gas"] },

  // ── Massachusetts ──
  { name: "Eversource", slug: "eversource", category: "UTILITY_ELECTRIC", description: "Electric and gas for New England", website: "https://www.eversource.com", phone: "1-800-592-2000", scope: "STATE", states: ["MA", "CT", "NH"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "National Grid MA", slug: "national-grid-ma", category: "UTILITY_GAS", description: "Gas for Massachusetts", website: "https://www.nationalgridus.com", scope: "STATE", states: ["MA"], popularityScore: 78, tags: ["gas"] },
  { name: "MBTA", slug: "mbta", category: "TRANSPORTATION_TRANSIT", description: "Massachusetts Bay Transportation Authority", website: "https://www.mbta.com", scope: "STATE", states: ["MA"], popularityScore: 88, tags: ["transit", "bus", "train", "subway"] },

  // ── Washington ──
  { name: "Puget Sound Energy", slug: "pse-wa", category: "UTILITY_ELECTRIC", description: "Electric and gas for WA", website: "https://www.pse.com", phone: "1-888-225-5773", scope: "STATE", states: ["WA"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "Seattle City Light", slug: "seattle-city-light", category: "UTILITY_ELECTRIC", description: "City of Seattle electric utility", website: "https://www.seattle.gov/city-light", scope: "STATE", states: ["WA"], popularityScore: 80, tags: ["electric"] },
  { name: "Good To Go!", slug: "good-to-go", category: "TRANSPORTATION_TOLL", description: "Washington state toll pass", website: "https://www.wsdot.wa.gov/goodtogo", scope: "STATE", states: ["WA"], popularityScore: 82, tags: ["toll", "car"] },

  // ── Colorado ──
  { name: "Xcel Energy", slug: "xcel-energy", category: "UTILITY_ELECTRIC", description: "Electric and gas for CO", website: "https://www.xcelenergy.com", phone: "1-800-895-4999", scope: "STATE", states: ["CO", "MN", "WI"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "ExpressToll", slug: "expresstoll", category: "TRANSPORTATION_TOLL", description: "Colorado toll pass", website: "https://www.expresstoll.com", scope: "STATE", states: ["CO"], popularityScore: 80, tags: ["toll", "car"] },
  { name: "RTD", slug: "rtd", category: "TRANSPORTATION_TRANSIT", description: "Regional Transportation District Denver", website: "https://www.rtd-denver.com", scope: "STATE", states: ["CO"], popularityScore: 75, tags: ["transit", "bus", "train"] },

  // ── Arizona ──
  { name: "APS (Arizona Public Service)", slug: "aps-az", category: "UTILITY_ELECTRIC", description: "Largest electric utility in AZ", website: "https://www.aps.com", phone: "1-602-371-7171", scope: "STATE", states: ["AZ"], popularityScore: 90, tags: ["electric"] },
  { name: "SRP (Salt River Project)", slug: "srp-az", category: "UTILITY_ELECTRIC", description: "Electric and water for Phoenix area", website: "https://www.srpnet.com", scope: "STATE", states: ["AZ"], popularityScore: 85, tags: ["electric", "water"] },

  // ── Virginia / DC ──
  { name: "Dominion Energy", slug: "dominion", category: "UTILITY_ELECTRIC", description: "Electric and gas for VA", website: "https://www.dominionenergy.com", phone: "1-866-366-4357", scope: "STATE", states: ["VA", "NC", "SC"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "WMATA (Metro)", slug: "wmata", category: "TRANSPORTATION_TRANSIT", description: "Washington Metropolitan Area Transit", website: "https://www.wmata.com", scope: "STATE", states: ["VA", "DC", "MD"], popularityScore: 85, tags: ["transit", "subway", "bus"] },

  // ── Michigan ──
  { name: "DTE Energy", slug: "dte", category: "UTILITY_ELECTRIC", description: "Electric and gas for SE Michigan", website: "https://www.dteenergy.com", phone: "1-800-477-4747", scope: "STATE", states: ["MI"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Consumers Energy", slug: "consumers-energy", category: "UTILITY_GAS", description: "Gas and electric for MI", website: "https://www.consumersenergy.com", phone: "1-800-477-5050", scope: "STATE", states: ["MI"], popularityScore: 82, tags: ["gas", "electric"] },

  // ── North Carolina ──
  { name: "Duke Energy NC", slug: "duke-nc", category: "UTILITY_ELECTRIC", description: "Electric utility for NC", website: "https://www.duke-energy.com/north-carolina", phone: "1-800-777-9898", scope: "STATE", states: ["NC", "SC"], popularityScore: 88, tags: ["electric"] },
  { name: "Piedmont Natural Gas", slug: "piedmont-ng", category: "UTILITY_GAS", description: "Natural gas for NC/SC/TN", website: "https://www.piedmontng.com", phone: "1-800-752-7504", scope: "STATE", states: ["NC", "SC", "TN"], popularityScore: 75, tags: ["gas"] },
];

async function main() {
  console.log("Seeding service providers...");

  const allProviders = [...FEDERAL_PROVIDERS, ...STATE_PROVIDERS];

  let created = 0;
  let skipped = 0;

  for (const p of allProviders) {
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

  console.log(`Done! Created: ${created}, Skipped: ${skipped}, Total: ${allProviders.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
