// ============================================================
// CONSOLIDATED PROVIDER DATA — Single Source of Truth
// All providers from seed-providers.ts, seed-providers-government.ts,
// seed-providers-all-states.ts, seed-providers-expanded.ts,
// seed-providers-phase2.ts merged + ~200 new providers added.
// Duplicates resolved by keeping the most complete entry.
// ============================================================

export const FEDERAL_NEW = [
  // ══════════════════════════════════════════════════════════
  // GOVERNMENT SERVICES
  // ══════════════════════════════════════════════════════════
  { name: "USPS", slug: "usps", category: "GOVERNMENT_POSTAL", description: "Mail forwarding, address change, PO boxes", website: "https://www.usps.com", phone: "1-800-275-8777", scope: "FEDERAL", popularityScore: 99, tags: ["mail", "government", "essential"] },
  { name: "USPS Movers Guide", slug: "usps-address-change", category: "GOVERNMENT_POSTAL", description: "Official USPS mail forwarding and address change", website: "https://moversguide.usps.com", phone: "1-800-275-8777", scope: "FEDERAL", popularityScore: 98, tags: ["mail", "postal", "address-change"] },
  { name: "UPS", slug: "ups", category: "GOVERNMENT_POSTAL", description: "Package delivery and shipping", website: "https://www.ups.com", phone: "1-800-742-5877", scope: "FEDERAL", popularityScore: 85, tags: ["mail", "shipping"] },
  { name: "FedEx", slug: "fedex", category: "GOVERNMENT_POSTAL", description: "Express shipping and delivery", website: "https://www.fedex.com", phone: "1-800-463-3339", scope: "FEDERAL", popularityScore: 85, tags: ["mail", "shipping"] },
  { name: "IRS", slug: "irs", category: "GOVERNMENT_TAX", description: "Federal tax administration — address change, tax returns, refunds", website: "https://www.irs.gov", phone: "1-800-829-1040", scope: "FEDERAL", popularityScore: 98, tags: ["tax", "government", "essential"] },
  { name: "IRS Form 8822", slug: "irs-address", category: "GOVERNMENT_TAX", description: "Update your address with the IRS (Form 8822)", website: "https://www.irs.gov/faqs/irs-procedures/address-changes", phone: "1-800-829-1040", scope: "FEDERAL", popularityScore: 95, tags: ["tax", "irs"] },
  { name: "USCIS (Immigration)", slug: "uscis", category: "GOVERNMENT_IMMIGRATION", description: "Immigration services — green card, citizenship, visa, AR-11 address change", website: "https://www.uscis.gov", phone: "1-800-375-5283", scope: "FEDERAL", popularityScore: 92, tags: ["immigration", "government", "essential"] },
  { name: "SSA (Social Security)", slug: "ssa", category: "GOVERNMENT_BENEFITS", description: "Social Security cards, benefits, retirement, address update", website: "https://www.ssa.gov", phone: "1-800-772-1213", scope: "FEDERAL", popularityScore: 95, tags: ["social-security", "government", "essential", "senior"] },
  { name: "VA (Veterans Affairs)", slug: "va-gov", category: "GOVERNMENT_BENEFITS", description: "Veteran benefits, healthcare, disability", website: "https://www.va.gov", phone: "1-800-827-1000", scope: "FEDERAL", popularityScore: 88, tags: ["veterans", "government", "military"] },
  { name: "Healthcare.gov", slug: "healthcare-gov", category: "GOVERNMENT_HEALTH", description: "Health Insurance Marketplace (ACA/Obamacare)", website: "https://www.healthcare.gov", phone: "1-800-318-2596", scope: "FEDERAL", popularityScore: 90, tags: ["health", "government", "essential"] },
  { name: "Medicare.gov", slug: "medicare-gov", category: "GOVERNMENT_HEALTH", description: "Federal health insurance for 65+ and disabled", website: "https://www.medicare.gov", phone: "1-800-633-4227", scope: "FEDERAL", popularityScore: 92, tags: ["health", "government", "senior", "essential"] },
  { name: "Medicaid.gov", slug: "medicaid-gov", category: "GOVERNMENT_HEALTH", description: "Health coverage for low-income individuals", website: "https://www.medicaid.gov", phone: "1-877-267-2323", scope: "FEDERAL", popularityScore: 88, tags: ["health", "government", "essential"] },
  { name: "Federal Student Aid (FAFSA)", slug: "fafsa", category: "GOVERNMENT_EDUCATION", description: "Federal student loans and financial aid", website: "https://studentaid.gov", phone: "1-800-433-3243", scope: "FEDERAL", popularityScore: 85, tags: ["education", "government", "loan"] },
  { name: "StudentAid.gov", slug: "studentaid-gov", category: "GOVERNMENT_EDUCATION", description: "Update address for federal student loans", website: "https://studentaid.gov", phone: "1-800-433-3243", scope: "FEDERAL", popularityScore: 72, tags: ["education", "loans", "student"] },
  { name: "Vote.gov", slug: "vote-gov", category: "GOVERNMENT_VOTER", description: "Voter registration and election info", website: "https://www.vote.gov", scope: "FEDERAL", popularityScore: 82, tags: ["voter", "government", "essential"] },
  { name: "Selective Service System", slug: "selective-service", category: "GOVERNMENT_OTHER", description: "Military draft registration (required for males 18-25)", website: "https://www.sss.gov", phone: "1-888-655-1825", scope: "FEDERAL", popularityScore: 60, tags: ["military", "government"] },
  { name: "US Passport Services", slug: "us-passport", category: "GOVERNMENT_ID", description: "Passport applications, renewals, name changes", website: "https://travel.state.gov/passport", phone: "1-877-487-2778", scope: "FEDERAL", popularityScore: 90, tags: ["passport", "government", "essential", "id"] },
  { name: "TSA PreCheck", slug: "tsa-precheck", category: "GOVERNMENT_OTHER", description: "TSA PreCheck, Global Entry, airport security", website: "https://www.tsa.gov/precheck", phone: "1-866-289-9673", scope: "FEDERAL", popularityScore: 75, tags: ["travel", "government"] },
  { name: "CBP (Customs & Border)", slug: "cbp", category: "GOVERNMENT_OTHER", description: "Global Entry, NEXUS, customs declarations", website: "https://www.cbp.gov", phone: "1-877-227-5511", scope: "FEDERAL", popularityScore: 72, tags: ["travel", "government", "immigration"] },
  { name: "FEMA", slug: "fema", category: "GOVERNMENT_EMERGENCY", description: "Federal Emergency Management Agency", website: "https://www.fema.gov", phone: "1-800-621-3362", scope: "FEDERAL", popularityScore: 78, tags: ["emergency", "government"] },
  { name: "FTC (Federal Trade Commission)", slug: "ftc", category: "GOVERNMENT_OTHER", description: "Consumer protection, identity theft reporting", website: "https://www.ftc.gov", phone: "1-877-382-4357", scope: "FEDERAL", popularityScore: 68, tags: ["consumer", "government"] },
  { name: "SBA (Small Business Admin)", slug: "sba", category: "GOVERNMENT_OTHER", description: "Small business loans, grants, resources", website: "https://www.sba.gov", phone: "1-800-827-5722", scope: "FEDERAL", popularityScore: 72, tags: ["business", "government", "loan"] },
  { name: "HUD (Housing & Urban Dev)", slug: "hud", category: "GOVERNMENT_HOUSING", description: "Fair housing, FHA loans, rental assistance", website: "https://www.hud.gov", phone: "1-800-569-4287", scope: "FEDERAL", popularityScore: 75, tags: ["housing", "government"] },
  { name: "Department of Labor", slug: "dol", category: "GOVERNMENT_OTHER", description: "Employment laws, unemployment insurance, worker rights", website: "https://www.dol.gov", phone: "1-866-487-2365", scope: "FEDERAL", popularityScore: 72, tags: ["employment", "government"] },
  { name: "SSA Disability (SSDI)", slug: "ssa-disability", category: "GOVERNMENT_BENEFITS", description: "Social Security Disability Insurance", website: "https://www.ssa.gov/disability", phone: "1-800-772-1213", scope: "FEDERAL", popularityScore: 88, tags: ["disability", "government", "essential"] },

  // ══════════════════════════════════════════════════════════
  // BANKS
  // ══════════════════════════════════════════════════════════
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
  { name: "Navy Federal Credit Union", slug: "navy-federal", category: "FINANCIAL_BANK", description: "Largest credit union in the US (military)", website: "https://www.navyfederal.org", phone: "1-888-842-6328", scope: "FEDERAL", popularityScore: 80, tags: ["banking", "credit-union", "military"] },
  { name: "PenFed Credit Union", slug: "penfed", category: "FINANCIAL_BANK", description: "Pentagon Federal Credit Union", website: "https://www.penfed.org", phone: "1-800-247-5626", scope: "FEDERAL", popularityScore: 65, tags: ["banking", "credit-union", "military"] },
  { name: "Alliant Credit Union", slug: "alliant-cu", category: "FINANCIAL_BANK", description: "Large online credit union", website: "https://www.alliantcreditunion.org", phone: "1-800-328-1935", scope: "FEDERAL", popularityScore: 60, tags: ["banking", "credit-union"] },
  { name: "Truist", slug: "truist", category: "FINANCIAL_BANK", description: "Retail and commercial bank with strong Southeast footprint", website: "https://www.truist.com", phone: "1-844-487-8478", scope: "FEDERAL", popularityScore: 78, tags: ["banking"] },
  { name: "Regions Bank", slug: "regions-bank", category: "FINANCIAL_BANK", description: "Regional bank with branch, mobile, and online banking", website: "https://www.regions.com", scope: "FEDERAL", popularityScore: 72, tags: ["banking"] },
  { name: "Huntington Bank", slug: "huntington-bank", category: "FINANCIAL_BANK", description: "Midwest-focused bank with strong digital banking", website: "https://www.huntington.com", scope: "FEDERAL", popularityScore: 70, tags: ["banking"] },
  { name: "Citizens Bank", slug: "citizens-bank", category: "FINANCIAL_BANK", description: "Consumer and business banking across the Northeast and beyond", website: "https://www.citizensbank.com", scope: "FEDERAL", popularityScore: 68, tags: ["banking"] },
  { name: "KeyBank", slug: "keybank", category: "FINANCIAL_BANK", description: "Regional bank with checking, lending, and online banking", website: "https://www.key.com", scope: "FEDERAL", popularityScore: 66, tags: ["banking"] },

  // ══════════════════════════════════════════════════════════
  // CREDIT CARDS
  // ══════════════════════════════════════════════════════════
  { name: "American Express", slug: "amex", category: "FINANCIAL_CREDIT_CARD", description: "Premium credit cards and financial services", website: "https://www.americanexpress.com", phone: "1-800-528-4800", scope: "FEDERAL", popularityScore: 88, tags: ["credit-card"] },
  { name: "Chase Credit Cards", slug: "chase-cards", category: "FINANCIAL_CREDIT_CARD", description: "Sapphire, Freedom, and more", website: "https://creditcards.chase.com", phone: "1-800-432-3117", scope: "FEDERAL", popularityScore: 90, tags: ["credit-card", "banking"] },
  { name: "Citi Cards", slug: "citi-cards", category: "FINANCIAL_CREDIT_CARD", description: "Citibank credit card services", website: "https://www.citi.com/credit-cards", phone: "1-800-950-5114", scope: "FEDERAL", popularityScore: 82, tags: ["credit-card", "banking"] },
  { name: "Synchrony Financial", slug: "synchrony", category: "FINANCIAL_CREDIT_CARD", description: "Store credit cards and financing", website: "https://www.synchrony.com", phone: "1-866-419-4096", scope: "FEDERAL", popularityScore: 72, tags: ["credit-card"] },
  { name: "Barclays US", slug: "barclays-us", category: "FINANCIAL_CREDIT_CARD", description: "Credit cards and personal banking", website: "https://www.barclaysus.com", phone: "1-877-523-0478", scope: "FEDERAL", popularityScore: 68, tags: ["credit-card"] },
  { name: "Discover Card", slug: "discover-card", category: "FINANCIAL_CREDIT_CARD", description: "Cash back and travel credit cards by Discover", website: "https://www.discover.com/credit-cards", phone: "1-800-347-2683", scope: "FEDERAL", popularityScore: 80, tags: ["credit-card", "banking"] },
  { name: "Capital One Credit Cards", slug: "capital-one-cards", category: "FINANCIAL_CREDIT_CARD", description: "Venture, Savor, Quicksilver, and more", website: "https://www.capitalone.com/credit-cards", scope: "FEDERAL", popularityScore: 86, tags: ["credit-card", "banking"] },
  { name: "Bank of America Credit Cards", slug: "boa-cards", category: "FINANCIAL_CREDIT_CARD", description: "Travel Rewards, Customized Cash, and more", website: "https://www.bankofamerica.com/credit-cards", scope: "FEDERAL", popularityScore: 84, tags: ["credit-card", "banking"] },
  { name: "Wells Fargo Credit Cards", slug: "wells-fargo-cards", category: "FINANCIAL_CREDIT_CARD", description: "Active Cash, Autograph, and more", website: "https://creditcards.wellsfargo.com", scope: "FEDERAL", popularityScore: 78, tags: ["credit-card", "banking"] },
  { name: "U.S. Bank Credit Cards", slug: "us-bank-cards", category: "FINANCIAL_CREDIT_CARD", description: "Cash+, Altitude, and co-branded cards", website: "https://www.usbank.com/credit-cards.html", scope: "FEDERAL", popularityScore: 74, tags: ["credit-card", "banking"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — AUTO
  // ══════════════════════════════════════════════════════════
  { name: "GEICO", slug: "geico", category: "FINANCIAL_INSURANCE_AUTO", description: "Government Employees Insurance Company", website: "https://www.geico.com", phone: "1-800-207-7847", scope: "FEDERAL", popularityScore: 92, tags: ["auto", "car"] },
  { name: "State Farm", slug: "state-farm", category: "FINANCIAL_INSURANCE_AUTO", description: "Insurance and financial services", website: "https://www.statefarm.com", phone: "1-800-782-8332", scope: "FEDERAL", popularityScore: 90, tags: ["auto", "home", "car"] },
  { name: "Progressive", slug: "progressive", category: "FINANCIAL_INSURANCE_AUTO", description: "Auto insurance and more", website: "https://www.progressive.com", phone: "1-800-776-4737", scope: "FEDERAL", popularityScore: 88, tags: ["auto", "car"] },
  { name: "Allstate", slug: "allstate", category: "FINANCIAL_INSURANCE_AUTO", description: "You're in good hands", website: "https://www.allstate.com", phone: "1-800-255-7828", scope: "FEDERAL", popularityScore: 85, tags: ["auto", "home", "car"] },
  { name: "Liberty Mutual", slug: "liberty-mutual", category: "FINANCIAL_INSURANCE_AUTO", description: "Auto, home, and life insurance", website: "https://www.libertymutual.com", phone: "1-800-290-8206", scope: "FEDERAL", popularityScore: 78, tags: ["auto", "home", "car"] },
  { name: "USAA", slug: "usaa", category: "FINANCIAL_INSURANCE_AUTO", description: "For military members and families", website: "https://www.usaa.com", phone: "1-800-531-8722", scope: "FEDERAL", popularityScore: 82, tags: ["auto", "home", "military"] },
  { name: "Nationwide", slug: "nationwide", category: "FINANCIAL_INSURANCE_AUTO", description: "Insurance and financial services", website: "https://www.nationwide.com", phone: "1-877-669-6877", scope: "FEDERAL", popularityScore: 75, tags: ["auto", "home", "car"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — HOME
  // ══════════════════════════════════════════════════════════
  { name: "Lemonade Insurance", slug: "lemonade", category: "FINANCIAL_INSURANCE_HOME", description: "AI-powered renters and homeowners insurance", website: "https://www.lemonade.com", phone: "1-844-733-8666", scope: "FEDERAL", popularityScore: 70, tags: ["home", "renters"] },
  { name: "State Farm Home", slug: "state-farm-home", category: "FINANCIAL_INSURANCE_HOME", description: "Homeowners and renters insurance", website: "https://www.statefarm.com/insurance/home-and-property", phone: "1-800-782-8332", scope: "FEDERAL", popularityScore: 88, tags: ["home", "renters"] },
  { name: "Travelers Insurance", slug: "travelers", category: "FINANCIAL_INSURANCE_HOME", description: "Home, auto, and business insurance", website: "https://www.travelers.com", phone: "1-800-842-5075", scope: "FEDERAL", popularityScore: 82, tags: ["home", "auto"] },
  { name: "Farmers Insurance", slug: "farmers", category: "FINANCIAL_INSURANCE_HOME", description: "Home, auto, life, and business", website: "https://www.farmers.com", phone: "1-888-327-6335", scope: "FEDERAL", popularityScore: 78, tags: ["home", "auto", "car"] },
  { name: "American Home Shield", slug: "ahs", category: "FINANCIAL_INSURANCE_HOME", description: "Home warranty and protection plans", website: "https://www.ahs.com", phone: "1-800-776-4663", scope: "FEDERAL", popularityScore: 75, tags: ["home", "warranty"] },
  { name: "Choice Home Warranty", slug: "choice-warranty", category: "FINANCIAL_INSURANCE_HOME", description: "Home warranty plans", website: "https://www.choicehomewarranty.com", phone: "1-888-531-5403", scope: "FEDERAL", popularityScore: 68, tags: ["home", "warranty"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — HEALTH
  // ══════════════════════════════════════════════════════════
  { name: "UnitedHealthcare", slug: "unitedhealthcare", category: "FINANCIAL_INSURANCE_HEALTH", description: "Largest health insurance company in the US", website: "https://www.uhc.com", phone: "1-800-328-5979", scope: "FEDERAL", popularityScore: 88, tags: ["health"] },
  { name: "Blue Cross Blue Shield", slug: "bcbs", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance federation", website: "https://www.bcbs.com", phone: "1-888-630-2583", scope: "FEDERAL", popularityScore: 90, tags: ["health"] },
  { name: "Aetna", slug: "aetna", category: "FINANCIAL_INSURANCE_HEALTH", description: "CVS Health company - individual plans available in select states", website: "https://www.aetna.com", phone: "1-800-872-3862", scope: "STATE", states: ["CA", "TX", "FL", "NY", "PA", "OH", "IL", "NC", "GA", "MI", "AZ", "VA", "WA", "MA", "NJ", "MO", "IN", "TN", "CO", "MD"], popularityScore: 82, tags: ["health"] },
  { name: "Cigna", slug: "cigna", category: "FINANCIAL_INSURANCE_HEALTH", description: "Global health service company", website: "https://www.cigna.com", phone: "1-800-997-1654", scope: "FEDERAL", popularityScore: 80, tags: ["health"] },
  { name: "Kaiser Permanente", slug: "kaiser", category: "FINANCIAL_INSURANCE_HEALTH", description: "Integrated managed care in 8 states", website: "https://www.kp.org", phone: "1-800-464-4000", scope: "STATE", states: ["CA", "CO", "GA", "HI", "MD", "OR", "VA", "WA"], popularityScore: 75, tags: ["health"] },
  { name: "Humana", slug: "humana", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health insurance and wellness", website: "https://www.humana.com", phone: "1-800-457-4708", scope: "FEDERAL", popularityScore: 72, tags: ["health", "senior", "medicare"] },
  { name: "Oscar Health", slug: "oscar-health", category: "FINANCIAL_INSURANCE_HEALTH", description: "Technology-focused health insurance in 7 states", website: "https://www.hioscar.com", phone: "1-855-672-2788", scope: "STATE", states: ["CA", "TX", "FL", "NY", "NJ", "OH", "MI"], popularityScore: 68, tags: ["health"] },
  { name: "Ambetter (Centene)", slug: "ambetter", category: "FINANCIAL_INSURANCE_HEALTH", description: "ACA marketplace health plans in 29 states", website: "https://www.ambetterhealth.com", scope: "FEDERAL", popularityScore: 65, tags: ["health", "marketplace"] },
  { name: "Molina Healthcare", slug: "molina", category: "FINANCIAL_INSURANCE_HEALTH", description: "Medicaid and marketplace plans in 19 states", website: "https://www.molinahealthcare.com", phone: "1-888-562-5442", scope: "STATE", states: ["CA", "FL", "TX", "NY", "OH", "MI", "WA", "OR", "UT", "AZ", "NM", "WI", "IL", "IN", "SC", "KY", "TN", "AR", "MS"], popularityScore: 62, tags: ["health", "medicaid"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — DENTAL / VISION
  // ══════════════════════════════════════════════════════════
  { name: "Delta Dental", slug: "delta-dental", category: "FINANCIAL_INSURANCE_HEALTH", description: "Largest dental insurance provider in the US", website: "https://www.deltadental.com", phone: "1-800-932-0783", scope: "FEDERAL", popularityScore: 85, tags: ["dental", "health"] },
  { name: "VSP Vision Care", slug: "vsp", category: "FINANCIAL_INSURANCE_HEALTH", description: "Vision insurance and eye care", website: "https://www.vsp.com", phone: "1-800-877-7195", scope: "FEDERAL", popularityScore: 78, tags: ["vision", "health"] },
  { name: "MetLife Dental", slug: "metlife-dental", category: "FINANCIAL_INSURANCE_HEALTH", description: "Dental insurance plans", website: "https://www.metlife.com/dental-insurance", phone: "1-800-942-0854", scope: "FEDERAL", popularityScore: 72, tags: ["dental", "health"] },
  { name: "Guardian Dental", slug: "guardian-dental", category: "FINANCIAL_INSURANCE_HEALTH", description: "Dental and vision insurance", website: "https://www.guardianlife.com", phone: "1-800-541-7846", scope: "FEDERAL", popularityScore: 68, tags: ["dental", "vision", "health"] },
  { name: "EyeMed Vision Care", slug: "eyemed", category: "FINANCIAL_INSURANCE_HEALTH", description: "Vision insurance for individuals and families", website: "https://www.eyemed.com", phone: "1-866-939-3633", scope: "FEDERAL", popularityScore: 65, tags: ["vision", "health"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — LIFE
  // ══════════════════════════════════════════════════════════
  { name: "New York Life", slug: "ny-life", category: "FINANCIAL_INSURANCE_LIFE", description: "Largest mutual life insurance company", website: "https://www.newyorklife.com", phone: "1-800-710-7945", scope: "FEDERAL", popularityScore: 82, tags: ["life", "insurance"] },
  { name: "Northwestern Mutual", slug: "northwestern-mutual", category: "FINANCIAL_INSURANCE_LIFE", description: "Life insurance and financial planning", website: "https://www.northwesternmutual.com", phone: "1-866-950-4644", scope: "FEDERAL", popularityScore: 78, tags: ["life", "insurance"] },
  { name: "Prudential", slug: "prudential", category: "FINANCIAL_INSURANCE_LIFE", description: "Life insurance and financial planning", website: "https://www.prudential.com", phone: "1-800-778-2255", scope: "FEDERAL", popularityScore: 82, tags: ["insurance", "senior"] },
  { name: "MassMutual", slug: "massmutual", category: "FINANCIAL_INSURANCE_LIFE", description: "Life insurance and retirement services", website: "https://www.massmutual.com", phone: "1-800-272-2216", scope: "FEDERAL", popularityScore: 72, tags: ["life", "insurance"] },
  { name: "Lincoln Financial", slug: "lincoln-financial", category: "FINANCIAL_INSURANCE_LIFE", description: "Life, annuities, and retirement plans", website: "https://www.lincolnfinancial.com", phone: "1-877-275-5462", scope: "FEDERAL", popularityScore: 68, tags: ["life", "insurance"] },

  // ══════════════════════════════════════════════════════════
  // INSURANCE — PET / MOTORCYCLE / BOAT / FLOOD
  // ══════════════════════════════════════════════════════════
  { name: "Trupanion", slug: "trupanion", category: "FINANCIAL_INSURANCE_PET", description: "Medical insurance for cats and dogs", website: "https://www.trupanion.com", phone: "1-855-591-3100", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Healthy Paws", slug: "healthy-paws", category: "FINANCIAL_INSURANCE_PET", description: "Pet health insurance", website: "https://www.healthypawspetinsurance.com", scope: "FEDERAL", popularityScore: 70, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Nationwide Pet Insurance", slug: "nationwide-pet", category: "FINANCIAL_INSURANCE_PET", description: "Pet insurance by Nationwide", website: "https://www.petinsurance.com", scope: "FEDERAL", popularityScore: 68, tags: ["pet", "insurance", "dog", "cat"] },
  { name: "Progressive Motorcycle", slug: "progressive-motorcycle", category: "FINANCIAL_INSURANCE_MOTORCYCLE", description: "#1 motorcycle insurance in the US", website: "https://www.progressive.com/motorcycle", scope: "FEDERAL", popularityScore: 88, tags: ["motorcycle", "insurance"] },
  { name: "GEICO Motorcycle", slug: "geico-motorcycle", category: "FINANCIAL_INSURANCE_MOTORCYCLE", description: "Motorcycle insurance by GEICO", website: "https://www.geico.com/motorcycle-insurance", scope: "FEDERAL", popularityScore: 85, tags: ["motorcycle", "insurance"] },
  { name: "Progressive Boat Insurance", slug: "progressive-boat", category: "FINANCIAL_INSURANCE_BOAT", description: "#1 boat insurance in the US", website: "https://www.progressive.com/boat", scope: "FEDERAL", popularityScore: 82, tags: ["boat", "insurance"] },
  { name: "NFIP (Flood Insurance)", slug: "nfip-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "National Flood Insurance Program", website: "https://www.floodsmart.gov", scope: "FEDERAL", popularityScore: 70, tags: ["home", "insurance"] },

  // ══════════════════════════════════════════════════════════
  // MORTGAGE & LOANS
  // ══════════════════════════════════════════════════════════
  { name: "Rocket Mortgage", slug: "rocket-mortgage", category: "FINANCIAL_MORTGAGE", description: "Online mortgage lender", website: "https://www.rocketmortgage.com", phone: "1-800-785-4632", scope: "FEDERAL", popularityScore: 82, tags: ["mortgage", "home"] },
  { name: "Better.com", slug: "better", category: "FINANCIAL_MORTGAGE", description: "Digital mortgage lender", website: "https://www.better.com", scope: "FEDERAL", popularityScore: 65, tags: ["mortgage", "home"] },
  { name: "SoFi", slug: "sofi", category: "FINANCIAL_FINTECH", description: "All-in-one banking, loans, and investing", website: "https://www.sofi.com", phone: "1-855-456-7634", scope: "FEDERAL", popularityScore: 82, tags: ["loan", "banking", "fintech"] },
  { name: "LendingClub", slug: "lendingclub", category: "FINANCIAL_LOAN", description: "Personal loans and banking", website: "https://www.lendingclub.com", phone: "1-888-596-3157", scope: "FEDERAL", popularityScore: 72, tags: ["loan"] },

  // ══════════════════════════════════════════════════════════
  // PHONE CARRIERS
  // ══════════════════════════════════════════════════════════
  { name: "AT&T", slug: "att", category: "UTILITY_PHONE", description: "Wireless, internet, and TV services", website: "https://www.att.com", phone: "1-800-331-0500", scope: "FEDERAL", popularityScore: 92, tags: ["phone", "internet", "tv"] },
  { name: "Verizon", slug: "verizon", category: "UTILITY_PHONE", description: "Wireless and fiber services", website: "https://www.verizon.com", phone: "1-800-922-0204", scope: "FEDERAL", popularityScore: 90, tags: ["phone", "internet", "fiber"] },
  { name: "T-Mobile", slug: "t-mobile", category: "UTILITY_PHONE", description: "Un-carrier wireless service", website: "https://www.t-mobile.com", phone: "1-800-937-8997", scope: "FEDERAL", popularityScore: 88, tags: ["phone"] },
  { name: "Mint Mobile", slug: "mint-mobile", category: "UTILITY_PHONE", description: "Budget-friendly wireless", website: "https://www.mintmobile.com", scope: "FEDERAL", popularityScore: 65, tags: ["phone", "budget"] },
  { name: "Google Fi", slug: "google-fi", category: "UTILITY_PHONE", description: "Flexible phone plan by Google", website: "https://fi.google.com", scope: "FEDERAL", popularityScore: 55, tags: ["phone"] },
  { name: "Xfinity Mobile", slug: "xfinity-mobile", category: "UTILITY_PHONE", description: "Wireless plans by Comcast Xfinity", website: "https://www.xfinity.com/mobile", scope: "FEDERAL", popularityScore: 76, tags: ["phone", "mvno"] },
  { name: "Spectrum Mobile", slug: "spectrum-mobile", category: "UTILITY_PHONE", description: "Wireless service by Charter Spectrum", website: "https://www.spectrum.com/mobile", scope: "FEDERAL", popularityScore: 70, tags: ["phone", "mvno"] },
  { name: "Visible", slug: "visible", category: "UTILITY_PHONE", description: "Simple wireless plans powered by Verizon", website: "https://www.visible.com", scope: "FEDERAL", popularityScore: 62, tags: ["phone", "budget", "mvno"] },
  { name: "Cricket Wireless", slug: "cricket-wireless", category: "UTILITY_PHONE", description: "Prepaid wireless service by AT&T", website: "https://www.cricketwireless.com", scope: "FEDERAL", popularityScore: 68, tags: ["phone", "prepaid", "budget"] },
  { name: "Metro by T-Mobile", slug: "metro-by-t-mobile", category: "UTILITY_PHONE", description: "Prepaid wireless plans on T-Mobile", website: "https://www.metrobyt-mobile.com", scope: "FEDERAL", popularityScore: 66, tags: ["phone", "prepaid", "budget"] },
  { name: "Boost Mobile", slug: "boost-mobile", category: "UTILITY_PHONE", description: "Prepaid wireless and device deals", website: "https://www.boostmobile.com", scope: "FEDERAL", popularityScore: 60, tags: ["phone", "prepaid", "budget"] },
  { name: "Consumer Cellular", slug: "consumer-cellular", category: "UTILITY_PHONE", description: "Wireless plans popular with seniors", website: "https://www.consumercellular.com", scope: "FEDERAL", popularityScore: 58, tags: ["phone", "senior"] },
  { name: "US Mobile", slug: "us-mobile", category: "UTILITY_PHONE", description: "Customizable wireless plans on major networks", website: "https://www.usmobile.com", scope: "FEDERAL", popularityScore: 56, tags: ["phone", "mvno"] },
  { name: "Straight Talk", slug: "straight-talk", category: "UTILITY_PHONE", description: "Nationwide prepaid wireless plans", website: "https://www.straighttalk.com", scope: "FEDERAL", popularityScore: 54, tags: ["phone", "prepaid", "budget"] },
  { name: "Total Wireless", slug: "total-wireless", category: "UTILITY_PHONE", description: "Value-focused prepaid wireless service", website: "https://www.totalwireless.com", scope: "FEDERAL", popularityScore: 52, tags: ["phone", "prepaid", "budget"] },

  // ══════════════════════════════════════════════════════════
  // INTERNET (Nationwide)
  // ══════════════════════════════════════════════════════════
  { name: "Xfinity (Comcast)", slug: "xfinity", category: "UTILITY_INTERNET", description: "Internet, TV, and streaming", website: "https://www.xfinity.com", phone: "1-800-934-6489", scope: "FEDERAL", popularityScore: 85, tags: ["internet", "tv", "cable"] },
  { name: "Spectrum", slug: "spectrum", category: "UTILITY_INTERNET", description: "Internet, TV, and voice", website: "https://www.spectrum.com", phone: "1-833-267-6094", scope: "FEDERAL", popularityScore: 80, tags: ["internet", "tv", "cable"] },
  { name: "AT&T Fiber", slug: "att-fiber", category: "UTILITY_INTERNET", description: "Fiber internet service", website: "https://www.att.com/internet/fiber", phone: "1-855-220-5211", scope: "FEDERAL", popularityScore: 78, tags: ["internet", "fiber"] },
  { name: "Verizon Fios", slug: "verizon-fios", category: "UTILITY_INTERNET", description: "100% fiber optic internet", website: "https://www.verizon.com/fios", phone: "1-800-837-4966", scope: "FEDERAL", popularityScore: 76, tags: ["internet", "fiber"] },
  { name: "T-Mobile Home Internet", slug: "t-mobile-home", category: "UTILITY_INTERNET", description: "5G home internet", website: "https://www.t-mobile.com/home-internet", scope: "FEDERAL", popularityScore: 60, tags: ["internet", "5g"] },
  { name: "Starlink", slug: "starlink", category: "UTILITY_INTERNET", description: "Satellite internet by SpaceX", website: "https://www.starlink.com", scope: "FEDERAL", popularityScore: 55, tags: ["internet", "satellite", "rural"] },

  // ══════════════════════════════════════════════════════════
  // TV / STREAMING
  // ══════════════════════════════════════════════════════════
  { name: "DirecTV", slug: "directv", category: "UTILITY_CABLE", description: "Satellite TV service", website: "https://www.directv.com", phone: "1-800-531-5000", scope: "FEDERAL", popularityScore: 65, tags: ["tv", "satellite"] },
  { name: "YouTube TV", slug: "youtube-tv", category: "UTILITY_CABLE", description: "Live TV streaming", website: "https://tv.youtube.com", scope: "FEDERAL", popularityScore: 72, tags: ["tv", "streaming"] },

  // ══════════════════════════════════════════════════════════
  // TRASH / WASTE
  // ══════════════════════════════════════════════════════════
  { name: "Waste Management", slug: "waste-management", category: "UTILITY_TRASH", description: "Largest waste services provider in the US", website: "https://www.wm.com", phone: "1-866-797-9018", scope: "FEDERAL", popularityScore: 80, tags: ["trash", "waste", "recycling"] },
  { name: "Republic Services", slug: "republic-services", category: "UTILITY_TRASH", description: "Environmental services", website: "https://www.republicservices.com", phone: "1-800-422-2733", scope: "FEDERAL", popularityScore: 70, tags: ["trash", "waste"] },

  // ══════════════════════════════════════════════════════════
  // FITNESS / GYM
  // ══════════════════════════════════════════════════════════
  { name: "Planet Fitness", slug: "planet-fitness", category: "FITNESS_GYM", description: "Judgement free zone", website: "https://www.planetfitness.com", phone: "1-844-880-7180", scope: "FEDERAL", popularityScore: 90, tags: ["gym", "fitness", "budget"] },
  { name: "LA Fitness", slug: "la-fitness", category: "FITNESS_GYM", description: "Full-service health club", website: "https://www.lafitness.com", phone: "1-949-255-7200", scope: "FEDERAL", popularityScore: 78, tags: ["gym", "fitness"] },
  { name: "Anytime Fitness", slug: "anytime-fitness", category: "FITNESS_GYM", description: "24/7 gym access worldwide", website: "https://www.anytimefitness.com", phone: "1-800-704-5004", scope: "FEDERAL", popularityScore: 75, tags: ["gym", "fitness"] },
  { name: "Equinox", slug: "equinox", category: "FITNESS_GYM", description: "High-performance luxury fitness", website: "https://www.equinox.com", scope: "FEDERAL", popularityScore: 60, tags: ["gym", "fitness", "luxury"] },
  { name: "Orangetheory", slug: "orangetheory", category: "FITNESS_GYM", description: "Heart-rate based interval training", website: "https://www.orangetheory.com", scope: "FEDERAL", popularityScore: 65, tags: ["gym", "fitness", "classes"] },
  { name: "YMCA", slug: "ymca", category: "FITNESS_GYM", description: "Community programs, youth activities, fitness", website: "https://www.ymca.org", scope: "FEDERAL", popularityScore: 88, tags: ["gym", "fitness", "kids", "community"] },
  { name: "Peloton", slug: "peloton", category: "FITNESS_GYM", subCategory: "ONLINE", description: "Connected fitness at home", website: "https://www.onepeloton.com", scope: "FEDERAL", popularityScore: 62, tags: ["fitness", "home", "online"] },

  // FITNESS / STUDIO
  { name: "Pure Barre", slug: "pure-barre", category: "FITNESS_STUDIO", description: "Low-impact barre fitness studios", website: "https://www.purebarre.com", scope: "FEDERAL", popularityScore: 68, tags: ["fitness", "barre"] },
  { name: "Barry's", slug: "barrys", category: "FITNESS_STUDIO", description: "High-intensity interval and strength training studios", website: "https://www.barrys.com", scope: "FEDERAL", popularityScore: 65, tags: ["fitness", "hiit"] },
  { name: "SoulCycle", slug: "soulcycle", category: "FITNESS_STUDIO", description: "Boutique indoor cycling studios", website: "https://www.soul-cycle.com", scope: "FEDERAL", popularityScore: 62, tags: ["fitness", "cycling"] },
  { name: "CorePower Yoga", slug: "corepower-yoga", category: "FITNESS_STUDIO", description: "Heated yoga and sculpt studios", website: "https://www.corepoweryoga.com", scope: "FEDERAL", popularityScore: 70, tags: ["fitness", "yoga"] },
  { name: "F45 Training", slug: "f45", category: "FITNESS_STUDIO", description: "Functional 45-minute group workouts", website: "https://www.f45training.com", scope: "FEDERAL", popularityScore: 60, tags: ["fitness", "hiit"] },
  { name: "Club Pilates", slug: "club-pilates", category: "FITNESS_STUDIO", description: "Reformer Pilates studio franchise", website: "https://www.clubpilates.com", scope: "FEDERAL", popularityScore: 65, tags: ["fitness", "pilates"] },
  { name: "CycleBar", slug: "cyclebar", category: "FITNESS_STUDIO", description: "Premium indoor cycling studios", website: "https://www.cyclebar.com", scope: "FEDERAL", popularityScore: 55, tags: ["fitness", "cycling"] },
  { name: "StretchLab", slug: "stretchlab", category: "FITNESS_STUDIO", description: "Assisted stretching studios", website: "https://www.stretchlab.com", scope: "FEDERAL", popularityScore: 58, tags: ["fitness", "recovery"] },

  // ══════════════════════════════════════════════════════════
  // SUBSCRIPTIONS & STREAMING
  // ══════════════════════════════════════════════════════════
  { name: "Amazon Prime", slug: "amazon-prime", category: "SHOPPING_SUBSCRIPTION", description: "Free shipping, video, music, and more", website: "https://www.amazon.com/prime", scope: "FEDERAL", popularityScore: 98, tags: ["subscription", "shopping", "streaming"] },
  { name: "Netflix", slug: "netflix", category: "SHOPPING_SUBSCRIPTION", description: "Streaming movies and TV shows", website: "https://www.netflix.com", scope: "FEDERAL", popularityScore: 95, tags: ["subscription", "streaming"] },
  { name: "Spotify", slug: "spotify", category: "SHOPPING_SUBSCRIPTION", description: "Music and podcast streaming", website: "https://www.spotify.com", scope: "FEDERAL", popularityScore: 88, tags: ["subscription", "music"] },
  { name: "Apple One", slug: "apple-one", category: "SHOPPING_SUBSCRIPTION", description: "Apple Music, TV+, Arcade, iCloud+", website: "https://www.apple.com/apple-one", scope: "FEDERAL", popularityScore: 75, tags: ["subscription", "streaming"] },
  { name: "Disney+", slug: "disney-plus", category: "SHOPPING_SUBSCRIPTION", description: "Disney, Pixar, Marvel, Star Wars", website: "https://www.disneyplus.com", scope: "FEDERAL", popularityScore: 80, tags: ["subscription", "streaming", "kids"] },
  { name: "Costco", slug: "costco", category: "SHOPPING_SUBSCRIPTION", description: "Wholesale club membership", website: "https://www.costco.com", scope: "FEDERAL", popularityScore: 82, tags: ["subscription", "shopping"] },
  { name: "Sam's Club", slug: "sams-club", category: "SHOPPING_SUBSCRIPTION", description: "Walmart wholesale club", website: "https://www.samsclub.com", scope: "FEDERAL", popularityScore: 70, tags: ["subscription", "shopping"] },
  { name: "HBO Max", slug: "hbo-max", category: "SHOPPING_SUBSCRIPTION", description: "Streaming from HBO, Warner Bros", website: "https://www.max.com", scope: "FEDERAL", popularityScore: 82, tags: ["subscription", "streaming"] },
  { name: "Hulu", slug: "hulu", category: "SHOPPING_SUBSCRIPTION", description: "TV shows, movies, and originals", website: "https://www.hulu.com", scope: "FEDERAL", popularityScore: 88, tags: ["subscription", "streaming"] },
  { name: "Apple TV+", slug: "apple-tv", category: "SHOPPING_SUBSCRIPTION", description: "Apple originals and movies", website: "https://tv.apple.com", scope: "FEDERAL", popularityScore: 75, tags: ["subscription", "streaming"] },
  { name: "Paramount+", slug: "paramount-plus", category: "SHOPPING_SUBSCRIPTION", description: "CBS, Paramount, and originals", website: "https://www.paramountplus.com", scope: "FEDERAL", popularityScore: 72, tags: ["subscription", "streaming"] },
  { name: "Peacock", slug: "peacock", category: "SHOPPING_SUBSCRIPTION", description: "NBCUniversal streaming", website: "https://www.peacocktv.com", scope: "FEDERAL", popularityScore: 70, tags: ["subscription", "streaming"] },
  { name: "Apple Music", slug: "apple-music", category: "SHOPPING_SUBSCRIPTION", description: "Music streaming service", website: "https://music.apple.com", scope: "FEDERAL", popularityScore: 82, tags: ["subscription", "music"] },
  { name: "YouTube Premium", slug: "youtube-premium", category: "SHOPPING_SUBSCRIPTION", description: "Ad-free YouTube and music", website: "https://www.youtube.com/premium", scope: "FEDERAL", popularityScore: 78, tags: ["subscription", "streaming", "music"] },
  { name: "Chewy", slug: "chewy", category: "SHOPPING_SUBSCRIPTION", description: "Pet food and supplies subscription", website: "https://www.chewy.com", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "subscription", "dog", "cat"] },
  { name: "AARP", slug: "aarp", category: "SHOPPING_SUBSCRIPTION", description: "Membership for age 50+", website: "https://www.aarp.org", scope: "FEDERAL", popularityScore: 75, tags: ["senior", "subscription", "medicare"] },

  // ══════════════════════════════════════════════════════════
  // HEALTHCARE — PHARMACY, DOCTOR, DENTIST, VET, SENIOR
  // ══════════════════════════════════════════════════════════
  { name: "CVS Pharmacy", slug: "cvs", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and health services", website: "https://www.cvs.com", phone: "1-800-746-7287", scope: "FEDERAL", popularityScore: 88, tags: ["pharmacy", "health"] },
  { name: "Walgreens", slug: "walgreens", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and health services", website: "https://www.walgreens.com", phone: "1-800-925-4733", scope: "FEDERAL", popularityScore: 85, tags: ["pharmacy", "health"] },
  { name: "GoodRx", slug: "goodrx", category: "HEALTHCARE_PHARMACY", description: "Prescription drug discounts and coupons", website: "https://www.goodrx.com", scope: "FEDERAL", popularityScore: 85, tags: ["health", "pharmacy"] },
  { name: "Amazon Pharmacy", slug: "amazon-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Online pharmacy with Prime savings", website: "https://pharmacy.amazon.com", scope: "FEDERAL", popularityScore: 68, tags: ["pharmacy", "health", "online"] },
  { name: "Rite Aid", slug: "rite-aid", category: "HEALTHCARE_PHARMACY", description: "Pharmacy and wellness products", website: "https://www.riteaid.com", phone: "1-800-748-3243", scope: "FEDERAL", popularityScore: 80, tags: ["pharmacy", "health"] },
  { name: "Costco Pharmacy", slug: "costco-pharmacy", category: "HEALTHCARE_PHARMACY", description: "Pharmacy services for Costco members", website: "https://www.costco.com/pharmacy", phone: "1-800-607-6861", scope: "FEDERAL", popularityScore: 75, tags: ["pharmacy", "health"] },
  { name: "Costco Optical", slug: "costco-optical", category: "HEALTHCARE_PHARMACY", description: "Eye exams and eyewear", website: "https://www.costco.com/optical", scope: "FEDERAL", popularityScore: 72, tags: ["vision", "health"] },
  { name: "Teladoc Health", slug: "teladoc", category: "HEALTHCARE_TELEMEDICINE", description: "Virtual care for general medical, mental health, and more", website: "https://www.teladoc.com", phone: "1-800-835-2362", scope: "FEDERAL", popularityScore: 85, tags: ["telemedicine", "virtual", "health"] },
  { name: "ZocDoc", slug: "zocdoc", category: "HEALTHCARE_DOCTORS", description: "Find and book doctors online", website: "https://www.zocdoc.com", scope: "FEDERAL", popularityScore: 72, tags: ["health", "doctor"] },
  { name: "One Medical", slug: "one-medical", category: "HEALTHCARE_TELEMEDICINE", description: "Primary care memberships with same-day virtual visits", website: "https://www.onemedical.com", phone: "1-888-663-6331", scope: "FEDERAL", popularityScore: 78, tags: ["telemedicine", "primary-care", "membership"] },
  { name: "MinuteClinic (CVS)", slug: "minuteclinic", category: "HEALTHCARE_DOCTORS", description: "Walk-in clinics inside CVS stores", website: "https://www.cvs.com/minuteclinic", phone: "1-866-389-2727", scope: "FEDERAL", popularityScore: 80, tags: ["health", "doctor"] },
  { name: "Aspen Dental", slug: "aspen-dental", category: "HEALTHCARE_DENTIST", description: "Dental care with 1000+ offices", website: "https://www.aspendental.com", phone: "1-844-789-2572", scope: "FEDERAL", popularityScore: 80, tags: ["health", "dental"] },
  { name: "Banfield Pet Hospital", slug: "banfield", category: "HEALTHCARE_VET", description: "Preventive pet care", website: "https://www.banfield.com", phone: "1-866-894-7927", scope: "FEDERAL", popularityScore: 70, tags: ["pet", "vet", "dog", "cat"] },
  { name: "VCA Animal Hospitals", slug: "vca", category: "HEALTHCARE_VET", description: "Veterinary care network", website: "https://www.vcahospitals.com", scope: "FEDERAL", popularityScore: 65, tags: ["pet", "vet"] },
  { name: "Visiting Angels", slug: "visiting-angels", category: "HEALTHCARE_SENIOR", description: "In-home senior care services", website: "https://www.visitingangels.com", phone: "1-800-365-4189", scope: "FEDERAL", popularityScore: 78, tags: ["senior"] },
  { name: "Home Instead", slug: "home-instead", category: "HEALTHCARE_SENIOR", description: "Personalized in-home senior care", website: "https://www.homeinstead.com", phone: "1-888-484-5759", scope: "FEDERAL", popularityScore: 80, tags: ["senior"] },
  { name: "Meals on Wheels", slug: "meals-on-wheels", category: "HEALTHCARE_SENIOR", description: "Home-delivered meals for seniors", website: "https://www.mealsonwheelsamerica.org", scope: "FEDERAL", popularityScore: 82, tags: ["senior"] },

  // ══════════════════════════════════════════════════════════
  // KIDS — DAYCARE, SCHOOL, ACTIVITIES
  // ══════════════════════════════════════════════════════════
  { name: "Kumon", slug: "kumon", category: "KIDS_ACTIVITY", description: "After-school math and reading program", website: "https://www.kumon.com", phone: "1-800-222-6284", scope: "FEDERAL", popularityScore: 60, tags: ["kids", "education", "children"] },
  { name: "KinderCare", slug: "kindercare", category: "KIDS_DAYCARE", description: "Early childhood education", website: "https://www.kindercare.com", scope: "FEDERAL", popularityScore: 65, tags: ["kids", "daycare", "children"] },
  { name: "Bright Horizons", slug: "bright-horizons", category: "KIDS_DAYCARE", description: "Child care and early education", website: "https://www.brighthorizons.com", scope: "FEDERAL", popularityScore: 62, tags: ["kids", "daycare", "children"] },
  { name: "Care.com", slug: "care-com", category: "KIDS_DAYCARE", description: "Find babysitters, nannies, and daycares", website: "https://www.care.com", scope: "FEDERAL", popularityScore: 85, tags: ["kids", "daycare", "children", "senior"] },
  { name: "The Goddard School", slug: "goddard-school", category: "KIDS_DAYCARE", description: "Play-based preschool and childcare franchise", website: "https://www.goddardschool.com", scope: "FEDERAL", popularityScore: 72, tags: ["kids", "daycare", "preschool"] },
  { name: "Head Start", slug: "head-start", category: "KIDS_SCHOOL", description: "Federal early childhood education", website: "https://www.acf.hhs.gov/ohs", scope: "FEDERAL", popularityScore: 78, tags: ["kids", "education", "children"] },
  { name: "Boys & Girls Clubs", slug: "bgca", category: "KIDS_ACTIVITY", description: "Youth development programs", website: "https://www.bgca.org", scope: "FEDERAL", popularityScore: 82, tags: ["kids", "children"] },

  // ══════════════════════════════════════════════════════════
  // MOVING & STORAGE
  // ══════════════════════════════════════════════════════════
  { name: "U-Haul", slug: "uhaul", category: "HOUSING_MOVING", description: "Truck and trailer rentals for DIY moving", website: "https://www.uhaul.com", phone: "1-800-468-4285", scope: "FEDERAL", popularityScore: 95, tags: ["moving", "truck", "rental"] },
  { name: "Penske Truck Rental", slug: "penske", category: "HOUSING_MOVING", description: "One-way and local truck rentals", website: "https://www.pensketruckrental.com", phone: "1-800-222-0277", scope: "FEDERAL", popularityScore: 82, tags: ["moving", "truck", "rental"] },
  { name: "Budget Truck Rental", slug: "budget-truck", category: "HOUSING_MOVING", description: "Affordable truck rentals for moving", website: "https://www.budgettruck.com", phone: "1-800-462-8343", scope: "FEDERAL", popularityScore: 75, tags: ["moving", "truck", "rental", "budget"] },
  { name: "PODS", slug: "pods", category: "HOUSING_MOVING", description: "Portable moving and storage containers", website: "https://www.pods.com", phone: "1-866-229-4120", scope: "FEDERAL", popularityScore: 80, tags: ["moving", "storage", "container"] },
  { name: "1-800-GOT-JUNK", slug: "got-junk", category: "HOUSING_MOVING", description: "Junk removal and hauling service", website: "https://www.1800gotjunk.com", phone: "1-800-468-5865", scope: "FEDERAL", popularityScore: 72, tags: ["junk", "removal", "moving"] },
  { name: "Allied Van Lines", slug: "allied-van-lines", category: "HOUSING_MOVING", description: "Full-service interstate moving company", website: "https://www.allied.com", phone: "1-800-689-8684", scope: "FEDERAL", popularityScore: 78, tags: ["moving", "interstate", "full-service"] },
  { name: "United Van Lines", slug: "united-van-lines", category: "HOUSING_MOVING", description: "America's #1 mover", website: "https://www.unitedvanlines.com", phone: "1-800-325-3870", scope: "FEDERAL", popularityScore: 80, tags: ["moving", "interstate", "full-service"] },
  { name: "Two Men and a Truck", slug: "two-men-truck", category: "HOUSING_MOVING", description: "Local and long-distance moving", website: "https://www.twomenandatruck.com", phone: "1-800-345-1070", scope: "FEDERAL", popularityScore: 75, tags: ["moving", "local"] },
  { name: "Mayflower Moving", slug: "mayflower", category: "HOUSING_MOVING", description: "Full-service interstate moving", website: "https://www.mayflower.com", phone: "1-877-720-4498", scope: "FEDERAL", popularityScore: 75, tags: ["moving", "interstate"] },
  { name: "Public Storage", slug: "public-storage", category: "HOUSING_STORAGE", description: "Largest self-storage company in the US", website: "https://www.publicstorage.com", phone: "1-800-688-8057", scope: "FEDERAL", popularityScore: 88, tags: ["storage"] },
  { name: "Extra Space Storage", slug: "extra-space", category: "HOUSING_STORAGE", description: "Self-storage units nationwide", website: "https://www.extraspace.com", phone: "1-888-728-0082", scope: "FEDERAL", popularityScore: 82, tags: ["storage"] },
  { name: "CubeSmart", slug: "cubesmart", category: "HOUSING_STORAGE", description: "Self-storage facilities", website: "https://www.cubesmart.com", phone: "1-844-709-8051", scope: "FEDERAL", popularityScore: 72, tags: ["storage"] },
  { name: "Life Storage", slug: "life-storage", category: "HOUSING_STORAGE", description: "Storage units and moving supplies", website: "https://www.lifestorage.com", phone: "1-844-533-1795", scope: "FEDERAL", popularityScore: 68, tags: ["storage"] },

  // ══════════════════════════════════════════════════════════
  // INVESTMENT & BROKERAGE (NEW)
  // ══════════════════════════════════════════════════════════
  { name: "Charles Schwab", slug: "schwab", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Brokerage, banking, and wealth management", website: "https://www.schwab.com", phone: "1-866-855-9102", scope: "FEDERAL", popularityScore: 88, tags: ["investment", "banking", "brokerage"] },
  { name: "Fidelity Investments", slug: "fidelity", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Full-service brokerage and financial services", website: "https://www.fidelity.com", phone: "1-800-343-3548", scope: "FEDERAL", popularityScore: 90, tags: ["investment", "banking", "brokerage"] },
  { name: "Vanguard", slug: "vanguard", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Low-cost index funds and ETFs", website: "https://www.vanguard.com", phone: "1-877-662-7447", scope: "FEDERAL", popularityScore: 85, tags: ["investment", "retirement"] },
  { name: "E*TRADE", slug: "etrade", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Online trading and investing", website: "https://www.etrade.com", phone: "1-800-387-2331", scope: "FEDERAL", popularityScore: 75, tags: ["investment", "trading"] },
  { name: "TD Ameritrade", slug: "td-ameritrade", category: "FINANCIAL_BANK", subCategory: "INVESTMENT", description: "Trading platform and investment services", website: "https://www.tdameritrade.com", phone: "1-800-669-3900", scope: "FEDERAL", popularityScore: 78, tags: ["investment", "trading"] },

  // ══════════════════════════════════════════════════════════
  // REAL ESTATE & HOUSING
  // ══════════════════════════════════════════════════════════
  { name: "Zillow", slug: "zillow", category: "HOUSING_REAL_ESTATE", description: "Real estate and rental marketplace", website: "https://www.zillow.com", scope: "FEDERAL", popularityScore: 95, tags: ["real-estate", "home", "rental"] },
  { name: "Realtor.com", slug: "realtor-com", category: "HOUSING_REAL_ESTATE", description: "Official real estate listings", website: "https://www.realtor.com", scope: "FEDERAL", popularityScore: 90, tags: ["real-estate", "home"] },
  { name: "Redfin", slug: "redfin", category: "HOUSING_REAL_ESTATE", description: "Real estate brokerage with lower fees", website: "https://www.redfin.com", scope: "FEDERAL", popularityScore: 85, tags: ["real-estate", "home"] },
  { name: "Apartments.com", slug: "apartments-com", category: "HOUSING_REAL_ESTATE", description: "Apartment and rental listings", website: "https://www.apartments.com", scope: "FEDERAL", popularityScore: 82, tags: ["rental", "apartment"] },
  { name: "Trulia", slug: "trulia", category: "HOUSING_REAL_ESTATE", description: "Real estate listings and neighborhood info", website: "https://www.trulia.com", scope: "FEDERAL", popularityScore: 78, tags: ["real-estate", "home"] },
  { name: "Zumper", slug: "zumper", category: "HOUSING_REAL_ESTATE", description: "Apartment rental platform", website: "https://www.zumper.com", scope: "FEDERAL", popularityScore: 62, tags: ["rental", "apartment"] },

  // ══════════════════════════════════════════════════════════
  // HOME SERVICES
  // ══════════════════════════════════════════════════════════
  { name: "Home Depot", slug: "home-depot", category: "HOUSING_HOME_SERVICE", description: "Home improvement retailer", website: "https://www.homedepot.com", phone: "1-800-466-3337", scope: "FEDERAL", popularityScore: 92, tags: ["home", "improvement"] },
  { name: "Lowe's", slug: "lowes", category: "HOUSING_HOME_SERVICE", description: "Home improvement store", website: "https://www.lowes.com", phone: "1-800-445-6937", scope: "FEDERAL", popularityScore: 88, tags: ["home", "improvement"] },
  { name: "TaskRabbit", slug: "taskrabbit", category: "HOUSING_HOME_SERVICE", description: "Hire local help for moving, assembly, handyman", website: "https://www.taskrabbit.com", scope: "FEDERAL", popularityScore: 75, tags: ["home", "handyman", "moving"] },
  { name: "Thumbtack", slug: "thumbtack", category: "HOUSING_HOME_SERVICE", description: "Find local professionals for any project", website: "https://www.thumbtack.com", scope: "FEDERAL", popularityScore: 72, tags: ["home", "services"] },
  { name: "Angi (Angie's List)", slug: "angi", category: "HOUSING_HOME_SERVICE", description: "Home service professionals", website: "https://www.angi.com", scope: "FEDERAL", popularityScore: 78, tags: ["home", "services"] },
  { name: "Ring", slug: "ring-security", category: "HOUSING_HOME_SERVICE", description: "Video doorbells and home security", website: "https://www.ring.com", scope: "FEDERAL", popularityScore: 82, tags: ["home", "security"] },
  { name: "Roto-Rooter", slug: "roto-rooter", category: "HOUSING_HOME_SERVICE", description: "Plumbing and water cleanup", website: "https://www.rotorooter.com", phone: "1-800-768-6911", scope: "FEDERAL", popularityScore: 72, tags: ["plumbing"] },
  { name: "ServPro", slug: "servpro", category: "HOUSING_HOME_SERVICE", description: "Fire, water, and mold restoration", website: "https://www.servpro.com", phone: "1-800-737-8776", scope: "FEDERAL", popularityScore: 65, tags: ["restoration", "damage"] },
  { name: "Ace Hardware", slug: "ace-hardware", category: "HOUSING_HOME_SERVICE", description: "Local hardware stores plus repair and project services", website: "https://www.acehardware.com", scope: "FEDERAL", popularityScore: 80, tags: ["home", "improvement", "repair"] },
  { name: "True Value", slug: "true-value", category: "HOUSING_HOME_SERVICE", description: "Hardware, paint, and home project supplies", website: "https://www.truevalue.com", scope: "FEDERAL", popularityScore: 70, tags: ["home", "improvement"] },
  { name: "HomeAdvisor", slug: "homeadvisor", category: "HOUSING_HOME_SERVICE", description: "Find local contractors and home repair professionals", website: "https://www.homeadvisor.com", scope: "FEDERAL", popularityScore: 68, tags: ["home", "services"] },
  { name: "Mr. Handyman", slug: "mr-handyman", category: "HOUSING_HOME_SERVICE", description: "Handyman and home repair services", website: "https://www.mrhandyman.com", scope: "FEDERAL", popularityScore: 64, tags: ["home", "handyman", "repair"] },
  { name: "TruGreen", slug: "trugreen", category: "HOUSING_LAWN_CARE", description: "America's #1 lawn care company", website: "https://www.trugreen.com", phone: "1-800-464-0171", scope: "FEDERAL", popularityScore: 88, tags: ["lawn", "home"] },
  { name: "Stanley Steemer", slug: "stanley-steemer", category: "HOUSING_LAWN_CARE", description: "Carpet and floor cleaning", website: "https://www.stanleysteemer.com", phone: "1-800-786-5397", scope: "FEDERAL", popularityScore: 68, tags: ["cleaning", "carpet"] },
  { name: "Terminix", slug: "terminix", category: "HOUSING_PEST_CONTROL", description: "Pest control and termite treatment", website: "https://www.terminix.com", phone: "1-866-569-4035", scope: "FEDERAL", popularityScore: 88, tags: ["pest", "termite"] },
  { name: "Orkin", slug: "orkin", category: "HOUSING_PEST_CONTROL", description: "Pest control since 1901", website: "https://www.orkin.com", phone: "1-877-233-3125", scope: "FEDERAL", popularityScore: 90, tags: ["pest", "home"] },

  // ══════════════════════════════════════════════════════════
  // HOA
  // ══════════════════════════════════════════════════════════
  { name: "FirstService Residential", slug: "firstservice", category: "HOUSING_HOA", description: "Largest HOA management in North America", website: "https://www.fsresidential.com", scope: "FEDERAL", popularityScore: 80, tags: ["hoa", "home"] },
  { name: "Associa", slug: "associa", category: "HOUSING_HOA", description: "Community management company", website: "https://www.associaonline.com", phone: "1-800-808-4882", scope: "FEDERAL", popularityScore: 75, tags: ["hoa", "home"] },

  // ══════════════════════════════════════════════════════════
  // AUTO / TRANSPORTATION
  // ══════════════════════════════════════════════════════════
  { name: "AAA", slug: "aaa", category: "TRANSPORTATION_OTHER", description: "Roadside assistance and auto services", website: "https://www.aaa.com", phone: "1-800-222-4357", scope: "FEDERAL", popularityScore: 90, tags: ["auto", "roadside", "membership"] },
  { name: "E-ZPass", slug: "ezpass", category: "TRANSPORTATION_TOLL", description: "Electronic toll collection (multi-state)", website: "https://www.e-zpassiag.com", scope: "FEDERAL", popularityScore: 85, tags: ["toll", "car", "driving"] },
  { name: "Enterprise Rent-A-Car", slug: "enterprise", category: "TRANSPORTATION_OTHER", description: "Car rental for moving and travel", website: "https://www.enterprise.com", phone: "1-800-736-8222", scope: "FEDERAL", popularityScore: 85, tags: ["car", "rental"] },
  { name: "Hertz", slug: "hertz", category: "TRANSPORTATION_OTHER", description: "Car rental company", website: "https://www.hertz.com", phone: "1-800-654-3131", scope: "FEDERAL", popularityScore: 78, tags: ["car", "rental"] },
  { name: "Carvana", slug: "carvana", category: "TRANSPORTATION_OTHER", description: "Online used car buying and selling", website: "https://www.carvana.com", scope: "FEDERAL", popularityScore: 72, tags: ["auto", "car", "buy"] },
  { name: "CarMax", slug: "carmax", category: "TRANSPORTATION_OTHER", description: "Used car retailer", website: "https://www.carmax.com", phone: "1-800-519-1511", scope: "FEDERAL", popularityScore: 75, tags: ["auto", "car", "buy"] },
  { name: "Jiffy Lube", slug: "jiffy-lube", category: "TRANSPORTATION_AUTO", description: "Oil change and auto maintenance", website: "https://www.jiffylube.com", scope: "FEDERAL", popularityScore: 78, tags: ["car", "auto"] },
  { name: "Safelite AutoGlass", slug: "safelite", category: "TRANSPORTATION_AUTO", description: "Windshield repair and replacement", website: "https://www.safelite.com", phone: "1-800-800-2727", scope: "FEDERAL", popularityScore: 80, tags: ["car", "auto"] },
  { name: "ParkMobile", slug: "parkmobile", category: "TRANSPORTATION_PARKING", description: "Contactless parking payments", website: "https://www.parkmobile.io", scope: "FEDERAL", popularityScore: 82, tags: ["parking", "car"] },

  // ══════════════════════════════════════════════════════════
  // RIDE-SHARE & DELIVERY (NEW)
  // ══════════════════════════════════════════════════════════
  { name: "Uber", slug: "uber", category: "TRANSPORTATION_RIDESHARE", description: "Ride-sharing and delivery services", website: "https://www.uber.com", scope: "FEDERAL", popularityScore: 95, tags: ["ride-share", "delivery"] },
  { name: "Lyft", slug: "lyft", category: "TRANSPORTATION_RIDESHARE", description: "Ride-sharing service", website: "https://www.lyft.com", scope: "FEDERAL", popularityScore: 88, tags: ["ride-share"] },
  { name: "Grubhub", slug: "grubhub", category: "LOCAL_DINING", description: "Order delivery and pickup from local restaurants", website: "https://www.grubhub.com", phone: "1-877-585-7878", scope: "FEDERAL", popularityScore: 82, tags: ["dining", "delivery"] },

  // ══════════════════════════════════════════════════════════
  // SHOPPING / RETAIL
  // ══════════════════════════════════════════════════════════
  { name: "Walmart", slug: "walmart", category: "SHOPPING_RETAIL", description: "Everyday low prices, groceries and more", website: "https://www.walmart.com", phone: "1-800-925-6278", scope: "FEDERAL", popularityScore: 98, tags: ["shopping", "grocery"] },
  { name: "Target", slug: "target", category: "SHOPPING_RETAIL", description: "Expect more, pay less", website: "https://www.target.com", phone: "1-800-440-0680", scope: "FEDERAL", popularityScore: 92, tags: ["shopping", "grocery"] },
  { name: "IKEA", slug: "ikea", category: "SHOPPING_RETAIL", description: "Furniture and home goods", website: "https://www.ikea.com/us", phone: "1-888-888-4532", scope: "FEDERAL", popularityScore: 82, tags: ["shopping", "home"] },
  { name: "Best Buy", slug: "best-buy", category: "SHOPPING_RETAIL", description: "Electronics and technology", website: "https://www.bestbuy.com", phone: "1-888-237-8289", scope: "FEDERAL", popularityScore: 85, tags: ["shopping"] },
  { name: "Trader Joe's", slug: "trader-joes", category: "SHOPPING_RETAIL", description: "Specialty grocery chain", website: "https://www.traderjoes.com", scope: "FEDERAL", popularityScore: 88, tags: ["shopping", "grocery"] },
  { name: "Whole Foods Market", slug: "whole-foods", category: "SHOPPING_RETAIL", description: "Natural and organic foods by Amazon", website: "https://www.wholefoodsmarket.com", scope: "FEDERAL", popularityScore: 82, tags: ["shopping", "grocery"] },
  { name: "Aldi", slug: "aldi", category: "SHOPPING_RETAIL", description: "Discount grocery stores", website: "https://www.aldi.us", scope: "FEDERAL", popularityScore: 85, tags: ["shopping", "grocery", "budget"] },

  // ══════════════════════════════════════════════════════════
  // CONVENIENCE / GAS STATIONS (NEW)
  // ══════════════════════════════════════════════════════════
  { name: "Wawa", slug: "wawa", category: "SHOPPING_RETAIL", description: "Convenience store and gas (PA, NJ, DE, MD, VA, DC, FL)", website: "https://www.wawa.com", scope: "FEDERAL", popularityScore: 82, tags: ["convenience", "gas"] },
  { name: "Sheetz", slug: "sheetz", category: "SHOPPING_RETAIL", description: "Convenience store and gas (PA, WV, VA, MD, OH, NC)", website: "https://www.sheetz.com", scope: "FEDERAL", popularityScore: 78, tags: ["convenience", "gas"] },
  { name: "7-Eleven", slug: "7-eleven", category: "SHOPPING_RETAIL", description: "Convenience stores worldwide", website: "https://www.7-eleven.com", scope: "FEDERAL", popularityScore: 85, tags: ["convenience"] },
  { name: "Circle K", slug: "circle-k", category: "SHOPPING_RETAIL", description: "Convenience stores and gas stations", website: "https://www.circlek.com", scope: "FEDERAL", popularityScore: 78, tags: ["convenience", "gas"] },

  // ══════════════════════════════════════════════════════════
  // IDENTITY PROTECTION (NEW CATEGORY)
  // ══════════════════════════════════════════════════════════
  { name: "LifeLock (Norton)", slug: "lifelock", category: "SECURITY_IDENTITY", description: "Identity theft protection and credit monitoring", website: "https://www.lifelock.com", phone: "1-800-543-3562", scope: "FEDERAL", popularityScore: 88, tags: ["identity", "security"] },
  { name: "Aura", slug: "aura-identity", category: "SECURITY_IDENTITY", description: "All-in-one digital security and identity protection", website: "https://www.aura.com", scope: "FEDERAL", popularityScore: 82, tags: ["identity", "security"] },
  { name: "IdentityForce", slug: "identityforce", category: "SECURITY_IDENTITY", description: "Identity theft protection service", website: "https://www.identityforce.com", scope: "FEDERAL", popularityScore: 72, tags: ["identity", "security"] },
  { name: "Identity Guard", slug: "identity-guard", category: "SECURITY_IDENTITY", description: "AI-powered identity theft protection", website: "https://www.identityguard.com", scope: "FEDERAL", popularityScore: 70, tags: ["identity", "security"] },

  // ══════════════════════════════════════════════════════════
  // ONLINE EDUCATION (NEW CATEGORY)
  // ══════════════════════════════════════════════════════════
  { name: "Coursera", slug: "coursera", category: "EDUCATION_ONLINE", description: "Online courses from top universities", website: "https://www.coursera.org", scope: "FEDERAL", popularityScore: 85, tags: ["education", "online"] },
  { name: "Udemy", slug: "udemy", category: "EDUCATION_ONLINE", description: "Online learning marketplace", website: "https://www.udemy.com", scope: "FEDERAL", popularityScore: 82, tags: ["education", "online"] },
  { name: "LinkedIn Learning", slug: "linkedin-learning", category: "EDUCATION_ONLINE", description: "Professional development courses", website: "https://www.linkedin.com/learning", scope: "FEDERAL", popularityScore: 80, tags: ["education", "online"] },
  { name: "Skillshare", slug: "skillshare", category: "EDUCATION_ONLINE", description: "Creative and business classes", website: "https://www.skillshare.com", scope: "FEDERAL", popularityScore: 72, tags: ["education", "online"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: DEEPEN CRITICAL FEDERAL CATEGORIES (2026-04-17)
  // ══════════════════════════════════════════════════════════

  // ── HEALTHCARE_VET (specialty + telehealth) ──
  { name: "BluePearl Pet Hospital", slug: "bluepearl", category: "HEALTHCARE_VET", description: "24/7 emergency and specialty veterinary care", website: "https://bluepearlvet.com", phone: "1-855-880-6082", scope: "FEDERAL", popularityScore: 68, tags: ["pet", "vet", "emergency"] },
  { name: "Chewy Connect with a Vet", slug: "chewy-vet", category: "HEALTHCARE_VET", description: "Virtual vet consultations for Chewy customers", website: "https://www.chewy.com/app/content/connect-with-a-vet", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "vet", "telehealth"] },
  { name: "Dutch", slug: "dutch-vet", category: "HEALTHCARE_VET", description: "Online vet for dogs and cats — 24/7 telehealth", website: "https://www.dutch.com", scope: "FEDERAL", popularityScore: 62, tags: ["pet", "vet", "telehealth"] },
  { name: "1-800-PetMeds", slug: "petmeds", category: "HEALTHCARE_VET", description: "Pet pharmacy and prescriptions", website: "https://www.1800petmeds.com", phone: "1-800-738-6337", scope: "FEDERAL", popularityScore: 70, tags: ["pet", "vet", "pharmacy"] },

  // ── KIDS_SCHOOL (research tools) ──
  { name: "GreatSchools", slug: "greatschools", category: "KIDS_SCHOOL", description: "Ratings and research on K-12 public and private schools", website: "https://www.greatschools.org", scope: "FEDERAL", popularityScore: 82, tags: ["kids", "education", "children", "research"] },
  { name: "Niche", slug: "niche", category: "KIDS_SCHOOL", description: "K-12 and college rankings, reviews, and research", website: "https://www.niche.com", scope: "FEDERAL", popularityScore: 78, tags: ["kids", "education", "children", "research"] },

  // ── KIDS_DAYCARE (expansion) ──
  { name: "Sittercity", slug: "sittercity", category: "KIDS_DAYCARE", description: "Find babysitters, nannies, and pet sitters", website: "https://www.sittercity.com", scope: "FEDERAL", popularityScore: 72, tags: ["kids", "daycare", "children", "pet"] },

  // ── FINANCIAL_MORTGAGE (lender depth) ──
  { name: "loanDepot", slug: "loandepot", category: "FINANCIAL_MORTGAGE", description: "National mortgage lender — purchase and refinance", website: "https://www.loandepot.com", phone: "1-888-337-6888", scope: "FEDERAL", popularityScore: 70, tags: ["mortgage", "home", "loan"] },
  { name: "Guild Mortgage", slug: "guild-mortgage", category: "FINANCIAL_MORTGAGE", description: "Home loans, refinancing, and first-time buyer programs", website: "https://www.guildmortgage.com", phone: "1-800-365-4884", scope: "FEDERAL", popularityScore: 65, tags: ["mortgage", "home", "loan"] },
  { name: "AmeriSave Mortgage", slug: "amerisave", category: "FINANCIAL_MORTGAGE", description: "Direct-to-consumer online mortgage lender", website: "https://www.amerisave.com", phone: "1-866-865-2141", scope: "FEDERAL", popularityScore: 62, tags: ["mortgage", "home", "loan", "online"] },
  { name: "PennyMac", slug: "pennymac", category: "FINANCIAL_MORTGAGE", description: "Top mortgage lender and servicer", website: "https://www.pennymacusa.com", phone: "1-866-549-3583", scope: "FEDERAL", popularityScore: 68, tags: ["mortgage", "home", "loan"] },

  // ── FINANCIAL_INSURANCE_FLOOD (private carriers) ──
  { name: "Neptune Flood", slug: "neptune-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "Private flood insurance — alternative to NFIP", website: "https://neptuneflood.com", phone: "1-727-202-4815", scope: "FEDERAL", popularityScore: 68, tags: ["home", "insurance", "flood"] },
  { name: "Assurant Flood Solutions", slug: "assurant-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "Flood insurance through Assurant partners", website: "https://www.assurant.com", scope: "FEDERAL", popularityScore: 60, tags: ["home", "insurance", "flood"] },
  { name: "SelectQuote Flood", slug: "selectquote-flood", category: "FINANCIAL_INSURANCE_FLOOD", description: "Compare flood insurance quotes from multiple carriers", website: "https://www.selectquote.com", phone: "1-855-653-0942", scope: "FEDERAL", popularityScore: 58, tags: ["home", "insurance", "flood"] },
];

export const STATE_DMVS = [
  { name: "Alabama DMV", slug: "dmv-al", states: ["AL"], website: "https://www.alea.gov", phone: "1-334-242-4400", description: "Alabama Law Enforcement Agency - Driver License", popularityScore: 90 },
  { name: "Alaska DMV", slug: "dmv-ak", states: ["AK"], website: "https://doa.alaska.gov/dmv", phone: "1-907-269-5551", description: "Alaska Division of Motor Vehicles", popularityScore: 85 },
  { name: "Arizona MVD", slug: "dmv-az", states: ["AZ"], website: "https://azdot.gov/mvd", phone: "1-602-255-0072", description: "Arizona Motor Vehicle Division", popularityScore: 92 },
  { name: "Arkansas DFA", slug: "dmv-ar", states: ["AR"], website: "https://www.dfa.arkansas.gov", phone: "1-501-682-4692", description: "Arkansas Dept of Finance and Administration", popularityScore: 85 },
  { name: "California DMV", slug: "dmv-ca", states: ["CA"], website: "https://www.dmv.ca.gov", phone: "1-800-777-0133", description: "California Department of Motor Vehicles", popularityScore: 98 },
  { name: "Colorado DMV", slug: "dmv-co", states: ["CO"], website: "https://dmv.colorado.gov", phone: "1-303-205-5600", description: "Colorado Division of Motor Vehicles", popularityScore: 90 },
  { name: "Connecticut DMV", slug: "dmv-ct", states: ["CT"], website: "https://portal.ct.gov/dmv", phone: "1-860-263-5700", description: "Connecticut Dept of Motor Vehicles", popularityScore: 88 },
  { name: "Delaware DMV", slug: "dmv-de", states: ["DE"], website: "https://www.dmv.de.gov", phone: "1-302-744-2500", description: "Delaware Division of Motor Vehicles", popularityScore: 85 },
  { name: "DC DMV", slug: "dmv-dc", states: ["DC"], website: "https://dmv.dc.gov", phone: "1-202-737-4404", description: "District of Columbia DMV", popularityScore: 88 },
  { name: "Florida DHSMV", slug: "dmv-fl", states: ["FL"], website: "https://www.flhsmv.gov", phone: "1-850-617-2000", description: "Florida Dept of Highway Safety and Motor Vehicles", popularityScore: 95 },
  { name: "Georgia DDS", slug: "dmv-ga", states: ["GA"], website: "https://dds.georgia.gov", phone: "1-678-413-8400", description: "Georgia Dept of Driver Services", popularityScore: 92 },
  { name: "Hawaii DMV", slug: "dmv-hi", states: ["HI"], website: "https://hidot.hawaii.gov", phone: "1-808-768-4385", description: "Hawaii County Vehicle Registration", popularityScore: 82 },
  { name: "Idaho DMV", slug: "dmv-id", states: ["ID"], website: "https://itd.idaho.gov/dmv", phone: "1-208-334-8000", description: "Idaho Transportation Department", popularityScore: 85 },
  { name: "Illinois SOS", slug: "dmv-il", states: ["IL"], website: "https://www.ilsos.gov", phone: "1-800-252-8980", description: "Illinois Secretary of State Driver Services", popularityScore: 92 },
  { name: "Indiana BMV", slug: "dmv-in", states: ["IN"], website: "https://www.in.gov/bmv", phone: "1-888-692-6841", description: "Indiana Bureau of Motor Vehicles", popularityScore: 88 },
  { name: "Iowa DOT", slug: "dmv-ia", states: ["IA"], website: "https://iowadot.gov/mvd", phone: "1-800-532-1121", description: "Iowa Dept of Transportation Motor Vehicle", popularityScore: 85 },
  { name: "Kansas DMV", slug: "dmv-ks", states: ["KS"], website: "https://www.ksrevenue.gov/dovindex.html", phone: "1-785-296-3963", description: "Kansas Division of Vehicles", popularityScore: 85 },
  { name: "Kentucky DMV", slug: "dmv-ky", states: ["KY"], website: "https://drive.ky.gov", phone: "1-502-564-1257", description: "Kentucky Transportation Cabinet", popularityScore: 85 },
  { name: "Louisiana OMV", slug: "dmv-la", states: ["LA"], website: "https://expresslane.org", phone: "1-877-368-5463", description: "Louisiana Office of Motor Vehicles", popularityScore: 88 },
  { name: "Maine BMV", slug: "dmv-me", states: ["ME"], website: "https://www.maine.gov/sos/bmv", phone: "1-207-624-9000", description: "Maine Bureau of Motor Vehicles", popularityScore: 82 },
  { name: "Maryland MVA", slug: "dmv-md", states: ["MD"], website: "https://mva.maryland.gov", phone: "1-410-768-7000", description: "Maryland Motor Vehicle Administration", popularityScore: 90 },
  { name: "Massachusetts RMV", slug: "dmv-ma", states: ["MA"], website: "https://www.mass.gov/rmv", phone: "1-857-368-8000", description: "Massachusetts Registry of Motor Vehicles", popularityScore: 90 },
  { name: "Michigan SOS", slug: "dmv-mi", states: ["MI"], website: "https://www.michigan.gov/sos", phone: "1-888-767-6424", description: "Michigan Secretary of State", popularityScore: 90 },
  { name: "Minnesota DVS", slug: "dmv-mn", states: ["MN"], website: "https://dps.mn.gov/dvs", phone: "1-651-297-3298", description: "Minnesota Driver and Vehicle Services", popularityScore: 88 },
  { name: "Mississippi DPS", slug: "dmv-ms", states: ["MS"], website: "https://www.dps.state.ms.us", phone: "1-601-987-1212", description: "Mississippi Dept of Public Safety", popularityScore: 82 },
  { name: "Missouri DMV", slug: "dmv-mo", states: ["MO"], website: "https://dor.mo.gov/motor-vehicle", phone: "1-573-526-3669", description: "Missouri Dept of Revenue Motor Vehicle", popularityScore: 88 },
  { name: "Montana MVD", slug: "dmv-mt", states: ["MT"], website: "https://dojmt.gov/driving", phone: "1-406-444-3933", description: "Montana Motor Vehicle Division", popularityScore: 80 },
  { name: "Nebraska DMV", slug: "dmv-ne", states: ["NE"], website: "https://dmv.nebraska.gov", phone: "1-402-471-3861", description: "Nebraska Dept of Motor Vehicles", popularityScore: 85 },
  { name: "Nevada DMV", slug: "dmv-nv", states: ["NV"], website: "https://dmvnv.com", phone: "1-702-486-4368", description: "Nevada Department of Motor Vehicles", popularityScore: 90 },
  { name: "New Hampshire DMV", slug: "dmv-nh", states: ["NH"], website: "https://www.dmv.nh.gov", phone: "1-603-227-4000", description: "New Hampshire Division of Motor Vehicles", popularityScore: 85 },
  { name: "New Jersey MVC", slug: "dmv-nj", states: ["NJ"], website: "https://www.nj.gov/mvc", phone: "1-609-292-6500", description: "New Jersey Motor Vehicle Commission", popularityScore: 92 },
  { name: "New Mexico MVD", slug: "dmv-nm", states: ["NM"], website: "https://www.mvd.newmexico.gov", phone: "1-888-683-4636", description: "New Mexico Motor Vehicle Division", popularityScore: 85 },
  { name: "New York DMV", slug: "dmv-ny", states: ["NY"], website: "https://dmv.ny.gov", phone: "1-518-486-9786", description: "New York Department of Motor Vehicles", popularityScore: 95 },
  { name: "North Carolina DMV", slug: "dmv-nc", states: ["NC"], website: "https://www.ncdot.gov/dmv", phone: "1-919-715-7000", description: "North Carolina Division of Motor Vehicles", popularityScore: 90 },
  { name: "North Dakota DOT", slug: "dmv-nd", states: ["ND"], website: "https://www.dot.nd.gov/divisions/drivers", phone: "1-701-328-2725", description: "North Dakota Drivers License Division", popularityScore: 80 },
  { name: "Ohio BMV", slug: "dmv-oh", states: ["OH"], website: "https://www.bmv.ohio.gov", phone: "1-844-644-6268", description: "Ohio Bureau of Motor Vehicles", popularityScore: 90 },
  { name: "Oklahoma DPS", slug: "dmv-ok", states: ["OK"], website: "https://oklahoma.gov/dps", phone: "1-405-425-2424", description: "Oklahoma Dept of Public Safety", popularityScore: 85 },
  { name: "Oregon DMV", slug: "dmv-or", states: ["OR"], website: "https://www.oregon.gov/odot/dmv", phone: "1-503-945-5000", description: "Oregon Driver and Motor Vehicle Services", popularityScore: 88 },
  { name: "Pennsylvania DOT", slug: "dmv-pa", states: ["PA"], website: "https://www.dmv.pa.gov", phone: "1-717-412-5300", description: "Pennsylvania Dept of Transportation", popularityScore: 90 },
  { name: "Rhode Island DMV", slug: "dmv-ri", states: ["RI"], website: "https://dmv.ri.gov", phone: "1-401-462-4368", description: "Rhode Island Division of Motor Vehicles", popularityScore: 82 },
  { name: "South Carolina DMV", slug: "dmv-sc", states: ["SC"], website: "https://www.scdmvonline.com", phone: "1-803-896-5000", description: "South Carolina Dept of Motor Vehicles", popularityScore: 88 },
  { name: "South Dakota DPS", slug: "dmv-sd", states: ["SD"], website: "https://dps.sd.gov/driver-licensing", phone: "1-605-773-6883", description: "South Dakota Driver Licensing", popularityScore: 80 },
  { name: "Tennessee DOR", slug: "dmv-tn", states: ["TN"], website: "https://www.tn.gov/revenue/title-and-registration", phone: "1-615-741-3101", description: "Tennessee Dept of Revenue Driver Services", popularityScore: 88 },
  { name: "Texas DPS", slug: "dmv-tx", states: ["TX"], website: "https://www.dps.texas.gov/section/driver-license", phone: "1-512-424-2600", description: "Texas Dept of Public Safety Driver License", popularityScore: 95 },
  { name: "Utah DLD", slug: "dmv-ut", states: ["UT"], website: "https://dld.utah.gov", phone: "1-801-965-4437", description: "Utah Driver License Division", popularityScore: 85 },
  { name: "Vermont DMV", slug: "dmv-vt", states: ["VT"], website: "https://dmv.vermont.gov", phone: "1-802-828-2000", description: "Vermont Dept of Motor Vehicles", popularityScore: 82 },
  { name: "Virginia DMV", slug: "dmv-va", states: ["VA"], website: "https://www.dmv.virginia.gov", phone: "1-804-497-7100", description: "Virginia Dept of Motor Vehicles", popularityScore: 92 },
  { name: "Washington DOL", slug: "dmv-wa", states: ["WA"], website: "https://www.dol.wa.gov", phone: "1-360-902-3900", description: "Washington Dept of Licensing", popularityScore: 90 },
  { name: "West Virginia DMV", slug: "dmv-wv", states: ["WV"], website: "https://transportation.wv.gov/dmv", phone: "1-800-642-9066", description: "West Virginia Division of Motor Vehicles", popularityScore: 82 },
  { name: "Wisconsin DMV", slug: "dmv-wi", states: ["WI"], website: "https://wisconsindot.gov/pages/dmv", phone: "1-608-264-7447", description: "Wisconsin Division of Motor Vehicles", popularityScore: 88 },
  { name: "Wyoming DMV", slug: "dmv-wy", states: ["WY"], website: "https://www.dot.state.wy.us", phone: "1-307-777-4800", description: "Wyoming Dept of Transportation", popularityScore: 80 },
];

// ============================================================
// STATE-LEVEL PROVIDERS (utilities, transit, health, toll, ISP)
// Consolidated from seed-providers.ts + seed-providers-all-states.ts
// + seed-providers-expanded.ts + new additions
// ============================================================
export const STATE_PROVIDERS = [
  // ── New Jersey ──
  { name: "PSE&G", slug: "pseg", category: "UTILITY_ELECTRIC", description: "Public Service Electric and Gas", website: "https://www.pseg.com", phone: "1-800-436-7734", scope: "STATE", states: ["NJ"], popularityScore: 95, tags: ["electric", "gas"] },
  { name: "JCP&L", slug: "jcpl", category: "UTILITY_ELECTRIC", description: "Jersey Central Power & Light", website: "https://www.firstenergycorp.com/jcpl", phone: "1-800-662-3115", scope: "STATE", states: ["NJ"], popularityScore: 70, tags: ["electric"] },
  { name: "New Jersey American Water", slug: "nj-american-water", category: "UTILITY_WATER", description: "Water utility for NJ", website: "https://www.amwater.com/njaw", phone: "1-800-652-6987", scope: "STATE", states: ["NJ"], popularityScore: 80, tags: ["water"] },
  { name: "NJ E-ZPass", slug: "nj-ezpass", category: "TRANSPORTATION_TOLL", description: "NJ Turnpike toll pass", website: "https://www.ezpassnj.com", phone: "1-888-288-6865", scope: "STATE", states: ["NJ"], popularityScore: 90, tags: ["toll", "car", "driving"] },
  { name: "NJ Transit", slug: "nj-transit", category: "TRANSPORTATION_TRANSIT", description: "NJ public transportation", website: "https://www.njtransit.com", phone: "1-973-275-5555", scope: "STATE", states: ["NJ"], popularityScore: 85, tags: ["transit", "bus", "train"] },
  { name: "Elizabethtown Gas", slug: "elizabethtown-gas", category: "UTILITY_GAS", description: "Natural gas utility NJ", website: "https://www.southerncompanygas.com/elizabethtown-gas", scope: "STATE", states: ["NJ"], popularityScore: 65, tags: ["gas"] },
  { name: "Horizon BCBS NJ", slug: "horizon-bcbs-nj", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of New Jersey", website: "https://www.horizonblue.com", phone: "1-800-355-2583", scope: "STATE", states: ["NJ"], popularityScore: 88, tags: ["health"] },
  { name: "NJ Natural Gas", slug: "njng", category: "UTILITY_GAS", description: "New Jersey Natural Gas", website: "https://www.njng.com", phone: "1-800-221-0051", scope: "STATE", states: ["NJ"], popularityScore: 72, tags: ["gas"] },
  { name: "GetCoveredNJ", slug: "getcoverednj", category: "FINANCIAL_INSURANCE_HEALTH", description: "NJ Health Insurance Marketplace", website: "https://www.getcovered.nj.gov", scope: "STATE", states: ["NJ"], popularityScore: 78, tags: ["health", "marketplace"] },
  { name: "NJ Division of Taxation", slug: "nj-tax", category: "GOVERNMENT_TAX", description: "NJ state income tax", website: "https://www.nj.gov/treasury/taxation", scope: "STATE", states: ["NJ"], popularityScore: 85, tags: ["tax", "government"] },

  // ── New York ──
  { name: "Con Edison", slug: "con-edison", category: "UTILITY_ELECTRIC", description: "Consolidated Edison", website: "https://www.coned.com", phone: "1-800-752-6633", scope: "STATE", states: ["NY"], popularityScore: 95, tags: ["electric", "gas"] },
  { name: "National Grid NY", slug: "national-grid-ny", category: "UTILITY_GAS", description: "Gas and electric for upstate NY", website: "https://www.nationalgridus.com", phone: "1-800-642-4272", scope: "STATE", states: ["NY"], popularityScore: 75, tags: ["gas", "electric"] },
  { name: "NYC Water Board", slug: "nyc-water", category: "UTILITY_WATER", description: "NYC water and sewer", website: "https://www1.nyc.gov/site/dep", scope: "STATE", states: ["NY"], popularityScore: 85, tags: ["water"] },
  { name: "MTA", slug: "mta", category: "TRANSPORTATION_TRANSIT", description: "Metropolitan Transportation Authority", website: "https://www.mta.info", scope: "STATE", states: ["NY"], popularityScore: 95, tags: ["transit", "subway", "bus"] },
  { name: "NY E-ZPass", slug: "ny-ezpass", category: "TRANSPORTATION_TOLL", description: "New York toll pass", website: "https://www.e-zpassny.com", scope: "STATE", states: ["NY"], popularityScore: 88, tags: ["toll", "car"] },
  { name: "Optimum", slug: "optimum", category: "UTILITY_INTERNET", description: "Internet and TV for NY/NJ/CT", website: "https://www.optimum.com", phone: "1-866-347-4784", scope: "STATE", states: ["NY", "NJ", "CT"], popularityScore: 72, tags: ["internet", "cable", "tv"] },
  { name: "NY State of Health", slug: "ny-health-marketplace", category: "FINANCIAL_INSURANCE_HEALTH", description: "NY Health Insurance Marketplace", website: "https://nystateofhealth.ny.gov", scope: "STATE", states: ["NY"], popularityScore: 80, tags: ["health", "marketplace"] },

  // ── Texas ──
  { name: "TXU Energy", slug: "txu-energy", category: "UTILITY_ELECTRIC", description: "Texas electricity provider", website: "https://www.txu.com", phone: "1-800-818-6132", scope: "STATE", states: ["TX"], popularityScore: 88, tags: ["electric"] },
  { name: "Reliant Energy", slug: "reliant", category: "UTILITY_ELECTRIC", description: "Texas electricity provider", website: "https://www.reliant.com", phone: "1-866-222-7100", scope: "STATE", states: ["TX"], popularityScore: 82, tags: ["electric"] },
  { name: "CenterPoint Energy", slug: "centerpoint", category: "UTILITY_GAS", description: "Natural gas delivery in TX", website: "https://www.centerpointenergy.com", phone: "1-800-332-7143", scope: "STATE", states: ["TX"], popularityScore: 80, tags: ["gas"] },
  { name: "TxTag", slug: "txtag", category: "TRANSPORTATION_TOLL", description: "Texas toll tag", website: "https://www.txtag.org", phone: "1-888-468-9824", scope: "STATE", states: ["TX"], popularityScore: 88, tags: ["toll", "car", "driving"] },
  { name: "DART", slug: "dart", category: "TRANSPORTATION_TRANSIT", description: "Dallas Area Rapid Transit", website: "https://www.dart.org", phone: "1-214-979-1111", scope: "STATE", states: ["TX"], popularityScore: 65, tags: ["transit", "bus", "train"] },
  { name: "BCBS Texas", slug: "bcbs-tx", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Texas", website: "https://www.bcbstx.com", phone: "1-800-521-2227", scope: "STATE", states: ["TX"], popularityScore: 85, tags: ["health"] },
  { name: "H-E-B", slug: "heb", category: "SHOPPING_RETAIL", description: "Texas-based supermarket chain", website: "https://www.heb.com", scope: "STATE", states: ["TX"], popularityScore: 95, tags: ["shopping", "grocery"] },
  { name: "Austin Water", slug: "austin-water", category: "UTILITY_WATER", description: "Water utility for Austin", website: "https://www.austintexas.gov/department/water", phone: "1-512-972-0000", scope: "STATE", states: ["TX"], popularityScore: 75, tags: ["water"] },
  { name: "Dallas Water Utilities", slug: "dallas-water", category: "UTILITY_WATER", description: "Water for Dallas metro", website: "https://www.dallascityhall.com/departments/waterutilities", phone: "1-214-651-1441", scope: "STATE", states: ["TX"], popularityScore: 78, tags: ["water"] },
  { name: "Houston Public Works", slug: "houston-water", category: "UTILITY_WATER", description: "Water for Houston", website: "https://www.houstontx.gov/publicworks", phone: "1-713-371-8834", scope: "STATE", states: ["TX"], popularityScore: 80, tags: ["water"] },
  { name: "San Antonio Water System", slug: "saws", category: "UTILITY_WATER", description: "SAWS water utility", website: "https://www.saws.org", phone: "1-210-704-7297", scope: "STATE", states: ["TX"], popularityScore: 72, tags: ["water"] },
  { name: "Atmos Energy", slug: "atmos-energy", category: "UTILITY_GAS", description: "Natural gas for Texas", website: "https://www.atmosenergy.com", phone: "1-888-286-6700", scope: "STATE", states: ["TX"], popularityScore: 78, tags: ["gas"] },
  { name: "Houston METRO", slug: "metro-houston", category: "TRANSPORTATION_TRANSIT", description: "Houston public transit", website: "https://www.ridemetro.org", phone: "1-713-635-4000", scope: "STATE", states: ["TX"], popularityScore: 75, tags: ["transit", "bus", "train"] },
  { name: "VIA Metropolitan Transit", slug: "via-sa", category: "TRANSPORTATION_TRANSIT", description: "San Antonio public transit", website: "https://www.viainfo.net", phone: "1-210-362-2020", scope: "STATE", states: ["TX"], popularityScore: 70, tags: ["transit", "bus"] },
  { name: "CapMetro", slug: "capmetro", category: "TRANSPORTATION_TRANSIT", description: "Austin public transit", website: "https://www.capmetro.org", phone: "1-512-474-1200", scope: "STATE", states: ["TX"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "Trinity Metro", slug: "trinity-metro", category: "TRANSPORTATION_TRANSIT", description: "Fort Worth public transit", website: "https://ridetrinitymetro.org", phone: "1-817-215-8600", scope: "STATE", states: ["TX"], popularityScore: 65, tags: ["transit", "bus"] },

  // ── California ──
  { name: "PG&E", slug: "pge", category: "UTILITY_ELECTRIC", description: "Pacific Gas and Electric", website: "https://www.pge.com", phone: "1-800-743-5000", scope: "STATE", states: ["CA"], popularityScore: 92, tags: ["electric", "gas"] },
  { name: "SoCal Edison", slug: "sce", category: "UTILITY_ELECTRIC", description: "Southern California Edison", website: "https://www.sce.com", phone: "1-800-655-4555", scope: "STATE", states: ["CA"], popularityScore: 88, tags: ["electric"] },
  { name: "SoCal Gas", slug: "socalgas", category: "UTILITY_GAS", description: "Southern California Gas", website: "https://www.socalgas.com", phone: "1-800-427-2200", scope: "STATE", states: ["CA"], popularityScore: 85, tags: ["gas"] },
  { name: "LADWP", slug: "ladwp", category: "UTILITY_WATER", description: "LA Dept of Water and Power", website: "https://www.ladwp.com", phone: "1-800-342-5397", scope: "STATE", states: ["CA"], popularityScore: 82, tags: ["water", "electric"] },
  { name: "FasTrak", slug: "fastrak", category: "TRANSPORTATION_TOLL", description: "California toll pass", website: "https://www.bayareafastrak.org", scope: "STATE", states: ["CA"], popularityScore: 85, tags: ["toll", "car", "driving"] },
  { name: "LA Metro", slug: "la-metro", category: "TRANSPORTATION_TRANSIT", description: "Los Angeles Metro", website: "https://www.metro.net", scope: "STATE", states: ["CA"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "BART", slug: "bart", category: "TRANSPORTATION_TRANSIT", description: "Bay Area Rapid Transit", website: "https://www.bart.gov", scope: "STATE", states: ["CA"], popularityScore: 78, tags: ["transit", "train"] },
  { name: "SF Muni", slug: "muni", category: "TRANSPORTATION_TRANSIT", description: "San Francisco Municipal Railway", website: "https://www.sfmta.com", phone: "1-415-701-2311", scope: "STATE", states: ["CA"], popularityScore: 75, tags: ["transit", "bus", "train"] },
  { name: "Caltrain", slug: "caltrain", category: "TRANSPORTATION_TRANSIT", description: "SF to San Jose commuter rail", website: "https://www.caltrain.com", phone: "1-800-660-4287", scope: "STATE", states: ["CA"], popularityScore: 72, tags: ["transit", "train"] },
  { name: "San Diego MTS", slug: "mts-sd", category: "TRANSPORTATION_TRANSIT", description: "San Diego bus and trolley", website: "https://www.sdmts.com", phone: "1-619-233-3004", scope: "STATE", states: ["CA"], popularityScore: 70, tags: ["transit", "bus", "train"] },
  { name: "AC Transit", slug: "ac-transit", category: "TRANSPORTATION_TRANSIT", description: "Alameda-Contra Costa bus", website: "https://www.actransit.org", phone: "1-510-891-4777", scope: "STATE", states: ["CA"], popularityScore: 68, tags: ["transit", "bus"] },
  { name: "VTA", slug: "vta", category: "TRANSPORTATION_TRANSIT", description: "Silicon Valley transit", website: "https://www.vta.org", phone: "1-408-321-2300", scope: "STATE", states: ["CA"], popularityScore: 68, tags: ["transit", "bus", "train"] },
  { name: "Covered California", slug: "covered-ca", category: "FINANCIAL_INSURANCE_HEALTH", description: "CA health insurance marketplace", website: "https://www.coveredca.com", phone: "1-800-300-1506", scope: "STATE", states: ["CA"], popularityScore: 80, tags: ["health", "marketplace"] },

  // ── Florida ──
  { name: "FPL (Florida Power & Light)", slug: "fpl", category: "UTILITY_ELECTRIC", description: "Largest electric utility in FL", website: "https://www.fpl.com", phone: "1-800-468-8243", scope: "STATE", states: ["FL"], popularityScore: 92, tags: ["electric"] },
  { name: "Duke Energy Florida", slug: "duke-fl", category: "UTILITY_ELECTRIC", description: "Electric utility in FL", website: "https://www.duke-energy.com/florida", phone: "1-800-700-8744", scope: "STATE", states: ["FL"], popularityScore: 78, tags: ["electric"] },
  { name: "SunPass", slug: "sunpass", category: "TRANSPORTATION_TOLL", description: "Florida toll pass", website: "https://www.sunpass.com", phone: "1-888-865-5352", scope: "STATE", states: ["FL"], popularityScore: 90, tags: ["toll", "car", "driving"] },
  { name: "Florida Blue", slug: "florida-blue", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Florida", website: "https://www.floridablue.com", phone: "1-800-352-2583", scope: "STATE", states: ["FL"], popularityScore: 85, tags: ["health"] },
  { name: "Publix", slug: "publix", category: "SHOPPING_RETAIL", description: "Employee-owned supermarket chain", website: "https://www.publix.com", scope: "STATE", states: ["FL", "GA", "AL", "SC", "NC", "TN", "VA"], popularityScore: 92, tags: ["shopping", "grocery"] },
  { name: "Orlando Utilities Commission", slug: "ouc", category: "UTILITY_ELECTRIC", description: "OUC electric and water for Orlando", website: "https://www.ouc.com", phone: "1-407-423-9018", scope: "STATE", states: ["FL"], popularityScore: 75, tags: ["electric", "water"] },
  { name: "JEA", slug: "jea", category: "UTILITY_WATER", description: "Jacksonville water and electric", website: "https://www.jea.com", phone: "1-904-665-6000", scope: "STATE", states: ["FL"], popularityScore: 72, tags: ["water", "electric"] },
  { name: "Tampa Water Department", slug: "tampa-water", category: "UTILITY_WATER", description: "Water for Tampa", website: "https://www.tampa.gov/water", phone: "1-813-274-8811", scope: "STATE", states: ["FL"], popularityScore: 70, tags: ["water"] },
  { name: "Miami-Dade Water & Sewer", slug: "miami-water", category: "UTILITY_WATER", description: "Water for Miami-Dade County", website: "https://www.miamidade.gov/water", phone: "1-305-665-7477", scope: "STATE", states: ["FL"], popularityScore: 75, tags: ["water"] },
  { name: "TECO Peoples Gas", slug: "teco-gas", category: "UTILITY_GAS", description: "Natural gas for Florida", website: "https://www.tecoenergy.com", phone: "1-877-832-4677", scope: "STATE", states: ["FL"], popularityScore: 78, tags: ["gas"] },
  { name: "Miami-Dade Transit", slug: "miami-transit", category: "TRANSPORTATION_TRANSIT", description: "Metro, bus, and paratransit in Miami", website: "https://www.miamidade.gov/transit", phone: "1-305-891-3131", scope: "STATE", states: ["FL"], popularityScore: 72, tags: ["transit", "bus", "train"] },
  { name: "Lynx", slug: "lynx", category: "TRANSPORTATION_TRANSIT", description: "Central Florida public transit", website: "https://www.golynx.com", phone: "1-407-841-8240", scope: "STATE", states: ["FL"], popularityScore: 68, tags: ["transit", "bus"] },

  // ── Pennsylvania ──
  { name: "PECO Energy", slug: "peco", category: "UTILITY_ELECTRIC", description: "Electric and gas for SE Pennsylvania", website: "https://www.peco.com", phone: "1-800-494-4000", scope: "STATE", states: ["PA"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "PPL Electric", slug: "ppl", category: "UTILITY_ELECTRIC", description: "Electric for central/eastern PA", website: "https://www.pplelectric.com", phone: "1-800-342-5775", scope: "STATE", states: ["PA"], popularityScore: 75, tags: ["electric"] },
  { name: "PA Turnpike E-ZPass", slug: "pa-ezpass", category: "TRANSPORTATION_TOLL", description: "Pennsylvania toll pass", website: "https://www.paturnpike.com/ezpass", scope: "STATE", states: ["PA"], popularityScore: 85, tags: ["toll", "car"] },
  { name: "SEPTA", slug: "septa", category: "TRANSPORTATION_TRANSIT", description: "Southeastern PA Transportation", website: "https://www.septa.org", phone: "1-215-580-7800", scope: "STATE", states: ["PA"], popularityScore: 80, tags: ["transit", "bus", "train"] },
  { name: "Pennie (PA Marketplace)", slug: "pennie-pa", category: "FINANCIAL_INSURANCE_HEALTH", description: "PA Health Insurance Marketplace", website: "https://pennie.com", scope: "STATE", states: ["PA"], popularityScore: 75, tags: ["health", "marketplace"] },
  { name: "Philadelphia Water Department", slug: "philly-water", category: "UTILITY_WATER", description: "Water for Philadelphia", website: "https://water.phila.gov", phone: "1-215-685-6300", scope: "STATE", states: ["PA"], popularityScore: 78, tags: ["water"] },
  { name: "Pittsburgh Water & Sewer", slug: "pittsburgh-water", category: "UTILITY_WATER", description: "Water for Pittsburgh", website: "https://pittsburghwater.gov", phone: "1-412-255-2420", scope: "STATE", states: ["PA"], popularityScore: 72, tags: ["water"] },
  { name: "UGI Utilities", slug: "ugi", category: "UTILITY_GAS", description: "Natural gas for PA", website: "https://www.ugi.com", phone: "1-800-276-2722", scope: "STATE", states: ["PA"], popularityScore: 75, tags: ["gas"] },
  { name: "Pittsburgh Port Authority", slug: "pittsburgh-port-auth", category: "TRANSPORTATION_TRANSIT", description: "Pittsburgh public transit", website: "https://www.rideprt.org", phone: "1-412-442-2000", scope: "STATE", states: ["PA"], popularityScore: 70, tags: ["transit", "bus", "train"] },

  // ── Illinois ──
  { name: "ComEd", slug: "comed", category: "UTILITY_ELECTRIC", description: "Commonwealth Edison", website: "https://www.comed.com", phone: "1-800-334-7661", scope: "STATE", states: ["IL"], popularityScore: 92, tags: ["electric"] },
  { name: "Peoples Gas", slug: "peoples-gas", category: "UTILITY_GAS", description: "Natural gas for Chicago", website: "https://www.peoplesgasdelivery.com", phone: "1-866-556-6001", scope: "STATE", states: ["IL"], popularityScore: 80, tags: ["gas"] },
  { name: "I-PASS", slug: "ipass", category: "TRANSPORTATION_TOLL", description: "Illinois toll pass", website: "https://www.getipass.com", scope: "STATE", states: ["IL"], popularityScore: 85, tags: ["toll", "car"] },
  { name: "CTA", slug: "cta", category: "TRANSPORTATION_TRANSIT", description: "Chicago Transit Authority", website: "https://www.transitchicago.com", scope: "STATE", states: ["IL"], popularityScore: 90, tags: ["transit", "bus", "train"] },
  { name: "Chicago Water Department", slug: "chicago-water", category: "UTILITY_WATER", description: "Water for Chicago", website: "https://www.chicago.gov/water", phone: "1-312-744-4428", scope: "STATE", states: ["IL"], popularityScore: 80, tags: ["water"] },
  { name: "Illinois American Water", slug: "il-american-water", category: "UTILITY_WATER", description: "Water for Illinois", website: "https://www.amwater.com/ilaw", phone: "1-800-422-2782", scope: "STATE", states: ["IL"], popularityScore: 72, tags: ["water"] },
  { name: "Nicor Gas", slug: "nicor", category: "UTILITY_GAS", description: "Natural gas for Chicago suburbs", website: "https://www.nicorgas.com", phone: "1-888-642-6748", scope: "STATE", states: ["IL"], popularityScore: 75, tags: ["gas"] },
  { name: "Metra", slug: "metra", category: "TRANSPORTATION_TRANSIT", description: "Chicago commuter rail", website: "https://www.metrarail.com", phone: "1-312-322-6777", scope: "STATE", states: ["IL"], popularityScore: 78, tags: ["transit", "train"] },
  { name: "Pace Bus", slug: "pace", category: "TRANSPORTATION_TRANSIT", description: "Suburban Chicago bus service", website: "https://www.pacebus.com", phone: "1-847-364-7223", scope: "STATE", states: ["IL"], popularityScore: 68, tags: ["transit", "bus"] },

  // ── Georgia ──
  { name: "Georgia Power", slug: "georgia-power", category: "UTILITY_ELECTRIC", description: "Largest electric utility in GA", website: "https://www.georgiapower.com", phone: "1-888-660-5890", scope: "STATE", states: ["GA"], popularityScore: 92, tags: ["electric"] },
  { name: "Peach Pass", slug: "peach-pass", category: "TRANSPORTATION_TOLL", description: "Georgia toll pass", website: "https://www.peachpass.com", scope: "STATE", states: ["GA"], popularityScore: 80, tags: ["toll", "car"] },
  { name: "MARTA", slug: "marta", category: "TRANSPORTATION_TRANSIT", description: "Metropolitan Atlanta Rapid Transit", website: "https://www.itsmarta.com", scope: "STATE", states: ["GA"], popularityScore: 78, tags: ["transit", "bus", "train"] },
  { name: "Atlanta Watershed Management", slug: "atlanta-water", category: "UTILITY_WATER", description: "Water for Atlanta", website: "https://www.atlantawatershed.org", phone: "1-404-546-0311", scope: "STATE", states: ["GA"], popularityScore: 75, tags: ["water"] },
  { name: "Georgia Natural Gas", slug: "gng", category: "UTILITY_GAS", description: "Natural gas for Georgia", website: "https://www.gng.com", phone: "1-770-850-6200", scope: "STATE", states: ["GA"], popularityScore: 72, tags: ["gas"] },

  // ── Ohio ──
  { name: "Ohio Edison", slug: "ohio-edison", category: "UTILITY_ELECTRIC", description: "Electric utility for NE Ohio", website: "https://www.firstenergycorp.com/ohio-edison", scope: "STATE", states: ["OH"], popularityScore: 80, tags: ["electric"] },
  { name: "AEP Ohio", slug: "aep-ohio", category: "UTILITY_ELECTRIC", description: "American Electric Power Ohio", website: "https://www.aepohio.com", phone: "1-800-672-2231", scope: "STATE", states: ["OH"], popularityScore: 78, tags: ["electric"] },
  { name: "Columbia Gas of Ohio", slug: "columbia-gas-oh", category: "UTILITY_GAS", description: "Natural gas utility", website: "https://www.columbiagasohio.com", scope: "STATE", states: ["OH"], popularityScore: 75, tags: ["gas"] },
  { name: "Cleveland Water", slug: "cleveland-water", category: "UTILITY_WATER", description: "Water for Cleveland", website: "https://www.clevelandwater.com", phone: "1-216-664-3060", scope: "STATE", states: ["OH"], popularityScore: 72, tags: ["water"] },
  { name: "Columbus Utilities", slug: "columbus-water", category: "UTILITY_WATER", description: "Water for Columbus", website: "https://www.columbus.gov/utilities", phone: "1-614-645-8276", scope: "STATE", states: ["OH"], popularityScore: 75, tags: ["water"] },
  { name: "Cincinnati Water Works", slug: "cincy-water", category: "UTILITY_WATER", description: "Water for Cincinnati", website: "https://www.cincinnati-oh.gov/water", phone: "1-513-591-7700", scope: "STATE", states: ["OH"], popularityScore: 70, tags: ["water"] },
  { name: "COTA", slug: "cota", category: "TRANSPORTATION_TRANSIT", description: "Central Ohio Transit Authority", website: "https://www.cota.com", phone: "1-614-228-1776", scope: "STATE", states: ["OH"], popularityScore: 68, tags: ["transit", "bus"] },
  { name: "RTA Cleveland", slug: "rta-cleveland", category: "TRANSPORTATION_TRANSIT", description: "Greater Cleveland Regional Transit", website: "https://www.riderta.com", phone: "1-216-621-9500", scope: "STATE", states: ["OH"], popularityScore: 70, tags: ["transit", "bus", "train"] },

  // ── Massachusetts ──
  { name: "Eversource", slug: "eversource", category: "UTILITY_ELECTRIC", description: "Electric and gas for New England", website: "https://www.eversource.com", phone: "1-800-592-2000", scope: "STATE", states: ["MA", "CT", "NH"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "National Grid MA", slug: "national-grid-ma", category: "UTILITY_GAS", description: "Gas for Massachusetts", website: "https://www.nationalgridus.com", scope: "STATE", states: ["MA"], popularityScore: 78, tags: ["gas"] },
  { name: "MBTA", slug: "mbta", category: "TRANSPORTATION_TRANSIT", description: "Massachusetts Bay Transportation Authority", website: "https://www.mbta.com", scope: "STATE", states: ["MA"], popularityScore: 88, tags: ["transit", "bus", "train", "subway"] },
  { name: "MA Health Connector", slug: "ma-health-connector", category: "FINANCIAL_INSURANCE_HEALTH", description: "MA Health Insurance Marketplace", website: "https://www.mahealthconnector.org", scope: "STATE", states: ["MA"], popularityScore: 78, tags: ["health", "marketplace"] },

  // ── Washington ──
  { name: "Puget Sound Energy", slug: "pse-wa", category: "UTILITY_ELECTRIC", description: "Electric and gas for WA", website: "https://www.pse.com", phone: "1-888-225-5773", scope: "STATE", states: ["WA"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "Seattle City Light", slug: "seattle-city-light", category: "UTILITY_ELECTRIC", description: "City of Seattle electric utility", website: "https://www.seattle.gov/city-light", scope: "STATE", states: ["WA"], popularityScore: 80, tags: ["electric"] },
  { name: "Good To Go!", slug: "good-to-go", category: "TRANSPORTATION_TOLL", description: "Washington state toll pass", website: "https://www.wsdot.wa.gov/goodtogo", scope: "STATE", states: ["WA"], popularityScore: 82, tags: ["toll", "car"] },
  { name: "WA Healthplanfinder", slug: "wa-healthplanfinder", category: "FINANCIAL_INSURANCE_HEALTH", description: "WA Health Insurance Marketplace", website: "https://www.wahealthplanfinder.org", scope: "STATE", states: ["WA"], popularityScore: 75, tags: ["health", "marketplace"] },

  // ── Colorado ──
  { name: "Xcel Energy", slug: "xcel-energy", category: "UTILITY_ELECTRIC", description: "Electric and gas for CO", website: "https://www.xcelenergy.com", phone: "1-800-895-4999", scope: "STATE", states: ["CO", "MN", "WI"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "ExpressToll", slug: "expresstoll", category: "TRANSPORTATION_TOLL", description: "Colorado toll pass", website: "https://www.expresstoll.com", scope: "STATE", states: ["CO"], popularityScore: 80, tags: ["toll", "car"] },
  { name: "RTD", slug: "rtd", category: "TRANSPORTATION_TRANSIT", description: "Regional Transportation District Denver", website: "https://www.rtd-denver.com", scope: "STATE", states: ["CO"], popularityScore: 75, tags: ["transit", "bus", "train"] },
  { name: "Connect for Health CO", slug: "connect-health-co", category: "FINANCIAL_INSURANCE_HEALTH", description: "CO Health Insurance Marketplace", website: "https://connectforhealthco.com", scope: "STATE", states: ["CO"], popularityScore: 72, tags: ["health", "marketplace"] },
  { name: "Denver Water", slug: "denver-water", category: "UTILITY_WATER", description: "Water utility for Denver metro", website: "https://www.denverwater.org", phone: "1-303-893-2444", scope: "STATE", states: ["CO"], popularityScore: 80, tags: ["water"] },

  // ── Arizona ──
  { name: "APS (Arizona Public Service)", slug: "aps-az", category: "UTILITY_ELECTRIC", description: "Largest electric utility in AZ", website: "https://www.aps.com", phone: "1-602-371-7171", scope: "STATE", states: ["AZ"], popularityScore: 90, tags: ["electric"] },
  { name: "SRP (Salt River Project)", slug: "srp-az", category: "UTILITY_ELECTRIC", description: "Electric and water for Phoenix area", website: "https://www.srpnet.com", scope: "STATE", states: ["AZ"], popularityScore: 85, tags: ["electric", "water"] },
  { name: "Phoenix Water Services", slug: "phoenix-water", category: "UTILITY_WATER", description: "Water for Phoenix metro", website: "https://www.phoenix.gov/waterservices", scope: "STATE", states: ["AZ"], popularityScore: 78, tags: ["water"] },
  { name: "Tucson Water", slug: "tucson-water", category: "UTILITY_WATER", description: "Water for Tucson", website: "https://www.tucsonaz.gov/water", phone: "1-520-791-3242", scope: "STATE", states: ["AZ"], popularityScore: 72, tags: ["water"] },
  { name: "Mesa Utilities", slug: "mesa-utilities", category: "UTILITY_WATER", description: "Water for Mesa", website: "https://www.mesaaz.gov/utilities", phone: "1-480-644-2221", scope: "STATE", states: ["AZ"], popularityScore: 68, tags: ["water"] },
  { name: "Southwest Gas", slug: "southwest-gas", category: "UTILITY_GAS", description: "Natural gas for AZ/NV", website: "https://www.swgas.com", phone: "1-877-860-6020", scope: "STATE", states: ["AZ", "NV"], popularityScore: 75, tags: ["gas"] },

  // ── Virginia / DC / Maryland ──
  { name: "Dominion Energy", slug: "dominion", category: "UTILITY_ELECTRIC", description: "Electric and gas for VA", website: "https://www.dominionenergy.com", phone: "1-866-366-4357", scope: "STATE", states: ["VA", "NC", "SC"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "WMATA (Metro)", slug: "wmata", category: "TRANSPORTATION_TRANSIT", description: "Washington Metropolitan Area Transit", website: "https://www.wmata.com", scope: "STATE", states: ["VA", "DC", "MD"], popularityScore: 85, tags: ["transit", "subway", "bus"] },
  { name: "Baltimore Gas & Electric", slug: "bge", category: "UTILITY_ELECTRIC", description: "Electric and gas for Baltimore area", website: "https://www.bge.com", phone: "1-800-685-0123", scope: "STATE", states: ["MD"], popularityScore: 90, tags: ["electric", "gas"] },
  { name: "Pepco", slug: "pepco", category: "UTILITY_ELECTRIC", description: "Electric for DC and Maryland", website: "https://www.pepco.com", phone: "1-202-833-7500", scope: "STATE", states: ["DC", "MD"], popularityScore: 88, tags: ["electric"] },
  { name: "DC Water", slug: "dc-water", category: "UTILITY_WATER", description: "Water for Washington DC", website: "https://www.dcwater.com", phone: "1-202-354-3600", scope: "STATE", states: ["DC"], popularityScore: 85, tags: ["water"] },
  { name: "CareFirst BCBS", slug: "carefirst", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield for MD/DC/VA", website: "https://www.carefirst.com", scope: "STATE", states: ["MD", "DC", "VA"], popularityScore: 85, tags: ["health"] },
  { name: "Virginia American Water", slug: "va-american-water", category: "UTILITY_WATER", description: "Water for Virginia", website: "https://www.amwater.com/vaaw", phone: "1-800-452-6863", scope: "STATE", states: ["VA"], popularityScore: 72, tags: ["water"] },
  { name: "Fairfax Water", slug: "fairfax-water", category: "UTILITY_WATER", description: "Water for Fairfax County", website: "https://www.fairfaxwater.org", phone: "1-703-698-5613", scope: "STATE", states: ["VA"], popularityScore: 70, tags: ["water"] },
  { name: "Washington Gas", slug: "washington-gas", category: "UTILITY_GAS", description: "Natural gas for DC/VA/MD", website: "https://www.washingtongas.com", phone: "1-844-927-4427", scope: "STATE", states: ["VA", "DC", "MD"], popularityScore: 78, tags: ["gas"] },
  { name: "MD Health Connection", slug: "md-health-connection", category: "FINANCIAL_INSURANCE_HEALTH", description: "MD Health Insurance Marketplace", website: "https://www.marylandhealthconnection.gov", scope: "STATE", states: ["MD"], popularityScore: 75, tags: ["health", "marketplace"] },

  // ── Michigan ──
  { name: "DTE Energy", slug: "dte", category: "UTILITY_ELECTRIC", description: "Electric and gas for SE Michigan", website: "https://www.dteenergy.com", phone: "1-800-477-4747", scope: "STATE", states: ["MI"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Consumers Energy", slug: "consumers-energy", category: "UTILITY_GAS", description: "Gas and electric for MI", website: "https://www.consumersenergy.com", phone: "1-800-477-5050", scope: "STATE", states: ["MI"], popularityScore: 82, tags: ["gas", "electric"] },

  // ── North Carolina ──
  { name: "Duke Energy NC", slug: "duke-nc", category: "UTILITY_ELECTRIC", description: "Electric utility for NC", website: "https://www.duke-energy.com/north-carolina", phone: "1-800-777-9898", scope: "STATE", states: ["NC", "SC"], popularityScore: 88, tags: ["electric"] },
  { name: "Charlotte Water", slug: "charlotte-water", category: "UTILITY_WATER", description: "Water for Charlotte metro", website: "https://charlottenc.gov/Water", scope: "STATE", states: ["NC"], popularityScore: 75, tags: ["water"] },
  { name: "Raleigh Water", slug: "raleigh-water", category: "UTILITY_WATER", description: "Water for Raleigh", website: "https://raleighnc.gov/water", phone: "1-919-996-3245", scope: "STATE", states: ["NC"], popularityScore: 72, tags: ["water"] },
  { name: "Durham Water", slug: "durham-water", category: "UTILITY_WATER", description: "Water for Durham", website: "https://www.durhamnc.gov/608/Water-Management", phone: "1-919-560-4381", scope: "STATE", states: ["NC"], popularityScore: 70, tags: ["water"] },
  { name: "PSNC Energy", slug: "psnc", category: "UTILITY_GAS", description: "Natural gas for NC", website: "https://www.psncenergy.com", phone: "1-877-776-2427", scope: "STATE", states: ["NC"], popularityScore: 75, tags: ["gas"] },
  { name: "GoRaleigh", slug: "goraleigh", category: "TRANSPORTATION_TRANSIT", description: "Raleigh public transit", website: "https://goraleigh.org", phone: "1-919-485-7433", scope: "STATE", states: ["NC"], popularityScore: 65, tags: ["transit", "bus"] },
  { name: "GoTriangle", slug: "gotriangle", category: "TRANSPORTATION_TRANSIT", description: "Regional transit for Research Triangle", website: "https://gotriangle.org", phone: "1-919-549-9999", scope: "STATE", states: ["NC"], popularityScore: 68, tags: ["transit", "bus"] },

  // ── Alabama ──
  { name: "Alabama Power", slug: "alabama-power", category: "UTILITY_ELECTRIC", description: "Largest electric utility in Alabama", website: "https://www.alabamapower.com", phone: "1-800-245-2244", scope: "STATE", states: ["AL"], popularityScore: 92, tags: ["electric"] },
  { name: "Alagasco", slug: "alagasco", category: "UTILITY_GAS", description: "Alabama gas utility", website: "https://www.alagasco.com", phone: "1-800-292-4008", scope: "STATE", states: ["AL"], popularityScore: 78, tags: ["gas"] },
  { name: "Birmingham Water Works", slug: "bwwb", category: "UTILITY_WATER", description: "Water for Birmingham metro", website: "https://www.bwwb.org", phone: "1-205-244-4000", scope: "STATE", states: ["AL"], popularityScore: 70, tags: ["water"] },
  { name: "BCBS Alabama", slug: "bcbs-al", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Alabama", website: "https://www.bcbsal.org", phone: "1-800-292-8868", scope: "STATE", states: ["AL"], popularityScore: 85, tags: ["health"] },

  // ── Alaska ──
  { name: "Chugach Electric", slug: "chugach-electric", category: "UTILITY_ELECTRIC", description: "Largest electric utility in Alaska", website: "https://www.chugachelectric.com", phone: "1-907-563-7494", scope: "STATE", states: ["AK"], popularityScore: 85, tags: ["electric"] },
  { name: "GCI", slug: "gci-ak", category: "UTILITY_INTERNET", description: "Internet, wireless, and TV services in Alaska", website: "https://www.gci.com", scope: "STATE", states: ["AK"], popularityScore: 78, tags: ["internet", "phone", "cable"] },
  { name: "Anchorage Water & Wastewater Utility", slug: "anchorage-water", category: "UTILITY_WATER", description: "Municipal water and wastewater utility for Anchorage", website: "https://www.awwu.biz", scope: "STATE", states: ["AK"], popularityScore: 72, tags: ["water"] },
  { name: "Premera Blue Cross Alaska", slug: "premera-ak", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield coverage in Alaska", website: "https://www.premera.com", scope: "STATE", states: ["AK"], popularityScore: 82, tags: ["health"] },

  // ── Hawaii ──
  { name: "Hawaiian Electric (HECO)", slug: "heco", category: "UTILITY_ELECTRIC", description: "Electric utility for Hawaii", website: "https://www.hawaiianelectric.com", phone: "1-808-548-7311", scope: "STATE", states: ["HI"], popularityScore: 92, tags: ["electric"] },
  { name: "HMSA", slug: "hmsa", category: "FINANCIAL_INSURANCE_HEALTH", description: "Hawaii Medical Service Association", website: "https://www.hmsa.com", phone: "1-808-948-6111", scope: "STATE", states: ["HI"], popularityScore: 90, tags: ["health"] },
  { name: "Board of Water Supply (Honolulu)", slug: "honolulu-water", category: "UTILITY_WATER", description: "Water utility for Honolulu and Oahu", website: "https://www.boardofwatersupply.com", scope: "STATE", states: ["HI"], popularityScore: 76, tags: ["water"] },
  { name: "Hawaiian Telcom", slug: "hawaiian-telcom", category: "UTILITY_INTERNET", description: "Fiber internet and phone services in Hawaii", website: "https://www.hawaiiantel.com", scope: "STATE", states: ["HI"], popularityScore: 74, tags: ["internet", "fiber", "phone"] },
  { name: "TheBus", slug: "thebus-hi", category: "TRANSPORTATION_TRANSIT", description: "Public transit service on Oahu", website: "https://www.thebus.org", scope: "STATE", states: ["HI"], popularityScore: 72, tags: ["transit", "bus"] },

  // ── Indiana ──
  { name: "Duke Energy Indiana", slug: "duke-in", category: "UTILITY_ELECTRIC", description: "Electric for central Indiana", website: "https://www.duke-energy.com/indiana", phone: "1-800-521-2232", scope: "STATE", states: ["IN"], popularityScore: 85, tags: ["electric"] },
  { name: "IndyGo", slug: "indygo", category: "TRANSPORTATION_TRANSIT", description: "Indianapolis public transit", website: "https://www.indygo.net", scope: "STATE", states: ["IN"], popularityScore: 70, tags: ["transit", "bus"] },
  { name: "Citizens Energy Group", slug: "citizens-energy-in", category: "UTILITY_GAS", description: "Natural gas and utility services in Indianapolis", website: "https://www.citizensenergygroup.com", scope: "STATE", states: ["IN"], popularityScore: 78, tags: ["gas", "water"] },
  { name: "Indiana American Water", slug: "indiana-american-water", category: "UTILITY_WATER", description: "Water and wastewater utility in Indiana", website: "https://www.amwater.com/inaw", scope: "STATE", states: ["IN"], popularityScore: 74, tags: ["water"] },
  { name: "Anthem BCBS Indiana", slug: "anthem-in", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield plans in Indiana", website: "https://www.anthem.com", scope: "STATE", states: ["IN"], popularityScore: 82, tags: ["health"] },

  // ── Iowa ──
  { name: "MidAmerican Energy", slug: "midamerican", category: "UTILITY_ELECTRIC", description: "Electric and gas for Iowa", website: "https://www.midamericanenergy.com", phone: "1-888-427-5632", scope: "STATE", states: ["IA"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Mediacom", slug: "mediacom-ia", category: "UTILITY_INTERNET", description: "Cable and broadband internet across Iowa", website: "https://www.mediacomcable.com", scope: "STATE", states: ["IA"], popularityScore: 74, tags: ["internet", "cable"] },
  { name: "Iowa American Water", slug: "iowa-american-water", category: "UTILITY_WATER", description: "Water utility serving communities in Iowa", website: "https://www.amwater.com/iaaw", scope: "STATE", states: ["IA"], popularityScore: 72, tags: ["water"] },
  { name: "Wellmark Blue Cross Blue Shield", slug: "wellmark-ia", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield coverage in Iowa", website: "https://www.wellmark.com", scope: "STATE", states: ["IA"], popularityScore: 82, tags: ["health"] },

  // ── Kansas ──
  { name: "Evergy", slug: "evergy", category: "UTILITY_ELECTRIC", description: "Electric for Kansas and Missouri", website: "https://www.evergy.com", phone: "1-888-471-5275", scope: "STATE", states: ["KS", "MO"], popularityScore: 88, tags: ["electric"] },
  { name: "K-TAG", slug: "ktag", category: "TRANSPORTATION_TOLL", description: "Kansas Turnpike toll tag", website: "https://www.ksturnpike.com", scope: "STATE", states: ["KS"], popularityScore: 75, tags: ["toll", "car"] },

  // ── Kentucky ──
  { name: "Kentucky Utilities", slug: "ky-utilities", category: "UTILITY_ELECTRIC", description: "Electric for Kentucky", website: "https://www.lge-ku.com", phone: "1-800-981-0600", scope: "STATE", states: ["KY"], popularityScore: 85, tags: ["electric"] },
  { name: "Louisville Water Company", slug: "louisville-water", category: "UTILITY_WATER", description: "Water utility for Louisville and surrounding areas", website: "https://www.louisvillewater.com", scope: "STATE", states: ["KY"], popularityScore: 78, tags: ["water"] },
  { name: "Atmos Energy Kentucky", slug: "atmos-ky", category: "UTILITY_GAS", description: "Natural gas service in Kentucky", website: "https://www.atmosenergy.com", scope: "STATE", states: ["KY"], popularityScore: 72, tags: ["gas"] },
  { name: "Anthem BCBS Kentucky", slug: "anthem-ky", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield plans in Kentucky", website: "https://www.anthem.com", scope: "STATE", states: ["KY"], popularityScore: 80, tags: ["health"] },

  // ── Louisiana ──
  { name: "Entergy Louisiana", slug: "entergy-la", category: "UTILITY_ELECTRIC", description: "Electric for Louisiana", website: "https://www.entergy-louisiana.com", phone: "1-800-368-3749", scope: "STATE", states: ["LA"], popularityScore: 90, tags: ["electric"] },
  { name: "GeauxPass", slug: "geauxpass", category: "TRANSPORTATION_TOLL", description: "Louisiana toll tag", website: "https://www.geauxpass.com", scope: "STATE", states: ["LA"], popularityScore: 75, tags: ["toll", "car"] },
  { name: "Sewerage & Water Board of New Orleans", slug: "swbno", category: "UTILITY_WATER", description: "Water and sewer utility for New Orleans", website: "https://www.swbno.org", scope: "STATE", states: ["LA"], popularityScore: 74, tags: ["water"] },
  { name: "Blue Cross and Blue Shield of Louisiana", slug: "bcbs-la", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield plans in Louisiana", website: "https://www.bcbsla.com", scope: "STATE", states: ["LA"], popularityScore: 84, tags: ["health"] },
  { name: "New Orleans Regional Transit Authority", slug: "norta", category: "TRANSPORTATION_TRANSIT", description: "Streetcar, bus, and ferry transit in New Orleans", website: "https://www.norta.com", scope: "STATE", states: ["LA"], popularityScore: 70, tags: ["transit", "bus", "streetcar"] },

  // ── Minnesota ──
  { name: "BCBS Minnesota", slug: "bcbs-mn", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Minnesota", website: "https://www.bluecrossmn.com", scope: "STATE", states: ["MN"], popularityScore: 85, tags: ["health"] },
  { name: "Metro Transit MN", slug: "metro-mn", category: "TRANSPORTATION_TRANSIT", description: "Minneapolis-St. Paul transit", website: "https://www.metrotransit.org", scope: "STATE", states: ["MN"], popularityScore: 82, tags: ["transit", "bus", "train"] },
  { name: "MNsure", slug: "mnsure", category: "FINANCIAL_INSURANCE_HEALTH", description: "MN Health Insurance Marketplace", website: "https://www.mnsure.org", scope: "STATE", states: ["MN"], popularityScore: 72, tags: ["health", "marketplace"] },

  // ── Missouri ──
  { name: "Ameren Missouri", slug: "ameren-mo", category: "UTILITY_ELECTRIC", description: "Electric and gas for Missouri", website: "https://www.ameren.com", phone: "1-800-552-7583", scope: "STATE", states: ["MO", "IL"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Spire Missouri", slug: "spire-mo", category: "UTILITY_GAS", description: "Natural gas utility for Missouri", website: "https://www.spireenergy.com", scope: "STATE", states: ["MO"], popularityScore: 76, tags: ["gas"] },
  { name: "Missouri American Water", slug: "missouri-american-water", category: "UTILITY_WATER", description: "Water and wastewater utility in Missouri", website: "https://www.amwater.com/moaw", scope: "STATE", states: ["MO"], popularityScore: 74, tags: ["water"] },
  { name: "Metro Transit St. Louis", slug: "metro-stl", category: "TRANSPORTATION_TRANSIT", description: "Bus and MetroLink transit in St. Louis", website: "https://www.metrostlouis.org", scope: "STATE", states: ["MO"], popularityScore: 72, tags: ["transit", "bus", "train"] },

  // ── Nevada ──
  { name: "NV Energy", slug: "nv-energy", category: "UTILITY_ELECTRIC", description: "Electric and gas for Nevada", website: "https://www.nvenergy.com", phone: "1-702-402-5555", scope: "STATE", states: ["NV"], popularityScore: 92, tags: ["electric", "gas"] },
  { name: "Las Vegas Valley Water", slug: "lvvwd", category: "UTILITY_WATER", description: "Water for Las Vegas", website: "https://www.lvvwd.com", phone: "1-702-870-4194", scope: "STATE", states: ["NV"], popularityScore: 82, tags: ["water"] },
  { name: "Nevada Health Link", slug: "nevada-health-link", category: "FINANCIAL_INSURANCE_HEALTH", description: "Nevada's health insurance marketplace", website: "https://www.nevadahealthlink.com", scope: "STATE", states: ["NV"], popularityScore: 78, tags: ["health", "marketplace"] },
  { name: "RTC Southern Nevada", slug: "rtc-snv", category: "TRANSPORTATION_TRANSIT", description: "Public transit service in Las Vegas and Southern Nevada", website: "https://www.rtcsnv.com", scope: "STATE", states: ["NV"], popularityScore: 72, tags: ["transit", "bus"] },

  // ── Oregon ──
  { name: "Portland General Electric", slug: "pge-or", category: "UTILITY_ELECTRIC", description: "Electric for Portland area", website: "https://www.portlandgeneral.com", phone: "1-503-228-6322", scope: "STATE", states: ["OR"], popularityScore: 88, tags: ["electric"] },
  { name: "NW Natural Gas", slug: "nw-natural", category: "UTILITY_GAS", description: "Natural gas for Oregon", website: "https://www.nwnatural.com", phone: "1-800-422-4012", scope: "STATE", states: ["OR"], popularityScore: 82, tags: ["gas"] },
  { name: "TriMet", slug: "trimet", category: "TRANSPORTATION_TRANSIT", description: "Portland area transit", website: "https://www.trimet.org", phone: "1-503-238-7433", scope: "STATE", states: ["OR"], popularityScore: 85, tags: ["transit", "bus", "train"] },

  // ── Tennessee ──
  { name: "Nashville Electric Service", slug: "nes-tn", category: "UTILITY_ELECTRIC", description: "Electric for Nashville", website: "https://www.nespower.com", phone: "1-615-736-6900", scope: "STATE", states: ["TN"], popularityScore: 85, tags: ["electric"] },
  { name: "BCBS Tennessee", slug: "bcbs-tn", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Tennessee", website: "https://www.bcbst.com", phone: "1-800-565-9140", scope: "STATE", states: ["TN"], popularityScore: 88, tags: ["health"] },
  { name: "Nashville Water Services", slug: "nashville-water", category: "UTILITY_WATER", description: "Water and sewer utility for Nashville", website: "https://www.nashville.gov/departments/water", scope: "STATE", states: ["TN"], popularityScore: 74, tags: ["water"] },
  { name: "WeGo Public Transit", slug: "wego-tn", category: "TRANSPORTATION_TRANSIT", description: "Bus transit service in Nashville", website: "https://www.wegotransit.com", scope: "STATE", states: ["TN"], popularityScore: 70, tags: ["transit", "bus"] },

  // ── Utah ──
  { name: "Rocky Mountain Power", slug: "rmp-ut", category: "UTILITY_ELECTRIC", description: "Electric for Utah", website: "https://www.rockymountainpower.net", phone: "1-888-221-7070", scope: "STATE", states: ["UT", "WY", "ID"], popularityScore: 88, tags: ["electric"] },
  { name: "UTA", slug: "uta", category: "TRANSPORTATION_TRANSIT", description: "Utah Transit Authority", website: "https://www.rideuta.com", scope: "STATE", states: ["UT"], popularityScore: 82, tags: ["transit", "bus", "train"] },

  // ── Wisconsin ──
  { name: "We Energies", slug: "we-energies", category: "UTILITY_ELECTRIC", description: "Electric and gas for SE Wisconsin", website: "https://www.we-energies.com", phone: "1-800-242-9137", scope: "STATE", states: ["WI"], popularityScore: 88, tags: ["electric", "gas"] },
  { name: "Milwaukee Water Works", slug: "milwaukee-water", category: "UTILITY_WATER", description: "Water utility for Milwaukee", website: "https://city.milwaukee.gov/water", scope: "STATE", states: ["WI"], popularityScore: 74, tags: ["water"] },
  { name: "WPS Health Insurance", slug: "wps-health", category: "FINANCIAL_INSURANCE_HEALTH", description: "Health plans and provider networks in Wisconsin", website: "https://www.wpshealth.com", scope: "STATE", states: ["WI"], popularityScore: 76, tags: ["health"] },
  { name: "Milwaukee County Transit System", slug: "mcts", category: "TRANSPORTATION_TRANSIT", description: "Bus transit service in Milwaukee County", website: "https://www.ridemcts.com", scope: "STATE", states: ["WI"], popularityScore: 70, tags: ["transit", "bus"] },

  // ── Multi-State ISPs ──
  { name: "Cox Communications", slug: "cox", category: "UTILITY_INTERNET", description: "Internet, TV, phone", website: "https://www.cox.com", phone: "1-800-234-3993", scope: "STATE", states: ["AZ", "AR", "CA", "CT", "FL", "GA", "ID", "IA", "KS", "LA", "NE", "NV", "OH", "OK", "RI", "VA"], popularityScore: 80, tags: ["internet", "cable", "tv"] },
  { name: "Frontier Communications", slug: "frontier", category: "UTILITY_INTERNET", description: "Fiber and DSL internet", website: "https://www.frontier.com", phone: "1-855-575-0432", scope: "STATE", states: ["AL", "AZ", "CA", "CT", "FL", "IL", "IN", "NY", "OH", "OR", "PA", "TX", "WA", "WV", "WI"], popularityScore: 68, tags: ["internet", "fiber"] },
  { name: "CenturyLink (Lumen)", slug: "centurylink", category: "UTILITY_INTERNET", description: "Internet and fiber by Lumen", website: "https://www.centurylink.com", phone: "1-855-454-8739", scope: "STATE", states: ["AL", "AZ", "AR", "CO", "FL", "GA", "ID", "IL", "IN", "IA", "KS", "LA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NM", "NC", "OH", "OK", "OR", "PA", "TX", "UT", "VA", "WA", "WI"], popularityScore: 72, tags: ["internet", "fiber"] },
  { name: "Google Fiber", slug: "google-fiber", category: "UTILITY_INTERNET", description: "Gigabit fiber internet by Google", website: "https://fiber.google.com", scope: "STATE", states: ["TX", "NC", "TN", "GA", "MO", "KS", "UT", "CO", "AZ", "NE", "NV", "IA"], popularityScore: 78, tags: ["internet", "fiber"] },

  // ── Multi-State Grocery / Retail ──
  { name: "Wegmans", slug: "wegmans", category: "SHOPPING_RETAIL", description: "Family-owned supermarket", website: "https://www.wegmans.com", scope: "STATE", states: ["NY", "NJ", "PA", "MA", "MD", "VA", "NC", "DE"], popularityScore: 85, tags: ["shopping", "grocery"] },
  { name: "ShopRite", slug: "shoprite", category: "SHOPPING_RETAIL", description: "Northeast supermarket cooperative", website: "https://www.shoprite.com", scope: "STATE", states: ["NJ", "NY", "CT", "PA", "DE", "MD"], popularityScore: 80, tags: ["shopping", "grocery"] },
  { name: "Meijer", slug: "meijer", category: "SHOPPING_RETAIL", description: "Midwest supercenter chain", website: "https://www.meijer.com", scope: "STATE", states: ["MI", "OH", "IN", "IL", "WI", "KY"], popularityScore: 78, tags: ["shopping", "grocery"] },
  { name: "Kroger", slug: "kroger", category: "SHOPPING_RETAIL", description: "Grocery chain in 35 states", website: "https://www.kroger.com", phone: "1-800-576-4377", scope: "FEDERAL", popularityScore: 85, tags: ["shopping", "grocery"] },
  { name: "Safeway", slug: "safeway", category: "SHOPPING_RETAIL", description: "Grocery chain in western US", website: "https://www.safeway.com", scope: "STATE", states: ["AK", "AZ", "CA", "CO", "DC", "DE", "HI", "ID", "MD", "MT", "NE", "NM", "NV", "OR", "SD", "VA", "WA", "WY"], popularityScore: 80, tags: ["shopping", "grocery"] },
  { name: "Hy-Vee", slug: "hy-vee", category: "SHOPPING_RETAIL", description: "Midwest supermarket chain", website: "https://www.hy-vee.com", scope: "STATE", states: ["IA", "IL", "KS", "MN", "MO", "NE", "SD", "WI"], popularityScore: 75, tags: ["shopping", "grocery"] },
  { name: "WinCo Foods", slug: "winco", category: "SHOPPING_RETAIL", description: "Employee-owned discount grocery chain", website: "https://www.wincofoods.com", scope: "STATE", states: ["AZ", "CA", "ID", "MT", "NV", "OK", "OR", "TX", "UT", "WA"], popularityScore: 72, tags: ["shopping", "grocery", "budget"] },
  { name: "Giant Food", slug: "giant-food", category: "SHOPPING_RETAIL", description: "Mid-Atlantic grocery chain", website: "https://www.giantfood.com", scope: "STATE", states: ["DC", "DE", "MD", "PA", "VA"], popularityScore: 78, tags: ["shopping", "grocery"] },
  { name: "Stop & Shop", slug: "stop-shop", category: "SHOPPING_RETAIL", description: "Northeast supermarket chain", website: "https://www.stopandshop.com", scope: "STATE", states: ["CT", "MA", "NJ", "NY", "RI"], popularityScore: 75, tags: ["shopping", "grocery"] },
  { name: "Fred Meyer", slug: "fred-meyer", category: "SHOPPING_RETAIL", description: "Pacific Northwest one-stop shopping chain", website: "https://www.fredmeyer.com", scope: "STATE", states: ["AK", "ID", "OR", "WA"], popularityScore: 72, tags: ["shopping", "grocery"] },
  { name: "Albertsons", slug: "albertsons", category: "SHOPPING_RETAIL", description: "Regional grocery store network", website: "https://www.albertsons.com", scope: "STATE", states: ["AR", "AZ", "CA", "CO", "ID", "LA", "MT", "NE", "NV", "NM", "ND", "OR", "SD", "TX", "UT", "WA", "WY"], popularityScore: 78, tags: ["shopping", "grocery"] },

  // ── Maine (ME) — Coverage Gap Fix ──
  { name: "Central Maine Power", slug: "cmp-me", category: "UTILITY_ELECTRIC", description: "Electric utility for central and southern Maine", website: "https://www.cmpco.com", phone: "1-800-750-4000", scope: "STATE", states: ["ME"], popularityScore: 88, tags: ["electric"] },
  { name: "Versant Power", slug: "versant-me", category: "UTILITY_ELECTRIC", description: "Electric utility for northern Maine", website: "https://www.versantpower.com", phone: "1-207-973-2000", scope: "STATE", states: ["ME"], popularityScore: 72, tags: ["electric"] },
  { name: "Spectrum Maine", slug: "spectrum-me", category: "UTILITY_INTERNET", description: "Internet and cable in Maine", website: "https://www.spectrum.com", phone: "1-855-757-7328", scope: "STATE", states: ["ME", "NY", "OH", "TX", "WI", "NC", "CA"], popularityScore: 82, tags: ["internet", "cable"] },
  { name: "Maine Water Company", slug: "maine-water", category: "UTILITY_WATER", description: "Water utility serving Maine", website: "https://www.mainewater.com", phone: "1-800-287-1643", scope: "STATE", states: ["ME"], popularityScore: 75, tags: ["water"] },
  { name: "Anthem BCBS Maine", slug: "bcbs-me", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Maine", website: "https://www.anthem.com", scope: "STATE", states: ["ME"], popularityScore: 85, tags: ["health"] },

  // ── North Dakota (ND) — Coverage Gap Fix ──
  { name: "MDU Resources", slug: "mdu-nd", category: "UTILITY_ELECTRIC", description: "Electric and gas for North Dakota", website: "https://www.montana-dakota.com", phone: "1-800-638-3278", scope: "STATE", states: ["ND", "MT", "SD", "WY"], popularityScore: 85, tags: ["electric", "gas"] },
  { name: "Xcel Energy ND", slug: "xcel-nd", category: "UTILITY_ELECTRIC", description: "Electric utility serving ND", website: "https://www.xcelenergy.com", phone: "1-800-895-4999", scope: "STATE", states: ["ND", "MN", "CO", "WI", "SD"], popularityScore: 82, tags: ["electric"] },
  { name: "Midco", slug: "midco-nd", category: "UTILITY_INTERNET", description: "Internet and cable in ND/SD/MN/WI/KS", website: "https://www.midco.com", phone: "1-800-888-1300", scope: "STATE", states: ["ND", "SD", "MN", "WI", "KS"], popularityScore: 78, tags: ["internet", "cable"] },
  { name: "BCBS North Dakota", slug: "bcbs-nd", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of North Dakota", website: "https://www.bcbsnd.com", scope: "STATE", states: ["ND"], popularityScore: 85, tags: ["health"] },

  // ── Vermont (VT) — Coverage Gap Fix ──
  { name: "Green Mountain Power", slug: "gmp-vt", category: "UTILITY_ELECTRIC", description: "Vermont's largest electric utility", website: "https://www.greenmountainpower.com", phone: "1-888-835-4672", scope: "STATE", states: ["VT"], popularityScore: 90, tags: ["electric"] },
  { name: "Vermont Gas Systems", slug: "vt-gas", category: "UTILITY_GAS", description: "Natural gas for NW Vermont", website: "https://www.vermontgas.com", phone: "1-802-863-4511", scope: "STATE", states: ["VT"], popularityScore: 72, tags: ["gas"] },
  { name: "Consolidated Communications VT", slug: "consolidated-vt", category: "UTILITY_INTERNET", description: "Internet and phone for Vermont", website: "https://www.consolidated.com", phone: "1-844-968-7224", scope: "STATE", states: ["VT", "NH", "ME"], popularityScore: 70, tags: ["internet"] },
  { name: "BCBS Vermont", slug: "bcbs-vt", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of Vermont", website: "https://www.bcbsvt.com", scope: "STATE", states: ["VT"], popularityScore: 88, tags: ["health"] },

  // ── New Hampshire (NH) — Coverage Gap Fix ──
  { name: "Eversource NH", slug: "eversource-nh", category: "UTILITY_ELECTRIC", description: "Electric utility for New Hampshire", website: "https://www.eversource.com", phone: "1-800-662-7764", scope: "STATE", states: ["NH", "CT", "MA"], popularityScore: 88, tags: ["electric"] },
  { name: "Liberty Utilities NH", slug: "liberty-nh", category: "UTILITY_ELECTRIC", description: "Electric and gas in NH", website: "https://www.libertyutilities.com", phone: "1-800-375-7413", scope: "STATE", states: ["NH"], popularityScore: 72, tags: ["electric", "gas"] },
  { name: "Anthem BCBS NH", slug: "bcbs-nh", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of NH", website: "https://www.anthem.com", scope: "STATE", states: ["NH"], popularityScore: 85, tags: ["health"] },

  // ── South Dakota (SD) — Coverage Gap Fix ──
  { name: "Black Hills Energy SD", slug: "bhe-sd", category: "UTILITY_ELECTRIC", description: "Electric and gas for SD", website: "https://www.blackhillsenergy.com", phone: "1-800-742-8948", scope: "STATE", states: ["SD", "CO", "WY", "NE", "IA", "KS", "AR"], popularityScore: 82, tags: ["electric", "gas"] },
  { name: "Avera Health", slug: "avera-sd", category: "FINANCIAL_INSURANCE_HEALTH", description: "Major health system in SD", website: "https://www.avera.org", scope: "STATE", states: ["SD"], popularityScore: 80, tags: ["health"] },

  // ── West Virginia (WV) — Coverage Gap Fix ──
  { name: "Appalachian Power WV", slug: "apco-wv", category: "UTILITY_ELECTRIC", description: "Electric for southern West Virginia", website: "https://www.appalachianpower.com", phone: "1-800-956-4237", scope: "STATE", states: ["WV", "VA"], popularityScore: 85, tags: ["electric"] },
  { name: "Mon Power", slug: "mon-power-wv", category: "UTILITY_ELECTRIC", description: "Electric for northern West Virginia", website: "https://www.firstenergycorp.com/monpower", phone: "1-800-686-0022", scope: "STATE", states: ["WV"], popularityScore: 78, tags: ["electric"] },
  { name: "West Virginia American Water", slug: "wvaw", category: "UTILITY_WATER", description: "Water utility for West Virginia", website: "https://www.amwater.com/wvaw", phone: "1-800-685-8660", scope: "STATE", states: ["WV"], popularityScore: 78, tags: ["water"] },
  { name: "Highmark BCBS WV", slug: "bcbs-wv", category: "FINANCIAL_INSURANCE_HEALTH", description: "Blue Cross Blue Shield of WV", website: "https://www.highmarkbcbswv.com", scope: "STATE", states: ["WV"], popularityScore: 85, tags: ["health"] },

  // ══════════════════════════════════════════════════════════
  // NEW CATEGORIES — Phase 3 Expansion
  // ══════════════════════════════════════════════════════════

  // ── HOME SECURITY ──
  { name: "ADT Security", slug: "adt", category: "HOUSING_SECURITY", description: "America's #1 smart home security provider", website: "https://www.adt.com", phone: "1-800-716-3640", scope: "FEDERAL", popularityScore: 90, tags: ["security", "alarm", "home"] },
  { name: "Vivint Smart Home", slug: "vivint", category: "HOUSING_SECURITY", description: "Smart home security and automation", website: "https://www.vivint.com", phone: "1-855-832-1550", scope: "FEDERAL", popularityScore: 82, tags: ["security", "alarm", "home"] },
  { name: "SimpliSafe", slug: "simplisafe", category: "HOUSING_SECURITY", description: "DIY home security — no contract", website: "https://www.simplisafe.com", phone: "1-888-957-4675", scope: "FEDERAL", popularityScore: 80, tags: ["security", "alarm", "home"] },
  { name: "Ring Alarm", slug: "ring-alarm", category: "HOUSING_SECURITY", description: "Amazon Ring home security system", website: "https://www.ring.com", scope: "FEDERAL", popularityScore: 78, tags: ["security", "alarm", "home"] },
  { name: "Brinks Home Security", slug: "brinks-home", category: "HOUSING_SECURITY", description: "Professional home security monitoring", website: "https://www.brinkshome.com", phone: "1-888-627-4657", scope: "FEDERAL", popularityScore: 72, tags: ["security", "alarm", "home"] },
  { name: "Cove Security", slug: "cove", category: "HOUSING_SECURITY", description: "Affordable DIY smart security", website: "https://www.covesmart.com", scope: "FEDERAL", popularityScore: 60, tags: ["security", "alarm", "home"] },

  // ── HOME CLEANING ──
  { name: "Molly Maid", slug: "molly-maid", category: "HOUSING_CLEANING", description: "Professional home cleaning services", website: "https://www.mollymaid.com", phone: "1-800-665-5962", scope: "FEDERAL", popularityScore: 78, tags: ["cleaning", "home"] },
  { name: "Merry Maids", slug: "merry-maids", category: "HOUSING_CLEANING", description: "Trusted residential cleaning since 1979", website: "https://www.merrymaids.com", phone: "1-800-637-7962", scope: "FEDERAL", popularityScore: 75, tags: ["cleaning", "home"] },
  { name: "The Maids", slug: "the-maids", category: "HOUSING_CLEANING", description: "Team-based home cleaning", website: "https://www.maids.com", phone: "1-800-843-6243", scope: "FEDERAL", popularityScore: 68, tags: ["cleaning", "home"] },
  { name: "Handy", slug: "handy", category: "HOUSING_CLEANING", description: "On-demand cleaning and handyman services", website: "https://www.handy.com", scope: "FEDERAL", popularityScore: 65, tags: ["cleaning", "home"] },

  // ── GROCERY DELIVERY ──
  { name: "Instacart", slug: "instacart", category: "GROCERY_DELIVERY", description: "Same-day grocery delivery from local stores", website: "https://www.instacart.com", scope: "FEDERAL", popularityScore: 90, tags: ["grocery", "delivery"] },
  { name: "Amazon Fresh", slug: "amazon-fresh", category: "GROCERY_DELIVERY", description: "Grocery delivery by Amazon", website: "https://www.amazon.com/fresh", scope: "FEDERAL", popularityScore: 85, tags: ["grocery", "delivery"] },
  { name: "Walmart+ Delivery", slug: "walmart-plus", category: "GROCERY_DELIVERY", description: "Unlimited free delivery from Walmart", website: "https://www.walmart.com/plus", scope: "FEDERAL", popularityScore: 82, tags: ["grocery", "delivery"] },
  { name: "Shipt", slug: "shipt", category: "GROCERY_DELIVERY", description: "Same-day delivery from Target and more", website: "https://www.shipt.com", scope: "FEDERAL", popularityScore: 72, tags: ["grocery", "delivery"] },
  { name: "HelloFresh", slug: "hellofresh", category: "GROCERY_DELIVERY", description: "Meal kit delivery service", website: "https://www.hellofresh.com", scope: "FEDERAL", popularityScore: 75, tags: ["grocery", "delivery"] },
  { name: "Blue Apron", slug: "blue-apron", category: "GROCERY_DELIVERY", description: "Chef-designed meal kits delivered weekly", website: "https://www.blueapron.com", scope: "FEDERAL", popularityScore: 62, tags: ["grocery", "delivery"] },
  { name: "DoorDash", slug: "doordash", category: "GROCERY_DELIVERY", description: "Food and grocery delivery", website: "https://www.doordash.com", scope: "FEDERAL", popularityScore: 88, tags: ["grocery", "delivery"] },

  // ── PET SERVICES ──
  { name: "Rover", slug: "rover", category: "PET_SERVICES", description: "Dog walking, pet sitting, boarding", website: "https://www.rover.com", scope: "FEDERAL", popularityScore: 82, tags: ["pet", "dog", "cat"] },
  { name: "Wag!", slug: "wag", category: "PET_SERVICES", description: "On-demand dog walking and pet care", website: "https://www.wagwalking.com", scope: "FEDERAL", popularityScore: 72, tags: ["pet", "dog"] },
  { name: "PetSmart", slug: "petsmart", category: "PET_SERVICES", description: "Pet supplies, grooming, boarding, training", website: "https://www.petsmart.com", phone: "1-888-839-9638", scope: "FEDERAL", popularityScore: 85, tags: ["pet", "dog", "cat"] },
  { name: "Petco", slug: "petco", category: "PET_SERVICES", description: "Pet health, supplies, and veterinary care", website: "https://www.petco.com", phone: "1-877-738-6742", scope: "FEDERAL", popularityScore: 82, tags: ["pet", "dog", "cat", "vet"] },
  { name: "Camp Bow Wow", slug: "camp-bow-wow", category: "PET_SERVICES", description: "Dog daycare, boarding, and grooming", website: "https://www.campbowwow.com", scope: "FEDERAL", popularityScore: 64, tags: ["pet", "dog"] },
  { name: "Dogtopia", slug: "dogtopia", category: "PET_SERVICES", description: "Dog daycare, boarding, and spa services", website: "https://www.dogtopia.com", scope: "FEDERAL", popularityScore: 62, tags: ["pet", "dog"] },

  // ── MOVING SERVICES ──

  // ── LEGAL SERVICES ──
  { name: "LegalZoom", slug: "legalzoom", category: "LEGAL_SERVICES", description: "Online legal services — wills, LLC, address change", website: "https://www.legalzoom.com", phone: "1-800-773-0888", scope: "FEDERAL", popularityScore: 78, tags: ["legal"] },
  { name: "Rocket Lawyer", slug: "rocket-lawyer", category: "LEGAL_SERVICES", description: "Legal documents and attorney access", website: "https://www.rocketlawyer.com", scope: "FEDERAL", popularityScore: 68, tags: ["legal"] },

  // ── LAWN CARE ──
  { name: "Lawn Love", slug: "lawn-love", category: "HOUSING_LAWN_CARE", description: "On-demand lawn care and landscaping", website: "https://www.lawnlove.com", scope: "FEDERAL", popularityScore: 65, tags: ["lawn", "home"] },
  { name: "Sunday Lawn Care", slug: "sunday-lawn", category: "HOUSING_LAWN_CARE", description: "Custom lawn care plan delivered to your door", website: "https://www.getsunday.com", scope: "FEDERAL", popularityScore: 60, tags: ["lawn", "home"] },

  // ── PEST CONTROL ──
  { name: "Rentokil (Ehrlich)", slug: "rentokil", category: "HOUSING_PEST_CONTROL", description: "Pest control services", website: "https://www.rentokil.com/us", scope: "FEDERAL", popularityScore: 68, tags: ["pest", "home"] },

  // ── SMART HOME ──
  { name: "Google Nest", slug: "google-nest", category: "HOUSING_SECURITY", subCategory: "SMART_HOME", description: "Smart thermostat, cameras, doorbell", website: "https://store.google.com/category/nest", scope: "FEDERAL", popularityScore: 78, tags: ["security", "home"] },
  { name: "Arlo", slug: "arlo", category: "HOUSING_SECURITY", subCategory: "SMART_HOME", description: "Wire-free smart security cameras", website: "https://www.arlo.com", scope: "FEDERAL", popularityScore: 70, tags: ["security", "home"] },

  // ── IDENTITY PROTECTION ──
  { name: "Experian IdentityWorks", slug: "experian-id", category: "FINANCIAL_CREDIT_CARD", subCategory: "IDENTITY", description: "Credit monitoring and identity protection", website: "https://www.experian.com/consumer-products/identity-theft-and-credit-protection.html", scope: "FEDERAL", popularityScore: 72, tags: ["identity", "security"] },
  { name: "Credit Karma", slug: "credit-karma", category: "FINANCIAL_CREDIT_CARD", subCategory: "CREDIT", description: "Free credit scores and monitoring", website: "https://www.creditkarma.com", scope: "FEDERAL", popularityScore: 85, tags: ["identity", "banking"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: COVERAGE GAP FILLS — ELECTRIC (2026-04-17)
  // Fills gaps flagged by scripts/audit-provider-coverage.ts
  // ══════════════════════════════════════════════════════════
  { name: "Delmarva Power", slug: "delmarva-power-de", category: "UTILITY_ELECTRIC", description: "Electric utility for Delaware and eastern shore Maryland", website: "https://www.delmarva.com", phone: "1-800-375-7117", scope: "STATE", states: ["DE", "MD"], popularityScore: 85, tags: ["electric"] },
  { name: "Mississippi Power", slug: "mississippi-power", category: "UTILITY_ELECTRIC", description: "Electric utility for southeast Mississippi", website: "https://www.mississippipower.com", phone: "1-800-532-1502", scope: "STATE", states: ["MS"], popularityScore: 86, tags: ["electric"] },
  { name: "Entergy Mississippi", slug: "entergy-ms", category: "UTILITY_ELECTRIC", description: "Electric utility for west-central Mississippi", website: "https://www.entergy-mississippi.com", phone: "1-800-368-3749", scope: "STATE", states: ["MS"], popularityScore: 82, tags: ["electric"] },
  { name: "PNM", slug: "pnm-nm", category: "UTILITY_ELECTRIC", description: "Public Service Company of New Mexico", website: "https://www.pnm.com", phone: "1-888-342-5766", scope: "STATE", states: ["NM"], popularityScore: 88, tags: ["electric"] },
  { name: "OG&E", slug: "oge-ok", category: "UTILITY_ELECTRIC", description: "Oklahoma Gas & Electric — electric utility for OK and western AR", website: "https://www.oge.com", phone: "1-405-272-9741", scope: "STATE", states: ["OK", "AR"], popularityScore: 88, tags: ["electric"] },
  { name: "Public Service Oklahoma (PSO)", slug: "pso-ok", category: "UTILITY_ELECTRIC", description: "Electric utility for eastern Oklahoma", website: "https://www.psoklahoma.com", phone: "1-888-216-3523", scope: "STATE", states: ["OK"], popularityScore: 78, tags: ["electric"] },
  { name: "Rhode Island Energy", slug: "ri-energy", category: "UTILITY_ELECTRIC", description: "Electric and gas utility for Rhode Island (successor to National Grid RI)", website: "https://www.rienergy.com", phone: "1-855-743-1101", scope: "STATE", states: ["RI"], popularityScore: 90, tags: ["electric", "gas"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: COVERAGE GAP FILLS — WATER (2026-04-17)
  // ══════════════════════════════════════════════════════════
  { name: "Central Arkansas Water", slug: "central-ar-water", category: "UTILITY_WATER", description: "Water utility for Little Rock and central Arkansas", website: "https://carkw.com", phone: "1-501-372-5161", scope: "STATE", states: ["AR"], popularityScore: 72, tags: ["water"] },
  { name: "Aquarion Water", slug: "aquarion-ct", category: "UTILITY_WATER", description: "Water utility for Connecticut and parts of MA/NH", website: "https://www.aquarionwater.com", phone: "1-800-732-9678", scope: "STATE", states: ["CT", "MA", "NH"], popularityScore: 75, tags: ["water"] },
  { name: "Artesian Water Company", slug: "artesian-de", category: "UTILITY_WATER", description: "Water utility for Delaware", website: "https://www.artesianwater.com", phone: "1-302-453-6900", scope: "STATE", states: ["DE"], popularityScore: 72, tags: ["water"] },
  { name: "Suez Idaho (Veolia)", slug: "veolia-id", category: "UTILITY_WATER", description: "Water utility for Boise metro", website: "https://www.mywater.veolia.us", phone: "1-208-362-7300", scope: "STATE", states: ["ID"], popularityScore: 70, tags: ["water"] },
  { name: "WaterOne", slug: "waterone-ks", category: "UTILITY_WATER", description: "Water utility for Johnson County, Kansas", website: "https://www.waterone.org", phone: "1-913-895-1800", scope: "STATE", states: ["KS"], popularityScore: 72, tags: ["water"] },
  { name: "WSSC Water", slug: "wssc-md", category: "UTILITY_WATER", description: "Water and sewer for Montgomery and Prince George's counties", website: "https://www.wsscwater.com", phone: "1-301-206-4001", scope: "STATE", states: ["MD"], popularityScore: 80, tags: ["water"] },
  { name: "Boston Water and Sewer Commission", slug: "bwsc-ma", category: "UTILITY_WATER", description: "Water and sewer utility for Boston", website: "https://www.bwsc.org", phone: "1-617-989-7000", scope: "STATE", states: ["MA"], popularityScore: 80, tags: ["water"] },
  { name: "Great Lakes Water Authority", slug: "glwa-mi", category: "UTILITY_WATER", description: "Regional water and sewer utility for Detroit metro", website: "https://www.glwater.org", phone: "1-844-455-4592", scope: "STATE", states: ["MI"], popularityScore: 78, tags: ["water"] },
  { name: "Minneapolis Water", slug: "minneapolis-water", category: "UTILITY_WATER", description: "Water utility for Minneapolis", website: "https://www2.minneapolismn.gov/government/departments/public-works/water", phone: "1-612-673-1114", scope: "STATE", states: ["MN"], popularityScore: 75, tags: ["water"] },
  { name: "Jackson Water", slug: "jackson-water-ms", category: "UTILITY_WATER", description: "Water utility for Jackson, MS", website: "https://www.jacksonms.gov/public-works", phone: "1-601-960-2723", scope: "STATE", states: ["MS"], popularityScore: 65, tags: ["water"] },
  { name: "City of Billings Water", slug: "billings-water-mt", category: "UTILITY_WATER", description: "Water utility for Billings, Montana", website: "https://ci.billings.mt.us/160/Public-Works", phone: "1-406-657-8310", scope: "STATE", states: ["MT"], popularityScore: 68, tags: ["water"] },
  { name: "Metropolitan Utilities District (Omaha)", slug: "mud-ne", category: "UTILITY_WATER", description: "Water and gas utility for Omaha, Nebraska", website: "https://www.mudomaha.com", phone: "1-402-554-6666", scope: "STATE", states: ["NE"], popularityScore: 80, tags: ["water", "gas"] },
  { name: "Pennichuck Water", slug: "pennichuck-nh", category: "UTILITY_WATER", description: "Water utility for Nashua and southern New Hampshire", website: "https://www.pennichuck.com", phone: "1-603-882-5191", scope: "STATE", states: ["NH"], popularityScore: 72, tags: ["water"] },
  { name: "Albuquerque Bernalillo County Water Utility", slug: "abcwua-nm", category: "UTILITY_WATER", description: "Water utility for Albuquerque metro", website: "https://www.abcwua.org", phone: "1-505-842-9287", scope: "STATE", states: ["NM"], popularityScore: 75, tags: ["water"] },
  { name: "Fargo Water", slug: "fargo-water-nd", category: "UTILITY_WATER", description: "Water utility for Fargo, North Dakota", website: "https://www.fargond.gov/city-government/departments/water", phone: "1-701-241-1324", scope: "STATE", states: ["ND"], popularityScore: 70, tags: ["water"] },
  { name: "Oklahoma City Utilities", slug: "okc-water", category: "UTILITY_WATER", description: "Water utility for Oklahoma City", website: "https://www.okc.gov/departments/utilities", phone: "1-405-297-2833", scope: "STATE", states: ["OK"], popularityScore: 74, tags: ["water"] },
  { name: "Tulsa Water", slug: "tulsa-water-ok", category: "UTILITY_WATER", description: "Water utility for Tulsa", website: "https://www.cityoftulsa.org/government/departments/water-and-sewer", phone: "1-918-596-9511", scope: "STATE", states: ["OK"], popularityScore: 72, tags: ["water"] },
  { name: "Portland Water Bureau", slug: "portland-water-or", category: "UTILITY_WATER", description: "Water utility for Portland, Oregon", website: "https://www.portland.gov/water", phone: "1-503-823-7770", scope: "STATE", states: ["OR"], popularityScore: 78, tags: ["water"] },
  { name: "Providence Water", slug: "providence-water-ri", category: "UTILITY_WATER", description: "Water utility for Providence and most of Rhode Island", website: "https://www.provwater.com", phone: "1-401-521-6300", scope: "STATE", states: ["RI"], popularityScore: 76, tags: ["water"] },
  { name: "Charleston Water System", slug: "charleston-water-sc", category: "UTILITY_WATER", description: "Water and sewer utility for Charleston, SC", website: "https://www.charlestonwater.com", phone: "1-843-727-6800", scope: "STATE", states: ["SC"], popularityScore: 74, tags: ["water"] },
  { name: "Sioux Falls Water", slug: "sioux-falls-water-sd", category: "UTILITY_WATER", description: "Water utility for Sioux Falls, South Dakota", website: "https://www.siouxfalls.org/public-works/water", phone: "1-605-367-8131", scope: "STATE", states: ["SD"], popularityScore: 70, tags: ["water"] },
  { name: "Salt Lake City Public Utilities", slug: "slc-water-ut", category: "UTILITY_WATER", description: "Water utility for Salt Lake City", website: "https://www.slc.gov/utilities", phone: "1-801-483-6900", scope: "STATE", states: ["UT"], popularityScore: 75, tags: ["water"] },
  { name: "Burlington Department of Public Works Water", slug: "burlington-water-vt", category: "UTILITY_WATER", description: "Water utility for Burlington, Vermont", website: "https://www.burlingtonvt.gov/DPW/Water", phone: "1-802-863-4501", scope: "STATE", states: ["VT"], popularityScore: 68, tags: ["water"] },
  { name: "Seattle Public Utilities", slug: "spu-wa", category: "UTILITY_WATER", description: "Water, sewer, and drainage utility for Seattle", website: "https://www.seattle.gov/utilities", phone: "1-206-684-3000", scope: "STATE", states: ["WA"], popularityScore: 82, tags: ["water"] },
  { name: "Cheyenne Board of Public Utilities", slug: "cheyenne-bopu-wy", category: "UTILITY_WATER", description: "Water utility for Cheyenne, Wyoming", website: "https://www.cheyennebopu.org", phone: "1-307-637-6460", scope: "STATE", states: ["WY"], popularityScore: 68, tags: ["water"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: COVERAGE GAP FILLS — GAS (2026-04-17)
  // ══════════════════════════════════════════════════════════
  { name: "ENSTAR Natural Gas", slug: "enstar-ak", category: "UTILITY_GAS", description: "Natural gas utility for Anchorage and south-central Alaska", website: "https://www.enstarnaturalgas.com", phone: "1-907-277-5551", scope: "STATE", states: ["AK"], popularityScore: 80, tags: ["gas"] },
  { name: "CenterPoint Energy Arkansas", slug: "centerpoint-ar", category: "UTILITY_GAS", description: "Natural gas utility for Arkansas", website: "https://www.centerpointenergy.com", phone: "1-800-992-7552", scope: "STATE", states: ["AR"], popularityScore: 78, tags: ["gas"] },
  { name: "Black Hills Energy Colorado", slug: "bhe-co-gas", category: "UTILITY_GAS", description: "Natural gas utility for southeastern Colorado", website: "https://www.blackhillsenergy.com", phone: "1-888-890-5554", scope: "STATE", states: ["CO"], popularityScore: 70, tags: ["gas"] },
  { name: "Southern Connecticut Gas", slug: "socogas-ct", category: "UTILITY_GAS", description: "Natural gas utility for southern Connecticut", website: "https://www.soconngas.com", phone: "1-877-944-6427", scope: "STATE", states: ["CT"], popularityScore: 74, tags: ["gas"] },
  { name: "Chesapeake Utilities Delaware", slug: "chpk-de-gas", category: "UTILITY_GAS", description: "Natural gas utility for Delaware", website: "https://www.chpkgas.com", phone: "1-888-427-2883", scope: "STATE", states: ["DE", "MD"], popularityScore: 72, tags: ["gas"] },
  { name: "Hawaii Gas", slug: "hawaii-gas", category: "UTILITY_GAS", description: "Synthetic and propane gas utility for Hawaii", website: "https://www.hawaiigas.com", phone: "1-808-535-5933", scope: "STATE", states: ["HI"], popularityScore: 75, tags: ["gas"] },
  { name: "Intermountain Gas", slug: "intgas-id", category: "UTILITY_GAS", description: "Natural gas utility for Idaho", website: "https://www.intgas.com", phone: "1-800-548-3679", scope: "STATE", states: ["ID"], popularityScore: 78, tags: ["gas"] },
  { name: "Black Hills Energy Iowa", slug: "bhe-ia-gas", category: "UTILITY_GAS", description: "Natural gas utility for Iowa", website: "https://www.blackhillsenergy.com", phone: "1-888-890-5554", scope: "STATE", states: ["IA"], popularityScore: 72, tags: ["gas"] },
  { name: "Kansas Gas Service", slug: "kgs-ks", category: "UTILITY_GAS", description: "Natural gas utility for Kansas (ONE Gas)", website: "https://www.kansasgasservice.com", phone: "1-800-794-4780", scope: "STATE", states: ["KS"], popularityScore: 80, tags: ["gas"] },
  { name: "Atmos Energy Louisiana", slug: "atmos-la", category: "UTILITY_GAS", description: "Natural gas utility for Louisiana", website: "https://www.atmosenergy.com", phone: "1-888-286-6700", scope: "STATE", states: ["LA"], popularityScore: 72, tags: ["gas"] },
  { name: "Summit Natural Gas of Maine", slug: "summit-me", category: "UTILITY_GAS", description: "Natural gas utility for central Maine", website: "https://www.summitnaturalgas.com", phone: "1-855-923-9432", scope: "STATE", states: ["ME"], popularityScore: 65, tags: ["gas"] },
  { name: "CenterPoint Energy Minnesota", slug: "centerpoint-mn", category: "UTILITY_GAS", description: "Natural gas utility for Minnesota", website: "https://www.centerpointenergy.com/minnesota", phone: "1-800-245-2377", scope: "STATE", states: ["MN"], popularityScore: 82, tags: ["gas"] },
  { name: "Atmos Energy Mississippi", slug: "atmos-ms", category: "UTILITY_GAS", description: "Natural gas utility for Mississippi", website: "https://www.atmosenergy.com", phone: "1-888-286-6700", scope: "STATE", states: ["MS"], popularityScore: 70, tags: ["gas"] },
  { name: "NorthWestern Energy", slug: "nwe-mt", category: "UTILITY_GAS", description: "Natural gas and electric utility for Montana and SD/NE", website: "https://www.northwesternenergy.com", phone: "1-888-467-2669", scope: "STATE", states: ["MT", "SD", "NE"], popularityScore: 82, tags: ["gas", "electric"] },
  { name: "Black Hills Energy Nebraska", slug: "bhe-ne-gas", category: "UTILITY_GAS", description: "Natural gas utility for Nebraska", website: "https://www.blackhillsenergy.com", phone: "1-888-890-5554", scope: "STATE", states: ["NE"], popularityScore: 70, tags: ["gas"] },
  { name: "Unitil New Hampshire", slug: "unitil-nh", category: "UTILITY_GAS", description: "Natural gas utility for southern New Hampshire", website: "https://www.unitil.com", phone: "1-866-933-3821", scope: "STATE", states: ["NH", "MA"], popularityScore: 70, tags: ["gas"] },
  { name: "New Mexico Gas Company", slug: "nmgas", category: "UTILITY_GAS", description: "Natural gas utility for New Mexico", website: "https://www.nmgco.com", phone: "1-888-664-2726", scope: "STATE", states: ["NM"], popularityScore: 80, tags: ["gas"] },
  { name: "Xcel Energy North Dakota Gas", slug: "xcel-nd-gas", category: "UTILITY_GAS", description: "Natural gas utility for eastern North Dakota", website: "https://www.xcelenergy.com", phone: "1-800-895-4999", scope: "STATE", states: ["ND"], popularityScore: 78, tags: ["gas"] },
  { name: "Oklahoma Natural Gas (ONE Gas)", slug: "ong-ok", category: "UTILITY_GAS", description: "Natural gas utility for Oklahoma", website: "https://www.oklahomanaturalgas.com", phone: "1-800-664-5463", scope: "STATE", states: ["OK"], popularityScore: 85, tags: ["gas"] },
  { name: "Dominion Energy South Carolina Gas", slug: "dominion-sc-gas", category: "UTILITY_GAS", description: "Natural gas utility for South Carolina", website: "https://www.dominionenergy.com/south-carolina", phone: "1-800-251-7234", scope: "STATE", states: ["SC"], popularityScore: 80, tags: ["gas"] },
  { name: "MDU Resources South Dakota Gas", slug: "mdu-sd-gas", category: "UTILITY_GAS", description: "Natural gas utility for South Dakota", website: "https://www.montana-dakota.com", phone: "1-800-638-3278", scope: "STATE", states: ["SD"], popularityScore: 76, tags: ["gas"] },
  { name: "Piedmont Natural Gas Tennessee", slug: "piedmont-tn", category: "UTILITY_GAS", description: "Natural gas utility for Tennessee", website: "https://www.piedmontng.com", phone: "1-800-752-7504", scope: "STATE", states: ["TN", "NC", "SC"], popularityScore: 80, tags: ["gas"] },
  { name: "Dominion Energy Utah", slug: "dominion-ut-gas", category: "UTILITY_GAS", description: "Natural gas utility for Utah (formerly Questar Gas)", website: "https://www.dominionenergy.com/utah", phone: "1-800-323-5517", scope: "STATE", states: ["UT", "WY", "ID"], popularityScore: 85, tags: ["gas"] },
  { name: "Cascade Natural Gas", slug: "cascade-wa-gas", category: "UTILITY_GAS", description: "Natural gas utility for Washington and Oregon", website: "https://www.cngc.com", phone: "1-888-522-1130", scope: "STATE", states: ["WA", "OR"], popularityScore: 75, tags: ["gas"] },
  { name: "Mountaineer Gas", slug: "mountaineer-wv", category: "UTILITY_GAS", description: "Natural gas utility for West Virginia", website: "https://www.mountaineergas.com", phone: "1-800-834-2070", scope: "STATE", states: ["WV"], popularityScore: 76, tags: ["gas"] },
  { name: "Wisconsin Public Service Gas", slug: "wps-wi-gas", category: "UTILITY_GAS", description: "Natural gas utility for northeast and central Wisconsin", website: "https://www.wisconsinpublicservice.com", phone: "1-800-450-7260", scope: "STATE", states: ["WI"], popularityScore: 76, tags: ["gas"] },
  { name: "Source Gas Distribution Wyoming", slug: "source-gas-wy", category: "UTILITY_GAS", description: "Natural gas utility for Wyoming (Black Hills Energy)", website: "https://www.blackhillsenergy.com", phone: "1-888-890-5554", scope: "STATE", states: ["WY"], popularityScore: 72, tags: ["gas"] },
  { name: "Rhode Island Energy Gas", slug: "ri-energy-gas", category: "UTILITY_GAS", description: "Natural gas utility for Rhode Island (successor to National Grid RI)", website: "https://www.rienergy.com", phone: "1-855-743-1101", scope: "STATE", states: ["RI"], popularityScore: 86, tags: ["gas"] },

  // ══════════════════════════════════════════════════════════
  // PR-E: GOVERNMENT_VOTER — STATE REGISTRATION PORTALS (50 states)
  // Each state's Secretary of State (or equivalent) voter portal.
  // ══════════════════════════════════════════════════════════
  { name: "Alabama Secretary of State — Voter", slug: "vote-al", category: "GOVERNMENT_VOTER", description: "Alabama voter registration and elections", website: "https://www.sos.alabama.gov/alabama-votes", phone: "1-334-242-7210", scope: "STATE", states: ["AL"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Alaska Division of Elections", slug: "vote-ak", category: "GOVERNMENT_VOTER", description: "Alaska voter registration and elections", website: "https://www.elections.alaska.gov", phone: "1-907-465-4611", scope: "STATE", states: ["AK"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Arizona Voter Registration", slug: "vote-az", category: "GOVERNMENT_VOTER", description: "Arizona voter registration (Service Arizona / EZVoter)", website: "https://servicearizona.com/voterRegistration", phone: "1-602-542-4285", scope: "STATE", states: ["AZ"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Arkansas Secretary of State — Voter", slug: "vote-ar", category: "GOVERNMENT_VOTER", description: "Arkansas voter registration and elections", website: "https://www.sos.arkansas.gov/elections", phone: "1-501-682-5070", scope: "STATE", states: ["AR"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "California Secretary of State — Voter", slug: "vote-ca", category: "GOVERNMENT_VOTER", description: "California voter registration (registertovote.ca.gov)", website: "https://registertovote.ca.gov", phone: "1-800-345-8683", scope: "STATE", states: ["CA"], popularityScore: 85, tags: ["voter", "government", "essential"] },
  { name: "Colorado Secretary of State — Voter", slug: "vote-co", category: "GOVERNMENT_VOTER", description: "Colorado voter registration (GoVoteColorado)", website: "https://www.sos.state.co.us/voter", phone: "1-303-894-2200", scope: "STATE", states: ["CO"], popularityScore: 78, tags: ["voter", "government", "essential"] },
  { name: "Connecticut Secretary of State — Voter", slug: "vote-ct", category: "GOVERNMENT_VOTER", description: "Connecticut voter registration and elections", website: "https://portal.ct.gov/sots/election-services/elections", phone: "1-860-509-6200", scope: "STATE", states: ["CT"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Delaware Department of Elections", slug: "vote-de", category: "GOVERNMENT_VOTER", description: "Delaware voter registration and elections", website: "https://elections.delaware.gov", phone: "1-302-739-4277", scope: "STATE", states: ["DE"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "DC Board of Elections", slug: "vote-dc", category: "GOVERNMENT_VOTER", description: "DC voter registration and elections", website: "https://www.dcboe.org", phone: "1-202-727-2525", scope: "STATE", states: ["DC"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Florida Division of Elections", slug: "vote-fl", category: "GOVERNMENT_VOTER", description: "Florida voter registration (RegisterToVoteFlorida.gov)", website: "https://registertovoteflorida.gov", phone: "1-866-308-6739", scope: "STATE", states: ["FL"], popularityScore: 80, tags: ["voter", "government", "essential"] },
  { name: "Georgia My Voter Page", slug: "vote-ga", category: "GOVERNMENT_VOTER", description: "Georgia voter registration and My Voter Page", website: "https://mvp.sos.ga.gov", phone: "1-404-656-2871", scope: "STATE", states: ["GA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Hawaii Office of Elections", slug: "vote-hi", category: "GOVERNMENT_VOTER", description: "Hawaii voter registration and elections", website: "https://elections.hawaii.gov", phone: "1-808-453-8683", scope: "STATE", states: ["HI"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Idaho Secretary of State — Voter", slug: "vote-id", category: "GOVERNMENT_VOTER", description: "Idaho voter registration and elections", website: "https://elections.sos.idaho.gov", phone: "1-208-334-2852", scope: "STATE", states: ["ID"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Illinois State Board of Elections", slug: "vote-il", category: "GOVERNMENT_VOTER", description: "Illinois voter registration (Online Voter Application)", website: "https://ova.elections.il.gov", phone: "1-217-782-4141", scope: "STATE", states: ["IL"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Indiana Voter Portal", slug: "vote-in", category: "GOVERNMENT_VOTER", description: "Indiana voter registration (IndianaVoters.com)", website: "https://indianavoters.in.gov", phone: "1-317-232-3939", scope: "STATE", states: ["IN"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Iowa Secretary of State — Voter", slug: "vote-ia", category: "GOVERNMENT_VOTER", description: "Iowa voter registration and elections", website: "https://sos.iowa.gov/elections", phone: "1-515-281-5204", scope: "STATE", states: ["IA"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Kansas Secretary of State — Voter", slug: "vote-ks", category: "GOVERNMENT_VOTER", description: "Kansas voter registration (VoteKansas.gov)", website: "https://www.sos.ks.gov/elections/elections.html", phone: "1-785-296-4561", scope: "STATE", states: ["KS"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Kentucky State Board of Elections", slug: "vote-ky", category: "GOVERNMENT_VOTER", description: "Kentucky voter registration (GoVoteKY.com)", website: "https://vrsws.sos.ky.gov/ovrweb", phone: "1-502-573-7100", scope: "STATE", states: ["KY"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Louisiana Secretary of State — Voter", slug: "vote-la", category: "GOVERNMENT_VOTER", description: "Louisiana voter registration (GeauxVote)", website: "https://voterportal.sos.la.gov", phone: "1-225-922-0900", scope: "STATE", states: ["LA"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Maine Secretary of State — Voter", slug: "vote-me", category: "GOVERNMENT_VOTER", description: "Maine voter registration and elections", website: "https://www.maine.gov/sos/cec/elec/voter-info", phone: "1-207-624-7650", scope: "STATE", states: ["ME"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Maryland State Board of Elections", slug: "vote-md", category: "GOVERNMENT_VOTER", description: "Maryland voter registration and elections", website: "https://elections.maryland.gov", phone: "1-800-222-8683", scope: "STATE", states: ["MD"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Massachusetts Elections Division", slug: "vote-ma", category: "GOVERNMENT_VOTER", description: "Massachusetts voter registration (RegisterToVoteMA)", website: "https://www.sec.state.ma.us/divisions/elections", phone: "1-617-727-2828", scope: "STATE", states: ["MA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Michigan Voter Information Center", slug: "vote-mi", category: "GOVERNMENT_VOTER", description: "Michigan voter registration (MVIC)", website: "https://mvic.sos.state.mi.us", phone: "1-517-335-3234", scope: "STATE", states: ["MI"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Minnesota Secretary of State — Voter", slug: "vote-mn", category: "GOVERNMENT_VOTER", description: "Minnesota voter registration and elections", website: "https://mnvotes.sos.mn.gov", phone: "1-651-215-1440", scope: "STATE", states: ["MN"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Mississippi Secretary of State — Voter", slug: "vote-ms", category: "GOVERNMENT_VOTER", description: "Mississippi voter registration and elections", website: "https://www.sos.ms.gov/elections-voting", phone: "1-601-359-1350", scope: "STATE", states: ["MS"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "Missouri Secretary of State — Voter", slug: "vote-mo", category: "GOVERNMENT_VOTER", description: "Missouri voter registration and elections", website: "https://www.sos.mo.gov/elections", phone: "1-573-751-2301", scope: "STATE", states: ["MO"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Montana Secretary of State — Voter", slug: "vote-mt", category: "GOVERNMENT_VOTER", description: "Montana voter registration and elections", website: "https://sosmt.gov/elections", phone: "1-406-444-9608", scope: "STATE", states: ["MT"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "Nebraska Secretary of State — Voter", slug: "vote-ne", category: "GOVERNMENT_VOTER", description: "Nebraska voter registration and elections", website: "https://sos.nebraska.gov/elections", phone: "1-402-471-2555", scope: "STATE", states: ["NE"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Nevada Secretary of State — Voter", slug: "vote-nv", category: "GOVERNMENT_VOTER", description: "Nevada voter registration and elections (RegisterToVoteNV)", website: "https://www.nvsos.gov/sos/elections", phone: "1-775-684-5705", scope: "STATE", states: ["NV"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "New Hampshire Secretary of State — Voter", slug: "vote-nh", category: "GOVERNMENT_VOTER", description: "New Hampshire voter registration and elections", website: "https://www.sos.nh.gov/elections", phone: "1-603-271-3242", scope: "STATE", states: ["NH"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "New Jersey Voter Registration", slug: "vote-nj", category: "GOVERNMENT_VOTER", description: "New Jersey voter registration (Vote.NJ.gov)", website: "https://www.vote.nj.gov", phone: "1-877-658-6837", scope: "STATE", states: ["NJ"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "New Mexico Secretary of State — Voter", slug: "vote-nm", category: "GOVERNMENT_VOTER", description: "New Mexico voter registration and elections", website: "https://www.sos.state.nm.us/voting-and-elections", phone: "1-800-477-3632", scope: "STATE", states: ["NM"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "New York State Board of Elections", slug: "vote-ny", category: "GOVERNMENT_VOTER", description: "New York voter registration (voterlookup.elections.ny.gov)", website: "https://elections.ny.gov", phone: "1-518-474-8100", scope: "STATE", states: ["NY"], popularityScore: 80, tags: ["voter", "government", "essential"] },
  { name: "North Carolina State Board of Elections", slug: "vote-nc", category: "GOVERNMENT_VOTER", description: "North Carolina voter registration and elections", website: "https://www.ncsbe.gov", phone: "1-919-814-0700", scope: "STATE", states: ["NC"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "North Dakota Secretary of State — Voter", slug: "vote-nd", category: "GOVERNMENT_VOTER", description: "North Dakota voter information (no registration required)", website: "https://vip.sos.nd.gov", phone: "1-701-328-2900", scope: "STATE", states: ["ND"], popularityScore: 65, tags: ["voter", "government", "essential"] },
  { name: "Ohio Secretary of State — Voter", slug: "vote-oh", category: "GOVERNMENT_VOTER", description: "Ohio voter registration (OhioSoS.gov)", website: "https://www.ohiosos.gov/elections/voters", phone: "1-877-767-6446", scope: "STATE", states: ["OH"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Oklahoma State Election Board", slug: "vote-ok", category: "GOVERNMENT_VOTER", description: "Oklahoma voter registration and elections", website: "https://oklahoma.gov/elections", phone: "1-405-521-2391", scope: "STATE", states: ["OK"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Oregon Secretary of State — Voter", slug: "vote-or", category: "GOVERNMENT_VOTER", description: "Oregon voter registration (OregonVotes)", website: "https://sos.oregon.gov/voting/Pages/default.aspx", phone: "1-866-673-8683", scope: "STATE", states: ["OR"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Pennsylvania Department of State — Voter", slug: "vote-pa", category: "GOVERNMENT_VOTER", description: "Pennsylvania voter registration (VotesPA)", website: "https://www.vote.pa.gov", phone: "1-877-868-3772", scope: "STATE", states: ["PA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Rhode Island Secretary of State — Voter", slug: "vote-ri", category: "GOVERNMENT_VOTER", description: "Rhode Island voter registration and elections", website: "https://vote.sos.ri.gov", phone: "1-401-222-2345", scope: "STATE", states: ["RI"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "South Carolina Election Commission", slug: "vote-sc", category: "GOVERNMENT_VOTER", description: "South Carolina voter registration (scVOTES)", website: "https://www.scvotes.gov", phone: "1-803-734-9060", scope: "STATE", states: ["SC"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "South Dakota Secretary of State — Voter", slug: "vote-sd", category: "GOVERNMENT_VOTER", description: "South Dakota voter registration and elections", website: "https://sdsos.gov/elections-voting", phone: "1-605-773-3537", scope: "STATE", states: ["SD"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "Tennessee Secretary of State — Voter", slug: "vote-tn", category: "GOVERNMENT_VOTER", description: "Tennessee voter registration (GoVoteTN)", website: "https://sos.tn.gov/elections", phone: "1-877-850-4959", scope: "STATE", states: ["TN"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Texas Voter Registration", slug: "vote-tx", category: "GOVERNMENT_VOTER", description: "Texas voter registration and election info (VoteTexas.gov)", website: "https://www.votetexas.gov", phone: "1-800-252-8683", scope: "STATE", states: ["TX"], popularityScore: 82, tags: ["voter", "government", "essential"] },
  { name: "Utah Voter Registration", slug: "vote-ut", category: "GOVERNMENT_VOTER", description: "Utah voter registration (Vote.Utah.gov)", website: "https://vote.utah.gov", phone: "1-801-538-1041", scope: "STATE", states: ["UT"], popularityScore: 72, tags: ["voter", "government", "essential"] },
  { name: "Vermont Secretary of State — Voter", slug: "vote-vt", category: "GOVERNMENT_VOTER", description: "Vermont voter registration and elections", website: "https://sos.vermont.gov/elections", phone: "1-802-828-2363", scope: "STATE", states: ["VT"], popularityScore: 70, tags: ["voter", "government", "essential"] },
  { name: "Virginia Department of Elections", slug: "vote-va", category: "GOVERNMENT_VOTER", description: "Virginia voter registration (elections.virginia.gov)", website: "https://www.elections.virginia.gov", phone: "1-800-552-9745", scope: "STATE", states: ["VA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "Washington Secretary of State — Voter", slug: "vote-wa", category: "GOVERNMENT_VOTER", description: "Washington voter registration (VoteWA.gov)", website: "https://voter.votewa.gov", phone: "1-800-448-4881", scope: "STATE", states: ["WA"], popularityScore: 76, tags: ["voter", "government", "essential"] },
  { name: "West Virginia Secretary of State — Voter", slug: "vote-wv", category: "GOVERNMENT_VOTER", description: "West Virginia voter registration (GoVoteWV)", website: "https://ovr.sos.wv.gov", phone: "1-304-558-6000", scope: "STATE", states: ["WV"], popularityScore: 68, tags: ["voter", "government", "essential"] },
  { name: "Wisconsin Elections Commission", slug: "vote-wi", category: "GOVERNMENT_VOTER", description: "Wisconsin voter registration (MyVote.wi.gov)", website: "https://myvote.wi.gov", phone: "1-608-266-8005", scope: "STATE", states: ["WI"], popularityScore: 74, tags: ["voter", "government", "essential"] },
  { name: "Wyoming Secretary of State — Voter", slug: "vote-wy", category: "GOVERNMENT_VOTER", description: "Wyoming voter registration and elections", website: "https://sos.wyo.gov/elections", phone: "1-307-777-5860", scope: "STATE", states: ["WY"], popularityScore: 66, tags: ["voter", "government", "essential"] },

  // ── Renters Insurance (FINANCIAL_INSURANCE_RENTERS) ──
  { name: "Lemonade Renters", slug: "lemonade-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "AI-powered renters insurance starting at $5/mo", website: "https://www.lemonade.com/renters-insurance", phone: "1-844-733-8666", scope: "FEDERAL", popularityScore: 82, tags: ["renters", "insurance", "rental"] },
  { name: "State Farm Renters", slug: "state-farm-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance from State Farm", website: "https://www.statefarm.com/insurance/home-and-property/renters", phone: "1-800-782-8332", scope: "FEDERAL", popularityScore: 85, tags: ["renters", "insurance"] },
  { name: "Allstate Renters", slug: "allstate-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters coverage from Allstate", website: "https://www.allstate.com/renters-insurance", phone: "1-800-255-7828", scope: "FEDERAL", popularityScore: 80, tags: ["renters", "insurance"] },
  { name: "Geico Renters", slug: "geico-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance from Geico", website: "https://www.geico.com/renters-insurance", phone: "1-800-841-3000", scope: "FEDERAL", popularityScore: 78, tags: ["renters", "insurance"] },
  { name: "Progressive Renters", slug: "progressive-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance from Progressive", website: "https://www.progressive.com/renters", phone: "1-866-749-7436", scope: "FEDERAL", popularityScore: 76, tags: ["renters", "insurance"] },
  { name: "Liberty Mutual Renters", slug: "liberty-mutual-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance from Liberty Mutual", website: "https://www.libertymutual.com/renters-insurance", phone: "1-800-290-8711", scope: "FEDERAL", popularityScore: 72, tags: ["renters", "insurance"] },
  { name: "USAA Renters", slug: "usaa-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance for military families", website: "https://www.usaa.com/inet/wc/insurance-renters-product", phone: "1-800-531-8722", scope: "FEDERAL", popularityScore: 75, tags: ["renters", "insurance", "military"] },
  { name: "Assurant Renters", slug: "assurant-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance commonly offered via apartment communities", website: "https://www.assurant.com/renters-insurance", phone: "1-888-260-7736", scope: "FEDERAL", popularityScore: 60, tags: ["renters", "insurance", "apartment"] },
  { name: "Toggle Renters", slug: "toggle-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Customizable renters insurance by Farmers", website: "https://gettoggle.com", scope: "FEDERAL", popularityScore: 58, tags: ["renters", "insurance"] },
  { name: "Jetty Renters", slug: "jetty-renters", category: "FINANCIAL_INSURANCE_RENTERS", description: "Renters insurance built for apartment dwellers", website: "https://www.jetty.com/renters-insurance", scope: "FEDERAL", popularityScore: 55, tags: ["renters", "insurance", "apartment"] },

  // ── Payment Apps / Fintech (FINANCIAL_FINTECH) ──
  { name: "Venmo", slug: "venmo", category: "FINANCIAL_FINTECH", description: "Send and receive money with friends", website: "https://venmo.com", scope: "FEDERAL", popularityScore: 92, tags: ["payments", "p2p", "fintech"] },
  { name: "PayPal", slug: "paypal", category: "FINANCIAL_FINTECH", description: "Digital payments and money transfers", website: "https://www.paypal.com", phone: "1-888-221-1161", scope: "FEDERAL", popularityScore: 90, tags: ["payments", "fintech"] },
  { name: "Zelle", slug: "zelle", category: "FINANCIAL_FINTECH", description: "Bank-backed instant money transfers", website: "https://www.zellepay.com", scope: "FEDERAL", popularityScore: 88, tags: ["payments", "p2p", "banking"] },
  { name: "Cash App", slug: "cash-app", category: "FINANCIAL_FINTECH", description: "Peer-to-peer payments, banking, and investing", website: "https://cash.app", scope: "FEDERAL", popularityScore: 87, tags: ["payments", "p2p", "banking"] },
  { name: "Apple Pay", slug: "apple-pay", category: "FINANCIAL_FINTECH", description: "Contactless payments from iPhone and Apple Watch", website: "https://www.apple.com/apple-pay", scope: "FEDERAL", popularityScore: 85, tags: ["payments", "contactless"] },
  { name: "Google Pay", slug: "google-pay", category: "FINANCIAL_FINTECH", description: "Contactless payments from Android devices", website: "https://pay.google.com", scope: "FEDERAL", popularityScore: 78, tags: ["payments", "contactless"] },
  { name: "Chime", slug: "chime", category: "FINANCIAL_FINTECH", description: "Fee-free mobile banking", website: "https://www.chime.com", phone: "1-844-244-6363", scope: "FEDERAL", popularityScore: 82, tags: ["banking", "fintech"] },
  { name: "Wise", slug: "wise", category: "FINANCIAL_FINTECH", description: "International money transfers at real exchange rates", website: "https://wise.com", scope: "FEDERAL", popularityScore: 72, tags: ["payments", "international", "fintech"] },
  { name: "Current", slug: "current", category: "FINANCIAL_FINTECH", description: "Mobile banking with early paycheck access", website: "https://current.com", scope: "FEDERAL", popularityScore: 62, tags: ["banking", "fintech"] },
  { name: "Varo Bank", slug: "varo", category: "FINANCIAL_FINTECH", description: "All-mobile bank with no monthly fees", website: "https://www.varomoney.com", phone: "1-877-377-8276", scope: "FEDERAL", popularityScore: 65, tags: ["banking", "fintech"] },

  // ── Telemedicine (HEALTHCARE_TELEMEDICINE) ──
  { name: "MDLive", slug: "mdlive", category: "HEALTHCARE_TELEMEDICINE", description: "24/7 virtual doctor visits", website: "https://www.mdlive.com", phone: "1-888-632-2738", scope: "FEDERAL", popularityScore: 75, tags: ["telemedicine", "virtual", "health"] },
  { name: "Amwell", slug: "amwell", category: "HEALTHCARE_TELEMEDICINE", description: "Online doctor visits via video", website: "https://amwell.com", phone: "1-844-733-3627", scope: "FEDERAL", popularityScore: 72, tags: ["telemedicine", "virtual", "health"] },
  { name: "Doctor on Demand", slug: "doctor-on-demand", category: "HEALTHCARE_TELEMEDICINE", description: "Virtual urgent, primary, and mental health care", website: "https://doctorondemand.com", phone: "1-800-997-6196", scope: "FEDERAL", popularityScore: 70, tags: ["telemedicine", "virtual", "health"] },
  { name: "K Health", slug: "k-health", category: "HEALTHCARE_TELEMEDICINE", description: "AI-assisted primary care via mobile", website: "https://khealth.com", scope: "FEDERAL", popularityScore: 62, tags: ["telemedicine", "virtual"] },
  { name: "PlushCare", slug: "plushcare", category: "HEALTHCARE_TELEMEDICINE", description: "Online doctor visits and prescriptions", website: "https://plushcare.com", phone: "1-800-221-5140", scope: "FEDERAL", popularityScore: 60, tags: ["telemedicine", "virtual"] },
  { name: "Hims", slug: "hims", category: "HEALTHCARE_TELEMEDICINE", description: "Men's telehealth for hair, skin, sexual health, mental health", website: "https://www.hims.com", scope: "FEDERAL", popularityScore: 72, tags: ["telemedicine", "mens-health"] },
  { name: "Hers", slug: "hers", category: "HEALTHCARE_TELEMEDICINE", description: "Women's telehealth for skin, hair, mental health, sexual wellness", website: "https://www.forhers.com", scope: "FEDERAL", popularityScore: 70, tags: ["telemedicine", "womens-health"] },
  { name: "Talkspace", slug: "talkspace", category: "HEALTHCARE_TELEMEDICINE", description: "Online therapy and psychiatry", website: "https://www.talkspace.com", scope: "FEDERAL", popularityScore: 75, tags: ["telemedicine", "therapy", "mental-health"] },
  { name: "BetterHelp", slug: "betterhelp", category: "HEALTHCARE_TELEMEDICINE", description: "Online therapy with licensed therapists", website: "https://www.betterhelp.com", scope: "FEDERAL", popularityScore: 82, tags: ["telemedicine", "therapy", "mental-health"] },
  { name: "Ro", slug: "ro", category: "HEALTHCARE_TELEMEDICINE", description: "Telehealth platform for primary, sexual, and weight care", website: "https://ro.co", scope: "FEDERAL", popularityScore: 65, tags: ["telemedicine", "virtual"] },

  // ── Local Dining & Food Discovery (LOCAL_DINING) ──
  { name: "Yelp", slug: "yelp", category: "LOCAL_DINING", description: "Find and review local restaurants and businesses", website: "https://www.yelp.com", scope: "FEDERAL", popularityScore: 88, tags: ["dining", "reviews", "local"] },
  { name: "OpenTable", slug: "opentable", category: "LOCAL_DINING", description: "Restaurant reservations online", website: "https://www.opentable.com", scope: "FEDERAL", popularityScore: 85, tags: ["dining", "reservations"] },
  { name: "Resy", slug: "resy", category: "LOCAL_DINING", description: "Restaurant discovery and reservations by Amex", website: "https://resy.com", scope: "FEDERAL", popularityScore: 75, tags: ["dining", "reservations"] },
  { name: "Uber Eats", slug: "uber-eats", category: "LOCAL_DINING", description: "Food delivery from local restaurants", website: "https://www.ubereats.com", scope: "FEDERAL", popularityScore: 92, tags: ["dining", "delivery"] },
  { name: "Seamless", slug: "seamless", category: "LOCAL_DINING", description: "Food delivery from local restaurants (Grubhub-owned)", website: "https://www.seamless.com", scope: "FEDERAL", popularityScore: 70, tags: ["dining", "delivery"] },
  { name: "Postmates", slug: "postmates", category: "LOCAL_DINING", description: "On-demand food and grocery delivery (Uber-owned)", website: "https://postmates.com", scope: "FEDERAL", popularityScore: 70, tags: ["dining", "delivery"] },
  { name: "Caviar", slug: "caviar", category: "LOCAL_DINING", description: "Upscale food delivery (part of DoorDash)", website: "https://www.trycaviar.com", scope: "FEDERAL", popularityScore: 60, tags: ["dining", "delivery"] },
  { name: "ChowNow", slug: "chownow", category: "LOCAL_DINING", description: "Direct ordering platform for independent restaurants", website: "https://www.chownow.com", scope: "FEDERAL", popularityScore: 55, tags: ["dining", "delivery", "local"] },
  { name: "Toast TakeOut", slug: "toast-takeout", category: "LOCAL_DINING", description: "Order from local restaurants commission-free", website: "https://pos.toasttab.com/products/toast-takeout-app", scope: "FEDERAL", popularityScore: 58, tags: ["dining", "pickup", "local"] },
  { name: "Tock", slug: "tock", category: "LOCAL_DINING", description: "Reservations, ticketed events, and takeout for restaurants", website: "https://www.exploretock.com", scope: "FEDERAL", popularityScore: 58, tags: ["dining", "reservations"] },
  { name: "TripAdvisor", slug: "tripadvisor", category: "LOCAL_DINING", description: "Restaurant and travel reviews worldwide", website: "https://www.tripadvisor.com", scope: "FEDERAL", popularityScore: 78, tags: ["dining", "reviews", "travel"] },

  // ── Childcare / Daycare (KIDS_DAYCARE additions) ──
  { name: "UrbanSitter", slug: "urbansitter", category: "KIDS_DAYCARE", description: "Parent-community based babysitter network", website: "https://www.urbansitter.com", scope: "FEDERAL", popularityScore: 62, tags: ["childcare", "kids", "babysitter"] },
  { name: "La Petite Academy", slug: "la-petite-academy", category: "KIDS_DAYCARE", description: "Preschool and childcare for infants through school-age", website: "https://www.lapetite.com", scope: "FEDERAL", popularityScore: 70, tags: ["childcare", "daycare", "preschool"] },
  { name: "Primrose Schools", slug: "primrose-schools", category: "KIDS_DAYCARE", description: "Premier early education and childcare", website: "https://www.primroseschools.com", scope: "FEDERAL", popularityScore: 72, tags: ["childcare", "daycare", "preschool"] },

  // ── Parking (TRANSPORTATION_PARKING additions) ──
  { name: "SpotHero", slug: "spothero", category: "TRANSPORTATION_PARKING", description: "Reserve parking spots in advance at lots and garages", website: "https://spothero.com", phone: "1-844-356-8054", scope: "FEDERAL", popularityScore: 80, tags: ["parking", "reservation"] },
  { name: "ParkWhiz", slug: "parkwhiz", category: "TRANSPORTATION_PARKING", description: "Book parking in advance at thousands of locations", website: "https://www.parkwhiz.com", scope: "FEDERAL", popularityScore: 72, tags: ["parking", "reservation"] },
  { name: "PayByPhone", slug: "paybyphone", category: "TRANSPORTATION_PARKING", description: "Mobile payments for municipal parking", website: "https://www.paybyphone.com", scope: "FEDERAL", popularityScore: 68, tags: ["parking", "meter"] },
  { name: "Premier Parking", slug: "premier-parking", category: "TRANSPORTATION_PARKING", description: "Parking operator across 30+ US cities", website: "https://www.premierparking.com", scope: "FEDERAL", popularityScore: 58, tags: ["parking"] },

  // ── Internet / Fiber additions (UTILITY_INTERNET) ──
  { name: "T-Mobile Home Internet", slug: "tmobile-home-internet", category: "UTILITY_INTERNET", description: "5G home internet nationwide", website: "https://www.t-mobile.com/home-internet", phone: "1-844-275-9310", scope: "FEDERAL", popularityScore: 78, tags: ["internet", "5g", "wireless"] },
  { name: "Verizon 5G Home Internet", slug: "verizon-5g-home", category: "UTILITY_INTERNET", description: "5G Ultra Wideband home internet", website: "https://www.verizon.com/home/5g-home-internet", phone: "1-800-922-0204", scope: "FEDERAL", popularityScore: 76, tags: ["internet", "5g", "wireless"] },
  { name: "Astound Broadband", slug: "astound", category: "UTILITY_INTERNET", description: "Cable/fiber internet via RCN, Wave, Grande, enTouch", website: "https://www.astound.com", scope: "FEDERAL", popularityScore: 62, tags: ["internet", "cable"] },
  { name: "WOW! Internet", slug: "wow-internet", category: "UTILITY_INTERNET", description: "Broadband cable service in select US markets", website: "https://www.wowway.com", phone: "1-866-496-9669", scope: "FEDERAL", popularityScore: 58, tags: ["internet", "cable"] },
];
