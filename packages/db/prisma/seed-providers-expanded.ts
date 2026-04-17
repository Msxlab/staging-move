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
// PART 1: NEW FEDERAL PROVIDERS — filling empty/thin categories
// ============================================================
const FEDERAL_NEW: P[] = [
  // ── FINANCIAL_CREDIT_CARD (was 1, adding 6) ──
  { name: "Synchrony Financial", slug: "synchrony", category: "FINANCIAL_CREDIT_CARD", description: "Store credit cards and financing", website: "https://www.synchrony.com", phone: "1-866-419-4096", scope: "FEDERAL", popularityScore: 72, tags: ["credit-card"] },
  { name: "Barclays US", slug: "barclays-us", category: "FINANCIAL_CREDIT_CARD", description: "Credit cards and personal banking", website: "https://www.barclaysus.com", phone: "1-877-523-0478", scope: "FEDERAL", popularityScore: 68, tags: ["credit-card"] },
  { name: "Credit One Bank", slug: "credit-one", category: "FINANCIAL_CREDIT_CARD", description: "Credit cards for building credit", website: "https://www.creditonebank.com", phone: "1-877-825-3242", scope: "FEDERAL", popularityScore: 58, tags: ["credit-card"] },
  { name: "Citi Cards", slug: "citi-cards", category: "FINANCIAL_CREDIT_CARD", description: "Citibank credit card services", website: "https://www.citi.com/credit-cards", phone: "1-800-950-5114", scope: "FEDERAL", popularityScore: 82, tags: ["credit-card", "banking"] },
  { name: "Chase Credit Cards", slug: "chase-cards", category: "FINANCIAL_CREDIT_CARD", description: "Chase Sapphire, Freedom, and more", website: "https://creditcards.chase.com", phone: "1-800-432-3117", scope: "FEDERAL", popularityScore: 90, tags: ["credit-card", "banking"] },
  { name: "Wells Fargo Cards", slug: "wf-cards", category: "FINANCIAL_CREDIT_CARD", description: "Active Cash, Autograph, Reflect cards", website: "https://www.wellsfargo.com/credit-cards", phone: "1-800-642-4720", scope: "FEDERAL", popularityScore: 78, tags: ["credit-card", "banking"] },

  // ── FINANCIAL_INSURANCE_HOME (was 1, adding 7) ──
  { name: "Travelers Insurance", slug: "travelers", category: "FINANCIAL_INSURANCE_HOME", description: "Home, auto, and business insurance", website: "https://www.travelers.com", phone: "1-800-842-5075", scope: "FEDERAL", popularityScore: 82, tags: ["home", "auto"] },
  { name: "Erie Insurance", slug: "erie-insurance", category: "FINANCIAL_INSURANCE_HOME", description: "Home and auto insurance", website: "https://www.erieinsurance.com", phone: "1-800-458-0811", scope: "FEDERAL", popularityScore: 75, tags: ["home", "auto"] },
  { name: "American Family Insurance", slug: "amfam", category: "FINANCIAL_INSURANCE_HOME", description: "Home, auto, life insurance", website: "https://www.amfam.com", phone: "1-800-692-6326", scope: "FEDERAL", popularityScore: 72, tags: ["home", "auto"] },
  { name: "Farmers Insurance", slug: "farmers", category: "FINANCIAL_INSURANCE_HOME", description: "Home, auto, life, and business", website: "https://www.farmers.com", phone: "1-888-327-6335", scope: "FEDERAL", popularityScore: 78, tags: ["home", "auto", "car"] },
  { name: "Chubb Insurance", slug: "chubb", category: "FINANCIAL_INSURANCE_HOME", description: "Premium property and casualty", website: "https://www.chubb.com", phone: "1-800-252-4670", scope: "FEDERAL", popularityScore: 65, tags: ["home", "luxury"] },
  { name: "Hippo Insurance", slug: "hippo", category: "FINANCIAL_INSURANCE_HOME", description: "Modern home insurance", website: "https://www.hippo.com", phone: "1-800-585-0705", scope: "FEDERAL", popularityScore: 55, tags: ["home"] },
  { name: "State Farm Home", slug: "state-farm-home", category: "FINANCIAL_INSURANCE_HOME", description: "Homeowners and renters insurance", website: "https://www.statefarm.com/insurance/home-and-property", phone: "1-800-782-8332", scope: "FEDERAL", popularityScore: 88, tags: ["home", "renters"] },

  // ── FINANCIAL_MORTGAGE (was 2, adding 6) ──
  { name: "United Wholesale Mortgage", slug: "uwm", category: "FINANCIAL_MORTGAGE", description: "Largest wholesale mortgage lender", website: "https://www.uwm.com", phone: "1-800-981-8898", scope: "FEDERAL", popularityScore: 78, tags: ["mortgage", "home"] },
  { name: "loanDepot", slug: "loandepot", category: "FINANCIAL_MORTGAGE", description: "Non-bank mortgage lender", website: "https://www.loandepot.com", phone: "1-888-983-3240", scope: "FEDERAL", popularityScore: 72, tags: ["mortgage", "home"] },
  { name: "Mr. Cooper", slug: "mr-cooper", category: "FINANCIAL_MORTGAGE", description: "Mortgage servicing and origination", website: "https://www.mrcooper.com", phone: "1-888-480-2432", scope: "FEDERAL", popularityScore: 70, tags: ["mortgage", "home"] },
  { name: "Pennymac", slug: "pennymac", category: "FINANCIAL_MORTGAGE", description: "Mortgage lending and servicing", website: "https://www.pennymac.com", phone: "1-866-549-3583", scope: "FEDERAL", popularityScore: 68, tags: ["mortgage", "home"] },
  { name: "Guaranteed Rate", slug: "guaranteed-rate", category: "FINANCIAL_MORTGAGE", description: "Retail mortgage lender", website: "https://www.rate.com", phone: "1-866-934-7283", scope: "FEDERAL", popularityScore: 65, tags: ["mortgage", "home"] },
  { name: "NewRez", slug: "newrez", category: "FINANCIAL_MORTGAGE", description: "Mortgage solutions", website: "https://www.newrez.com", phone: "1-800-854-2274", scope: "FEDERAL", popularityScore: 60, tags: ["mortgage", "home"] },

  // ── FINANCIAL_LOAN (was 0, adding 7) ──
  { name: "SoFi", slug: "sofi", category: "FINANCIAL_LOAN", description: "Personal loans, student refinancing, investing", website: "https://www.sofi.com", phone: "1-855-456-7634", scope: "FEDERAL", popularityScore: 82, tags: ["loan", "banking"] },
  { name: "LendingClub", slug: "lendingclub", category: "FINANCIAL_LOAN", description: "Personal loans and banking", website: "https://www.lendingclub.com", phone: "1-888-596-3157", scope: "FEDERAL", popularityScore: 72, tags: ["loan"] },
  { name: "Marcus by Goldman Sachs", slug: "marcus", category: "FINANCIAL_LOAN", description: "Personal loans and savings", website: "https://www.marcus.com", phone: "1-855-730-7283", scope: "FEDERAL", popularityScore: 75, tags: ["loan", "banking"] },
  { name: "Upstart", slug: "upstart", category: "FINANCIAL_LOAN", description: "AI-powered personal loans", website: "https://www.upstart.com", scope: "FEDERAL", popularityScore: 62, tags: ["loan"] },
  { name: "Prosper", slug: "prosper", category: "FINANCIAL_LOAN", description: "Peer-to-peer lending platform", website: "https://www.prosper.com", phone: "1-866-615-6319", scope: "FEDERAL", popularityScore: 58, tags: ["loan"] },
  { name: "LightStream", slug: "lightstream", category: "FINANCIAL_LOAN", description: "Low-rate online lending by Truist", website: "https://www.lightstream.com", phone: "1-800-995-5528", scope: "FEDERAL", popularityScore: 68, tags: ["loan", "auto", "home"] },
  { name: "Avant", slug: "avant", category: "FINANCIAL_LOAN", description: "Personal loans for middle-income", website: "https://www.avant.com", phone: "1-800-712-5407", scope: "FEDERAL", popularityScore: 55, tags: ["loan"] },

  // ── HEALTHCARE_DOCTOR (was 0, adding 8) ──
  { name: "One Medical", slug: "one-medical", category: "HEALTHCARE_DOCTOR", description: "Membership-based primary care", website: "https://www.onemedical.com", scope: "FEDERAL", popularityScore: 75, tags: ["health", "doctor"] },
  { name: "Carbon Health", slug: "carbon-health", category: "HEALTHCARE_DOCTOR", description: "Modern primary and urgent care", website: "https://www.carbonhealth.com", scope: "FEDERAL", popularityScore: 65, tags: ["health", "doctor"] },
  { name: "MinuteClinic (CVS)", slug: "minuteclinic", category: "HEALTHCARE_DOCTOR", description: "Walk-in clinics inside CVS stores", website: "https://www.cvs.com/minuteclinic", phone: "1-866-389-2727", scope: "FEDERAL", popularityScore: 80, tags: ["health", "doctor"] },
  { name: "MedExpress", slug: "medexpress", category: "HEALTHCARE_DOCTOR", description: "Urgent care centers by Optum", website: "https://www.medexpress.com", phone: "1-888-759-1868", scope: "FEDERAL", popularityScore: 65, tags: ["health", "doctor"] },
  { name: "Patient First", slug: "patient-first", category: "HEALTHCARE_DOCTOR", description: "Primary and urgent care centers", website: "https://www.patientfirst.com", phone: "1-800-447-8588", scope: "FEDERAL", popularityScore: 60, tags: ["health", "doctor"] },
  { name: "Teladoc Health", slug: "teladoc", category: "HEALTHCARE_DOCTOR", description: "Telehealth / virtual doctor visits", website: "https://www.teladoc.com", phone: "1-800-835-2362", scope: "FEDERAL", popularityScore: 78, tags: ["health", "doctor", "online"] },
  { name: "MDLIVE", slug: "mdlive", category: "HEALTHCARE_DOCTOR", description: "Virtual healthcare visits", website: "https://www.mdlive.com", scope: "FEDERAL", popularityScore: 62, tags: ["health", "doctor", "online"] },
  { name: "ZocDoc", slug: "zocdoc", category: "HEALTHCARE_DOCTOR", description: "Find and book doctors online", website: "https://www.zocdoc.com", scope: "FEDERAL", popularityScore: 72, tags: ["health", "doctor"] },

  // ── HEALTHCARE_DENTIST (was 0, adding 7) ──
  { name: "Aspen Dental", slug: "aspen-dental", category: "HEALTHCARE_DENTIST", description: "Dental care with 1000+ offices", website: "https://www.aspendental.com", phone: "1-844-789-2572", scope: "FEDERAL", popularityScore: 80, tags: ["health", "dental"] },
  { name: "Heartland Dental", slug: "heartland-dental", category: "HEALTHCARE_DENTIST", description: "Dental support organization", website: "https://www.heartland.com", scope: "FEDERAL", popularityScore: 68, tags: ["health", "dental"] },
  { name: "Pacific Dental Services", slug: "pacific-dental", category: "HEALTHCARE_DENTIST", description: "Dentist-led dental support", website: "https://www.pacificdentalservices.com", scope: "FEDERAL", popularityScore: 65, tags: ["health", "dental"] },
  { name: "Gentle Dental", slug: "gentle-dental", category: "HEALTHCARE_DENTIST", description: "Affordable dental care", website: "https://www.gentledental.com", phone: "1-888-274-7252", scope: "FEDERAL", popularityScore: 62, tags: ["health", "dental"] },
  { name: "Western Dental", slug: "western-dental", category: "HEALTHCARE_DENTIST", description: "Dental, orthodontics, oral surgery", website: "https://www.westerndental.com", phone: "1-800-579-3783", scope: "FEDERAL", popularityScore: 58, tags: ["health", "dental"] },
  { name: "Dental365", slug: "dental365", category: "HEALTHCARE_DENTIST", description: "Multi-specialty dental group", website: "https://www.dental365.com", scope: "FEDERAL", popularityScore: 55, tags: ["health", "dental"] },
  { name: "Smile Direct Club", slug: "smiledirect", category: "HEALTHCARE_DENTIST", description: "Clear aligners and dental care", website: "https://www.smiledirectclub.com", scope: "FEDERAL", popularityScore: 60, tags: ["health", "dental"] },

  // ── HEALTHCARE_PHARMACY (adding 4 more) ──
  { name: "Rite Aid", slug: "rite-aid", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and health services", website: "https://www.riteaid.com", phone: "1-800-748-3243", scope: "FEDERAL", popularityScore: 70, tags: ["pharmacy", "health"] },
  { name: "Walmart Pharmacy", slug: "walmart-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Low-cost prescriptions at Walmart", website: "https://www.walmart.com/cp/pharmacy", phone: "1-800-925-6278", scope: "FEDERAL", popularityScore: 82, tags: ["pharmacy", "health"] },
  { name: "Costco Pharmacy", slug: "costco-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Discounted prescriptions at Costco", website: "https://www.costco.com/pharmacy", scope: "FEDERAL", popularityScore: 72, tags: ["pharmacy", "health"] },
  { name: "Amazon Pharmacy", slug: "amazon-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Online pharmacy with Prime savings", website: "https://pharmacy.amazon.com", scope: "FEDERAL", popularityScore: 68, tags: ["pharmacy", "health", "online"] },

  // ── FITNESS_STUDIO (was 0, adding 8) ──
  { name: "Pure Barre", slug: "pure-barre", category: "FITNESS_STUDIO", description: "Barre fitness studios", website: "https://www.purebarre.com", scope: "FEDERAL", popularityScore: 68, tags: ["fitness", "barre"] },
  { name: "Barry's", slug: "barrys", category: "FITNESS_STUDIO", description: "High-intensity interval training", website: "https://www.barrys.com", scope: "FEDERAL", popularityScore: 65, tags: ["fitness", "hiit"] },
  { name: "SoulCycle", slug: "soulcycle", category: "FITNESS_STUDIO", description: "Indoor cycling studios", website: "https://www.soul-cycle.com", scope: "FEDERAL", popularityScore: 62, tags: ["fitness", "cycling"] },
  { name: "CorePower Yoga", slug: "corepower-yoga", category: "FITNESS_STUDIO", description: "Heated yoga studios nationwide", website: "https://www.corepoweryoga.com", scope: "FEDERAL", popularityScore: 70, tags: ["fitness", "yoga"] },
  { name: "F45 Training", slug: "f45", category: "FITNESS_STUDIO", description: "Functional 45-minute workouts", website: "https://www.f45training.com", scope: "FEDERAL", popularityScore: 60, tags: ["fitness", "hiit"] },
  { name: "Club Pilates", slug: "club-pilates", category: "FITNESS_STUDIO", description: "Reformer Pilates studios", website: "https://www.clubpilates.com", scope: "FEDERAL", popularityScore: 65, tags: ["fitness", "pilates"] },
  { name: "CycleBar", slug: "cyclebar", category: "FITNESS_STUDIO", description: "Premium indoor cycling", website: "https://www.cyclebar.com", scope: "FEDERAL", popularityScore: 55, tags: ["fitness", "cycling"] },
  { name: "YogaWorks", slug: "yogaworks", category: "FITNESS_STUDIO", description: "Yoga and pilates classes", website: "https://www.yogaworks.com", scope: "FEDERAL", popularityScore: 52, tags: ["fitness", "yoga"] },

  // ── KIDS_SCHOOL (was 0, adding 7) ──
  { name: "Primrose Schools", slug: "primrose", category: "KIDS_SCHOOL", description: "Accredited early education and care", website: "https://www.primroseschools.com", scope: "FEDERAL", popularityScore: 72, tags: ["kids", "education", "children"] },
  { name: "The Goddard School", slug: "goddard-school", category: "KIDS_SCHOOL", description: "Play-based preschool and childcare", website: "https://www.goddardschool.com", scope: "FEDERAL", popularityScore: 70, tags: ["kids", "education", "children"] },
  { name: "Challenger School", slug: "challenger", category: "KIDS_SCHOOL", description: "Independent private schools", website: "https://www.challengerschool.com", scope: "FEDERAL", popularityScore: 60, tags: ["kids", "education", "children"] },
  { name: "KIPP Public Schools", slug: "kipp", category: "KIDS_SCHOOL", description: "National network of public charter schools", website: "https://www.kipp.org", scope: "FEDERAL", popularityScore: 65, tags: ["kids", "education", "children"] },
  { name: "Sylvan Learning", slug: "sylvan", category: "KIDS_SCHOOL", description: "Tutoring and learning centers", website: "https://www.sylvanlearning.com", phone: "1-888-338-2283", scope: "FEDERAL", popularityScore: 68, tags: ["kids", "education", "children"] },
  { name: "Montessori Schools", slug: "montessori", category: "KIDS_SCHOOL", description: "Montessori method education", website: "https://www.amshq.org", scope: "FEDERAL", popularityScore: 75, tags: ["kids", "education", "children"] },
  { name: "Head Start", slug: "head-start", category: "KIDS_SCHOOL", description: "Federal early childhood education", website: "https://www.acf.hhs.gov/ohs", scope: "FEDERAL", popularityScore: 78, tags: ["kids", "education", "children"] },

  // ── KIDS_ACTIVITY (adding 6 more) ──
  { name: "Mathnasium", slug: "mathnasium", category: "KIDS_ACTIVITY", description: "Math learning centers", website: "https://www.mathnasium.com", scope: "FEDERAL", popularityScore: 65, tags: ["kids", "education", "children"] },
  { name: "The Little Gym", slug: "little-gym", category: "KIDS_ACTIVITY", description: "Gymnastics, dance for kids", website: "https://www.thelittlegym.com", scope: "FEDERAL", popularityScore: 62, tags: ["kids", "children", "fitness"] },
  { name: "Code Ninjas", slug: "code-ninjas", category: "KIDS_ACTIVITY", description: "Coding classes for kids", website: "https://www.codeninjas.com", scope: "FEDERAL", popularityScore: 58, tags: ["kids", "education", "children"] },
  { name: "YMCA", slug: "ymca", category: "KIDS_ACTIVITY", description: "Community programs, youth activities, fitness", website: "https://www.ymca.org", scope: "FEDERAL", popularityScore: 88, tags: ["kids", "fitness", "children"] },
  { name: "Boys & Girls Clubs", slug: "bgca", category: "KIDS_ACTIVITY", description: "Youth development programs", website: "https://www.bgca.org", scope: "FEDERAL", popularityScore: 82, tags: ["kids", "children"] },
  { name: "Goldfish Swim School", slug: "goldfish-swim", category: "KIDS_ACTIVITY", description: "Swimming lessons for kids", website: "https://www.goldfishswimschool.com", scope: "FEDERAL", popularityScore: 60, tags: ["kids", "children", "fitness"] },

  // ── TRANSPORTATION_PARKING (was 0, adding 6) ──
  { name: "ParkMobile", slug: "parkmobile", category: "TRANSPORTATION_PARKING", description: "Contactless parking payments", website: "https://www.parkmobile.io", scope: "FEDERAL", popularityScore: 82, tags: ["parking", "car"] },
  { name: "SpotHero", slug: "spothero", category: "TRANSPORTATION_PARKING", description: "Find and reserve parking spots", website: "https://www.spothero.com", scope: "FEDERAL", popularityScore: 75, tags: ["parking", "car"] },
  { name: "ParkWhiz", slug: "parkwhiz", category: "TRANSPORTATION_PARKING", description: "Parking reservations nationwide", website: "https://www.parkwhiz.com", scope: "FEDERAL", popularityScore: 62, tags: ["parking", "car"] },
  { name: "SP+ Parking", slug: "sp-plus", category: "TRANSPORTATION_PARKING", description: "Parking management solutions", website: "https://www.spplus.com", scope: "FEDERAL", popularityScore: 65, tags: ["parking", "car"] },
  { name: "LAZ Parking", slug: "laz-parking", category: "TRANSPORTATION_PARKING", description: "Parking management nationwide", website: "https://www.lazparking.com", scope: "FEDERAL", popularityScore: 58, tags: ["parking", "car"] },
  { name: "PayByPhone", slug: "paybyphone", category: "TRANSPORTATION_PARKING", description: "Parking meter payment app", website: "https://www.paybyphone.com", scope: "FEDERAL", popularityScore: 70, tags: ["parking", "car"] },

  // ── HOUSING_RENT (was 0, adding 7) ──
  { name: "Zillow Rentals", slug: "zillow-rent", category: "HOUSING_RENT", description: "Apartments, houses for rent", website: "https://www.zillow.com/homes/for_rent", scope: "FEDERAL", popularityScore: 92, tags: ["rent", "home"] },
  { name: "Apartments.com", slug: "apartments-com", category: "HOUSING_RENT", description: "Largest apartment listing site", website: "https://www.apartments.com", scope: "FEDERAL", popularityScore: 90, tags: ["rent", "home"] },
  { name: "Rent.com", slug: "rent-com", category: "HOUSING_RENT", description: "Apartment and home rentals", website: "https://www.rent.com", scope: "FEDERAL", popularityScore: 78, tags: ["rent", "home"] },
  { name: "Realtor.com Rentals", slug: "realtor-rent", category: "HOUSING_RENT", description: "Rental listings nationwide", website: "https://www.realtor.com/rentals", scope: "FEDERAL", popularityScore: 80, tags: ["rent", "home"] },
  { name: "Redfin Rentals", slug: "redfin-rent", category: "HOUSING_RENT", description: "Real estate and rental listings", website: "https://www.redfin.com/rentals", scope: "FEDERAL", popularityScore: 75, tags: ["rent", "home"] },
  { name: "Trulia Rentals", slug: "trulia-rent", category: "HOUSING_RENT", description: "Apartment and home search", website: "https://www.trulia.com/for_rent", scope: "FEDERAL", popularityScore: 72, tags: ["rent", "home"] },
  { name: "HotPads", slug: "hotpads", category: "HOUSING_RENT", description: "Map-based apartment search", website: "https://www.hotpads.com", scope: "FEDERAL", popularityScore: 65, tags: ["rent", "home"] },

  // ── HOUSING_HOA (was 0, adding 6) ──
  { name: "FirstService Residential", slug: "firstservice", category: "HOUSING_HOA", description: "Largest HOA management in North America", website: "https://www.fsresidential.com", scope: "FEDERAL", popularityScore: 80, tags: ["hoa", "home"] },
  { name: "Associa", slug: "associa", category: "HOUSING_HOA", description: "Community management company", website: "https://www.associaonline.com", phone: "1-800-808-4882", scope: "FEDERAL", popularityScore: 75, tags: ["hoa", "home"] },
  { name: "RealManage", slug: "realmanage", category: "HOUSING_HOA", description: "HOA and community management", website: "https://www.realmanage.com", scope: "FEDERAL", popularityScore: 62, tags: ["hoa", "home"] },
  { name: "AppFolio", slug: "appfolio", category: "HOUSING_HOA", description: "Property management software", website: "https://www.appfolio.com", scope: "FEDERAL", popularityScore: 68, tags: ["hoa", "home"] },
  { name: "Buildium", slug: "buildium", category: "HOUSING_HOA", description: "HOA and property management platform", website: "https://www.buildium.com", scope: "FEDERAL", popularityScore: 60, tags: ["hoa", "home"] },
  { name: "Vantaca", slug: "vantaca", category: "HOUSING_HOA", description: "HOA management technology", website: "https://www.vantaca.com", scope: "FEDERAL", popularityScore: 55, tags: ["hoa", "home"] },

  // ── HOUSING_LAWN_CARE (was 0, adding 7) ──
  { name: "TruGreen", slug: "trugreen", category: "HOUSING_LAWN_CARE", description: "America's #1 lawn care company", website: "https://www.trugreen.com", phone: "1-800-464-0171", scope: "FEDERAL", popularityScore: 88, tags: ["lawn", "home"] },
  { name: "Lawn Doctor", slug: "lawn-doctor", category: "HOUSING_LAWN_CARE", description: "Lawn care and pest control", website: "https://www.lawndoctor.com", phone: "1-800-845-0580", scope: "FEDERAL", popularityScore: 72, tags: ["lawn", "home"] },
  { name: "Weed Man", slug: "weed-man", category: "HOUSING_LAWN_CARE", description: "Lawn care and weed control", website: "https://www.weedmanusa.com", scope: "FEDERAL", popularityScore: 65, tags: ["lawn", "home"] },
  { name: "SavATree", slug: "savatree", category: "HOUSING_LAWN_CARE", description: "Tree and lawn care services", website: "https://www.savatree.com", phone: "1-888-341-0035", scope: "FEDERAL", popularityScore: 60, tags: ["lawn", "home"] },
  { name: "BrightView", slug: "brightview", category: "HOUSING_LAWN_CARE", description: "Commercial landscaping services", website: "https://www.brightview.com", scope: "FEDERAL", popularityScore: 62, tags: ["lawn", "home"] },
  { name: "Sunday Lawn Care", slug: "sunday-lawn", category: "HOUSING_LAWN_CARE", description: "Custom lawn care plans delivered", website: "https://www.sundayapp.com", scope: "FEDERAL", popularityScore: 55, tags: ["lawn", "home"] },
  { name: "Davey Tree", slug: "davey-tree", category: "HOUSING_LAWN_CARE", description: "Tree care and landscaping since 1880", website: "https://www.davey.com", phone: "1-800-445-8733", scope: "FEDERAL", popularityScore: 58, tags: ["lawn", "home"] },

  // ── HOUSING_PEST_CONTROL (was 0, adding 7) ──
  { name: "Terminix", slug: "terminix", category: "HOUSING_PEST_CONTROL", description: "Termite and pest control leader", website: "https://www.terminix.com", phone: "1-866-569-4035", scope: "FEDERAL", popularityScore: 88, tags: ["pest", "home"] },
  { name: "Orkin", slug: "orkin", category: "HOUSING_PEST_CONTROL", description: "Pest control since 1901", website: "https://www.orkin.com", phone: "1-877-233-3125", scope: "FEDERAL", popularityScore: 90, tags: ["pest", "home"] },
  { name: "Rentokil (Ehrlich)", slug: "rentokil", category: "HOUSING_PEST_CONTROL", description: "Global pest control services", website: "https://www.rentokil.com/us", phone: "1-800-837-5520", scope: "FEDERAL", popularityScore: 72, tags: ["pest", "home"] },
  { name: "Aptive Environmental", slug: "aptive", category: "HOUSING_PEST_CONTROL", description: "Eco-friendly pest control", website: "https://www.aptive.com", phone: "1-855-426-0518", scope: "FEDERAL", popularityScore: 65, tags: ["pest", "home"] },
  { name: "ABC Home & Commercial", slug: "abc-pest", category: "HOUSING_PEST_CONTROL", description: "Pest, lawn, and home services", website: "https://www.abcnow.com", scope: "FEDERAL", popularityScore: 60, tags: ["pest", "home"] },
  { name: "HomeTeam Pest Defense", slug: "hometeam", category: "HOUSING_PEST_CONTROL", description: "Residential pest control", website: "https://www.pestdefense.com", phone: "1-877-461-7378", scope: "FEDERAL", popularityScore: 58, tags: ["pest", "home"] },
  { name: "Truly Nolen", slug: "truly-nolen", category: "HOUSING_PEST_CONTROL", description: "Environmentally responsible pest control", website: "https://www.trulynolen.com", phone: "1-888-832-4705", scope: "FEDERAL", popularityScore: 55, tags: ["pest", "home"] },

  // ── HOUSING_STORAGE (was 0, adding 7) ──
  { name: "Public Storage", slug: "public-storage", category: "HOUSING_STORAGE", description: "Largest self-storage company in the world", website: "https://www.publicstorage.com", phone: "1-800-688-8057", scope: "FEDERAL", popularityScore: 92, tags: ["storage", "home"] },
  { name: "Extra Space Storage", slug: "extra-space", category: "HOUSING_STORAGE", description: "Self-storage units nationwide", website: "https://www.extraspace.com", phone: "1-888-897-5575", scope: "FEDERAL", popularityScore: 88, tags: ["storage", "home"] },
  { name: "CubeSmart", slug: "cubesmart", category: "HOUSING_STORAGE", description: "Self-storage solutions", website: "https://www.cubesmart.com", phone: "1-877-279-7585", scope: "FEDERAL", popularityScore: 78, tags: ["storage", "home"] },
  { name: "Life Storage", slug: "life-storage", category: "HOUSING_STORAGE", description: "Storage units and moving", website: "https://www.lifestorage.com", phone: "1-844-302-3392", scope: "FEDERAL", popularityScore: 75, tags: ["storage", "home"] },
  { name: "U-Haul Storage", slug: "uhaul-storage", category: "HOUSING_STORAGE", description: "Moving and self-storage", website: "https://www.uhaul.com/Storage", phone: "1-800-468-4285", scope: "FEDERAL", popularityScore: 82, tags: ["storage", "home"] },
  { name: "PODS", slug: "pods", category: "HOUSING_STORAGE", description: "Portable on-demand storage", website: "https://www.pods.com", phone: "1-855-706-4758", scope: "FEDERAL", popularityScore: 80, tags: ["storage", "home"] },
  { name: "1-800-PACK-RAT", slug: "packrat", category: "HOUSING_STORAGE", description: "Portable storage containers", website: "https://www.1800packrat.com", phone: "1-800-722-5728", scope: "FEDERAL", popularityScore: 65, tags: ["storage", "home"] },

  // ── SHOPPING_RETAIL (was 0, adding 8) ──
  { name: "Walmart", slug: "walmart", category: "SHOPPING_RETAIL", description: "Everyday low prices, groceries and more", website: "https://www.walmart.com", phone: "1-800-925-6278", scope: "FEDERAL", popularityScore: 98, tags: ["shopping", "grocery"] },
  { name: "Target", slug: "target", category: "SHOPPING_RETAIL", description: "Expect more, pay less", website: "https://www.target.com", phone: "1-800-440-0680", scope: "FEDERAL", popularityScore: 92, tags: ["shopping", "grocery"] },
  { name: "Home Depot", slug: "home-depot", category: "SHOPPING_RETAIL", description: "Home improvement supplies", website: "https://www.homedepot.com", phone: "1-800-466-3337", scope: "FEDERAL", popularityScore: 90, tags: ["shopping", "home"] },
  { name: "Lowe's", slug: "lowes", category: "SHOPPING_RETAIL", description: "Home improvement retailer", website: "https://www.lowes.com", phone: "1-800-445-6937", scope: "FEDERAL", popularityScore: 88, tags: ["shopping", "home"] },
  { name: "Best Buy", slug: "best-buy", category: "SHOPPING_RETAIL", description: "Electronics and technology", website: "https://www.bestbuy.com", phone: "1-888-237-8289", scope: "FEDERAL", popularityScore: 85, tags: ["shopping"] },
  { name: "Kroger", slug: "kroger", category: "SHOPPING_RETAIL", description: "Grocery chain in 35 states", website: "https://www.kroger.com", phone: "1-800-576-4377", scope: "FEDERAL", popularityScore: 85, tags: ["shopping", "grocery"] },
  { name: "IKEA", slug: "ikea", category: "SHOPPING_RETAIL", description: "Furniture and home goods", website: "https://www.ikea.com/us", phone: "1-888-888-4532", scope: "FEDERAL", popularityScore: 82, tags: ["shopping", "home"] },
  { name: "Bed Bath & Beyond", slug: "bbb", category: "SHOPPING_RETAIL", description: "Home goods and furnishing (Overstock)", website: "https://www.overstock.com", scope: "FEDERAL", popularityScore: 65, tags: ["shopping", "home"] },

  // ── UTILITY_SEWER (was 0, adding 2 federal) ──
  { name: "Veolia North America", slug: "veolia", category: "UTILITY_SEWER", description: "Water and wastewater management", website: "https://www.veolianorthamerica.com", scope: "FEDERAL", popularityScore: 65, tags: ["sewer", "water"] },
  { name: "American Water (Sewer)", slug: "amwater-sewer", category: "UTILITY_SEWER", description: "Wastewater services nationwide", website: "https://www.amwater.com", phone: "1-800-272-1325", scope: "FEDERAL", popularityScore: 70, tags: ["sewer", "water"] },

  // ── MORE SUBSCRIPTIONS ──
  { name: "HBO Max", slug: "hbo-max", category: "SHOPPING_SUBSCRIPTION", description: "Streaming from HBO, Warner Bros", website: "https://www.max.com", scope: "FEDERAL", popularityScore: 82, tags: ["subscription", "streaming"] },
  { name: "Paramount+", slug: "paramount-plus", category: "SHOPPING_SUBSCRIPTION", description: "CBS, Paramount streaming", website: "https://www.paramountplus.com", scope: "FEDERAL", popularityScore: 68, tags: ["subscription", "streaming"] },
  { name: "Peacock", slug: "peacock", category: "SHOPPING_SUBSCRIPTION", description: "NBCUniversal streaming", website: "https://www.peacocktv.com", scope: "FEDERAL", popularityScore: 65, tags: ["subscription", "streaming"] },
  { name: "Apple Music", slug: "apple-music", category: "SHOPPING_SUBSCRIPTION", description: "Music streaming by Apple", website: "https://www.apple.com/apple-music", scope: "FEDERAL", popularityScore: 78, tags: ["subscription", "music"] },
  { name: "YouTube Premium", slug: "youtube-premium", category: "SHOPPING_SUBSCRIPTION", description: "Ad-free YouTube + Music", website: "https://www.youtube.com/premium", scope: "FEDERAL", popularityScore: 72, tags: ["subscription", "streaming", "music"] },
  { name: "BJ's Wholesale", slug: "bjs", category: "SHOPPING_SUBSCRIPTION", description: "Wholesale club membership", website: "https://www.bjs.com", scope: "FEDERAL", popularityScore: 62, tags: ["subscription", "shopping"] },

  // ── MORE VET ──
  { name: "PetSmart Veterinary", slug: "petsmart-vet", category: "HEALTHCARE_VET", description: "Vet services inside PetSmart", website: "https://www.petsmart.com/vet", scope: "FEDERAL", popularityScore: 68, tags: ["pet", "vet", "dog", "cat"] },
  { name: "Petco Veterinary", slug: "petco-vet", category: "HEALTHCARE_VET", description: "Vet hospitals inside Petco", website: "https://www.petco.com/vetcare", scope: "FEDERAL", popularityScore: 65, tags: ["pet", "vet", "dog", "cat"] },

  // ── MORE DAYCARE ──
  { name: "Learning Care Group", slug: "learning-care", category: "KIDS_DAYCARE", description: "Childtime, La Petite Academy", website: "https://www.learningcaregroup.com", scope: "FEDERAL", popularityScore: 60, tags: ["kids", "daycare", "children"] },
  { name: "Primrose Schools (Daycare)", slug: "primrose-daycare", category: "KIDS_DAYCARE", description: "Early education and childcare", website: "https://www.primroseschools.com", scope: "FEDERAL", popularityScore: 68, tags: ["kids", "daycare", "children"] },
];

// ============================================================
// PART 2: MULTI-STATE PROVIDERS — Internet, Grocery, Sewer
// ============================================================
const MULTI_STATE: P[] = [
  // ── Internet ISPs (regional) ──
  { name: "Cox Communications", slug: "cox", category: "UTILITY_INTERNET", description: "Internet, TV, phone", website: "https://www.cox.com", phone: "1-800-234-3993", scope: "STATE", states: ["AZ", "AR", "CA", "CT", "FL", "GA", "ID", "IA", "KS", "LA", "NE", "NV", "OH", "OK", "RI", "VA"], popularityScore: 80, tags: ["internet", "cable", "tv"] },
  { name: "Frontier Communications", slug: "frontier", category: "UTILITY_INTERNET", description: "Fiber and DSL internet", website: "https://www.frontier.com", phone: "1-855-575-0432", scope: "STATE", states: ["AL", "AZ", "CA", "CT", "FL", "IL", "IN", "IA", "MN", "MS", "NE", "NV", "NM", "NY", "NC", "OH", "OR", "PA", "SC", "TN", "TX", "UT", "WA", "WV", "WI"], popularityScore: 68, tags: ["internet", "fiber"] },
  { name: "CenturyLink (Lumen)", slug: "centurylink", category: "UTILITY_INTERNET", description: "Internet and fiber by Lumen", website: "https://www.centurylink.com", phone: "1-855-454-8739", scope: "STATE", states: ["AL", "AZ", "AR", "CO", "FL", "GA", "ID", "IL", "IN", "IA", "KS", "LA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NM", "NC", "ND", "OH", "OK", "OR", "PA", "SC", "SD", "TN", "TX", "UT", "VA", "WA", "WI", "WY"], popularityScore: 72, tags: ["internet", "fiber"] },
  { name: "Mediacom", slug: "mediacom", category: "UTILITY_INTERNET", description: "Cable internet and TV", website: "https://www.mediacomcable.com", phone: "1-855-633-4226", scope: "STATE", states: ["AL", "AZ", "CA", "DE", "FL", "GA", "IA", "IL", "IN", "KS", "KY", "MD", "MN", "MO", "MS", "NC", "OH", "SD", "WI"], popularityScore: 58, tags: ["internet", "cable"] },
  { name: "WOW! Internet", slug: "wow-internet", category: "UTILITY_INTERNET", description: "Wide Open West internet", website: "https://www.wowway.com", phone: "1-866-496-9669", scope: "STATE", states: ["AL", "FL", "GA", "IL", "IN", "MI", "OH", "SC", "TN"], popularityScore: 55, tags: ["internet", "cable"] },
  { name: "Consolidated Communications", slug: "consolidated-comm", category: "UTILITY_INTERNET", description: "Fiber and broadband internet", website: "https://www.consolidated.com", phone: "1-844-968-7224", scope: "STATE", states: ["CA", "IL", "KS", "ME", "MN", "MO", "NH", "NY", "OH", "PA", "TX", "VT"], popularityScore: 52, tags: ["internet", "fiber"] },
  { name: "Windstream", slug: "windstream", category: "UTILITY_INTERNET", description: "Internet and phone services", website: "https://www.windstream.com", phone: "1-888-292-2104", scope: "STATE", states: ["AL", "AR", "FL", "GA", "IA", "KY", "MO", "MS", "NE", "NM", "NC", "NY", "OH", "OK", "PA", "SC", "TX"], popularityScore: 50, tags: ["internet"] },
  { name: "Sparklight", slug: "sparklight", category: "UTILITY_INTERNET", description: "Cable internet (formerly Cable One)", website: "https://www.sparklight.com", phone: "1-877-692-2253", scope: "STATE", states: ["AL", "AR", "AZ", "ID", "IL", "IN", "KS", "LA", "MO", "MS", "NE", "NM", "ND", "OK", "OR", "SD", "TN", "TX", "WA"], popularityScore: 48, tags: ["internet", "cable"] },
  { name: "Google Fiber", slug: "google-fiber", category: "UTILITY_INTERNET", description: "Gigabit fiber internet by Google", website: "https://fiber.google.com", scope: "STATE", states: ["TX", "NC", "TN", "GA", "MO", "KS", "UT", "CO", "AZ", "NE", "NV", "IA"], popularityScore: 78, tags: ["internet", "fiber"] },
  { name: "Astound Broadband", slug: "astound", category: "UTILITY_INTERNET", description: "Cable and fiber internet", website: "https://www.astound.com", scope: "STATE", states: ["CA", "CT", "DC", "DE", "IL", "IN", "MA", "MD", "MN", "NJ", "NY", "OH", "OR", "PA", "TX", "VA", "WA"], popularityScore: 55, tags: ["internet", "cable"] },
  { name: "Breezeline", slug: "breezeline", category: "UTILITY_INTERNET", description: "Cable internet (formerly Atlantic Broadband)", website: "https://www.breezeline.com", scope: "STATE", states: ["CT", "DE", "FL", "MD", "ME", "NH", "NY", "OH", "PA", "SC", "VA", "WV"], popularityScore: 50, tags: ["internet", "cable"] },

  // ── Regional Grocery / Retail ──
  { name: "Publix", slug: "publix", category: "SHOPPING_RETAIL", description: "Employee-owned supermarket chain", website: "https://www.publix.com", scope: "STATE", states: ["FL", "GA", "AL", "SC", "NC", "TN", "VA"], popularityScore: 92, tags: ["shopping", "grocery"] },
  { name: "H-E-B", slug: "heb", category: "SHOPPING_RETAIL", description: "Texas-based supermarket chain", website: "https://www.heb.com", scope: "STATE", states: ["TX"], popularityScore: 95, tags: ["shopping", "grocery"] },
  { name: "Wegmans", slug: "wegmans", category: "SHOPPING_RETAIL", description: "Family-owned supermarket", website: "https://www.wegmans.com", scope: "STATE", states: ["NY", "NJ", "PA", "MA", "MD", "VA", "NC", "DE"], popularityScore: 85, tags: ["shopping", "grocery"] },
  { name: "Meijer", slug: "meijer", category: "SHOPPING_RETAIL", description: "Midwest supercenter chain", website: "https://www.meijer.com", scope: "STATE", states: ["MI", "OH", "IN", "IL", "WI", "KY"], popularityScore: 78, tags: ["shopping", "grocery"] },
  { name: "Hy-Vee", slug: "hy-vee", category: "SHOPPING_RETAIL", description: "Midwest supermarket chain", website: "https://www.hy-vee.com", scope: "STATE", states: ["IA", "IL", "KS", "MN", "MO", "NE", "SD", "WI"], popularityScore: 75, tags: ["shopping", "grocery"] },
  { name: "WinCo Foods", slug: "winco", category: "SHOPPING_RETAIL", description: "Employee-owned discount grocery", website: "https://www.wincofoods.com", scope: "STATE", states: ["ID", "NV", "OR", "WA", "CA", "AZ", "UT", "TX", "MT", "OK"], popularityScore: 72, tags: ["shopping", "grocery"] },
  { name: "ShopRite", slug: "shoprite", category: "SHOPPING_RETAIL", description: "Northeast supermarket cooperative", website: "https://www.shoprite.com", scope: "STATE", states: ["NJ", "NY", "CT", "PA", "DE", "MD"], popularityScore: 80, tags: ["shopping", "grocery"] },
  { name: "Giant Food", slug: "giant-food", category: "SHOPPING_RETAIL", description: "Mid-Atlantic grocery chain", website: "https://www.giantfood.com", scope: "STATE", states: ["MD", "VA", "DC", "DE", "PA"], popularityScore: 78, tags: ["shopping", "grocery"] },
  { name: "Stop & Shop", slug: "stop-shop", category: "SHOPPING_RETAIL", description: "New England supermarket chain", website: "https://www.stopandshop.com", scope: "STATE", states: ["CT", "MA", "NJ", "NY", "RI"], popularityScore: 75, tags: ["shopping", "grocery"] },
  { name: "Fred Meyer", slug: "fred-meyer", category: "SHOPPING_RETAIL", description: "One-stop shopping in Pacific NW", website: "https://www.fredmeyer.com", scope: "STATE", states: ["OR", "WA", "AK", "ID"], popularityScore: 72, tags: ["shopping", "grocery"] },
  { name: "Safeway", slug: "safeway", category: "SHOPPING_RETAIL", description: "Grocery chain in western US", website: "https://www.safeway.com", scope: "STATE", states: ["AK", "AZ", "CA", "CO", "DC", "DE", "HI", "ID", "MD", "MT", "NE", "NM", "NV", "OR", "SD", "VA", "WA", "WY"], popularityScore: 80, tags: ["shopping", "grocery"] },
  { name: "Albertsons", slug: "albertsons", category: "SHOPPING_RETAIL", description: "Grocery store chain", website: "https://www.albertsons.com", scope: "STATE", states: ["AR", "AZ", "CA", "CO", "ID", "LA", "MT", "NE", "NV", "NM", "ND", "OR", "SD", "TX", "UT", "WA", "WY"], popularityScore: 78, tags: ["shopping", "grocery"] },
  { name: "Trader Joe's", slug: "trader-joes", category: "SHOPPING_RETAIL", description: "Specialty grocery chain", website: "https://www.traderjoes.com", scope: "FEDERAL", popularityScore: 88, tags: ["shopping", "grocery"] },
  { name: "Whole Foods Market", slug: "whole-foods", category: "SHOPPING_RETAIL", description: "Natural and organic foods by Amazon", website: "https://www.wholefoodsmarket.com", scope: "FEDERAL", popularityScore: 82, tags: ["shopping", "grocery"] },
  { name: "Aldi", slug: "aldi", category: "SHOPPING_RETAIL", description: "Discount grocery stores", website: "https://www.aldi.us", scope: "FEDERAL", popularityScore: 85, tags: ["shopping", "grocery", "budget"] },

  // ── MORE STATE-LEVEL UTILITIES (filling gaps) ──
  // Sewer services for major metro areas
  { name: "DC Water & Sewer", slug: "dc-sewer", category: "UTILITY_SEWER", description: "Wastewater for Washington DC", website: "https://www.dcwater.com", scope: "STATE", states: ["DC"], popularityScore: 80, tags: ["sewer", "water"] },
  { name: "NYC DEP Sewer", slug: "nyc-sewer", category: "UTILITY_SEWER", description: "NYC wastewater and stormwater", website: "https://www1.nyc.gov/site/dep", scope: "STATE", states: ["NY"], popularityScore: 82, tags: ["sewer", "water"] },
  { name: "LA Sanitation", slug: "la-sanitation", category: "UTILITY_SEWER", description: "LA wastewater and solid waste", website: "https://www.lacitysan.org", scope: "STATE", states: ["CA"], popularityScore: 78, tags: ["sewer", "water"] },
  { name: "Metropolitan Sewer District (MSD)", slug: "msd-ky", category: "UTILITY_SEWER", description: "Louisville sewer services", website: "https://www.louisvillemsd.org", scope: "STATE", states: ["KY"], popularityScore: 72, tags: ["sewer", "water"] },
  { name: "MWRD Chicago", slug: "mwrd-il", category: "UTILITY_SEWER", description: "Chicago metropolitan water reclamation", website: "https://www.mwrd.org", scope: "STATE", states: ["IL"], popularityScore: 75, tags: ["sewer", "water"] },
  { name: "ALCOSAN", slug: "alcosan-pa", category: "UTILITY_SEWER", description: "Allegheny County sewer authority", website: "https://www.alcosan.org", scope: "STATE", states: ["PA"], popularityScore: 70, tags: ["sewer", "water"] },
  { name: "Miami-Dade Water & Sewer", slug: "mdws-fl", category: "UTILITY_SEWER", description: "South Florida wastewater", website: "https://www.miamidade.gov/water", scope: "STATE", states: ["FL"], popularityScore: 78, tags: ["sewer", "water"] },
  { name: "Northeast Ohio Regional Sewer", slug: "neorsd", category: "UTILITY_SEWER", description: "Cleveland area sewer district", website: "https://www.neorsd.org", scope: "STATE", states: ["OH"], popularityScore: 70, tags: ["sewer", "water"] },
  { name: "Houston Public Works Sewer", slug: "houston-sewer", category: "UTILITY_SEWER", description: "Houston wastewater services", website: "https://www.publicworks.houstontx.gov", scope: "STATE", states: ["TX"], popularityScore: 75, tags: ["sewer", "water"] },
  { name: "King County Sewer (WA)", slug: "king-sewer-wa", category: "UTILITY_SEWER", description: "Seattle area wastewater", website: "https://www.kingcounty.gov/wtd", scope: "STATE", states: ["WA"], popularityScore: 72, tags: ["sewer", "water"] },

  // ── More state toll passes (missing states) ──
  { name: "NC Quick Pass", slug: "nc-quickpass", category: "TRANSPORTATION_TOLL", description: "North Carolina toll pass", website: "https://www.ncquickpass.com", scope: "STATE", states: ["NC"], popularityScore: 78, tags: ["toll", "car"] },
  { name: "TollTag (North TX)", slug: "ntta-tolltag", category: "TRANSPORTATION_TOLL", description: "North Texas Tollway Authority", website: "https://www.ntta.org", scope: "STATE", states: ["TX"], popularityScore: 82, tags: ["toll", "car"] },
  { name: "SunPass FL", slug: "sunpass-extra", category: "TRANSPORTATION_TOLL", description: "Florida prepaid toll program", website: "https://www.sunpass.com", scope: "STATE", states: ["FL"], popularityScore: 88, tags: ["toll", "car"] },
  { name: "RiverLink", slug: "riverlink", category: "TRANSPORTATION_TOLL", description: "Ohio River bridge tolls KY/IN", website: "https://www.riverlink.com", scope: "STATE", states: ["KY", "IN"], popularityScore: 72, tags: ["toll", "car"] },
  { name: "NH E-ZPass", slug: "nh-ezpass", category: "TRANSPORTATION_TOLL", description: "New Hampshire toll pass", website: "https://www.ezpassnh.com", scope: "STATE", states: ["NH"], popularityScore: 75, tags: ["toll", "car"] },
  { name: "ME Turnpike E-ZPass", slug: "me-ezpass", category: "TRANSPORTATION_TOLL", description: "Maine turnpike toll pass", website: "https://www.maineturnpike.com", scope: "STATE", states: ["ME"], popularityScore: 72, tags: ["toll", "car"] },
  { name: "MA E-ZPass", slug: "ma-ezpass", category: "TRANSPORTATION_TOLL", description: "Massachusetts toll pass", website: "https://www.ezdrivema.com", scope: "STATE", states: ["MA"], popularityScore: 85, tags: ["toll", "car"] },

  // ── More transit ──
  { name: "METRO Houston", slug: "metro-houston", category: "TRANSPORTATION_TRANSIT", description: "Houston Metro transit", website: "https://www.ridemetro.org", scope: "STATE", states: ["TX"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "VIA Metropolitan Transit", slug: "via-sa", category: "TRANSPORTATION_TRANSIT", description: "San Antonio transit", website: "https://www.viainfo.net", scope: "STATE", states: ["TX"], popularityScore: 65, tags: ["transit", "bus"] },
  { name: "King County Metro", slug: "kcm-wa", category: "TRANSPORTATION_TRANSIT", description: "Seattle area transit", website: "https://www.kingcounty.gov/metro", scope: "STATE", states: ["WA"], popularityScore: 82, tags: ["transit", "bus"] },
  { name: "Valley Metro", slug: "valley-metro-az", category: "TRANSPORTATION_TRANSIT", description: "Phoenix area transit", website: "https://www.valleymetro.org", scope: "STATE", states: ["AZ"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "COTA", slug: "cota-oh", category: "TRANSPORTATION_TRANSIT", description: "Central Ohio Transit Authority", website: "https://www.cota.com", scope: "STATE", states: ["OH"], popularityScore: 68, tags: ["transit", "bus"] },
  { name: "GRTC", slug: "grtc-va", category: "TRANSPORTATION_TRANSIT", description: "Greater Richmond Transit", website: "https://www.ridegrtc.com", scope: "STATE", states: ["VA"], popularityScore: 62, tags: ["transit", "bus"] },
  { name: "CATS Charlotte", slug: "cats-nc", category: "TRANSPORTATION_TRANSIT", description: "Charlotte Area Transit System", website: "https://www.charlottenc.gov/cats", scope: "STATE", states: ["NC"], popularityScore: 70, tags: ["transit", "bus", "train"] },
  { name: "JTA Jacksonville", slug: "jta-fl", category: "TRANSPORTATION_TRANSIT", description: "Jacksonville Transportation Authority", website: "https://www.jtafla.com", scope: "STATE", states: ["FL"], popularityScore: 60, tags: ["transit", "bus"] },
  { name: "SORTA/Metro Cincinnati", slug: "metro-cin", category: "TRANSPORTATION_TRANSIT", description: "Cincinnati Metro bus system", website: "https://www.go-metro.com", scope: "STATE", states: ["OH"], popularityScore: 62, tags: ["transit", "bus"] },
  { name: "RTA Cleveland", slug: "rta-cle", category: "TRANSPORTATION_TRANSIT", description: "Greater Cleveland Regional Transit", website: "https://www.riderta.com", scope: "STATE", states: ["OH"], popularityScore: 68, tags: ["transit", "bus", "train"] },
];

// ============================================================
// RUN SEED
// ============================================================
async function main() {
  console.log("Seeding expanded providers...");

  const all = [...FEDERAL_NEW, ...MULTI_STATE];
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

  console.log(`\nExpanded seed done!`);
  console.log(`Created: ${created}, Skipped (duplicate slug): ${skipped}`);
  console.log(`Providers in this file: ${all.length}`);

  // Summary
  const total = await prisma.serviceProvider.count();
  console.log(`\nTotal providers in DB: ${total}`);

  // Category coverage
  const allRows = await prisma.serviceProvider.findMany({ select: { category: true } });
  const catCount: Record<string, number> = {};
  allRows.forEach((r: { category: string }) => {
    catCount[r.category] = (catCount[r.category] || 0) + 1;
  });
  console.log(`\nCategory coverage:`);
  Object.entries(catCount).sort((a, b) => a[0].localeCompare(b[0])).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  // State coverage
  const stateRows = await prisma.serviceProvider.findMany({ where: { scope: "STATE" }, select: { states: true } });
  const stateSet = new Set<string>();
  stateRows.forEach((r: { states: string }) => {
    try { JSON.parse(r.states).forEach((s: string) => stateSet.add(s)); } catch {}
  });
  console.log(`\nStates covered: ${stateSet.size} (${Array.from(stateSet).sort().join(", ")})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
