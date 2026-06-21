// ==================== ADDRESS TYPES ====================

export const ADDRESS_TYPES = [
  { value: "HOME", label: "Home", icon: "Home" },
  { value: "WORK", label: "Work", icon: "Briefcase" },
  { value: "VACATION", label: "Vacation", icon: "Palmtree" },
  { value: "TEMPORARY", label: "Temporary", icon: "Clock" },
  { value: "STORAGE", label: "Storage", icon: "Package" },
  { value: "OTHER", label: "Other", icon: "MapPin" },
] as const;

export const OWNERSHIP_TYPES = [
  { value: "OWNER", label: "Owner" },
  { value: "RENTER", label: "Renter" },
  { value: "FAMILY", label: "Family" },
  { value: "OTHER", label: "Other" },
] as const;

// ==================== SERVICE CATEGORIES ====================

export const SERVICE_CATEGORIES = [
  { value: "GOVERNMENT", label: "Government", color: "#E25C5C" },
  { value: "UTILITY", label: "Utilities", color: "#CBA45E" },
  { value: "FINANCIAL", label: "Financial", color: "#54CB7E" },
  { value: "HOUSING", label: "Housing", color: "#CBA45E" },
  { value: "HEALTHCARE", label: "Healthcare", color: "#F0A0B8" },
  { value: "TRANSPORTATION", label: "Transportation", color: "#B0852F" },
  { value: "KIDS", label: "Kids & Education", color: "#B0852F" },
  { value: "FITNESS", label: "Fitness", color: "#CBA45E" },
  { value: "SHOPPING", label: "Shopping", color: "#F0A0B8" },
  { value: "OTHER", label: "Other", color: "#6E7C92" },
] as const;

export const BILLING_CYCLES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "ONE_TIME", label: "One Time" },
] as const;

// ==================== MOVING PLAN ====================

export const MOVING_PLAN_STATUS = {
  PLANNING: "PLANNING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
} as const;

export const CANCELED_MOVING_PLAN_STATUSES = ["CANCELED", "CANCELLED"] as const;

export function normalizeMovingPlanStatus(status: string): string {
  return status === "CANCELLED" ? "CANCELED" : status;
}

export function isCanceledMovingPlanStatus(status: string | null | undefined): boolean {
  return status === "CANCELED" || status === "CANCELLED";
}

export const MOVING_STATUSES = [
  { value: "PLANNING", label: "Planning", color: "#6E7C92" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#CBA45E" },
  { value: "COMPLETED", label: "Completed", color: "#54CB7E" },
  { value: "CANCELED", label: "Canceled", color: "#E25C5C" },
] as const;

// ==================== DOCUMENT ====================

export const DOCUMENT_CATEGORIES = [
  { value: "BILL", label: "Bill" },
  { value: "CONTRACT", label: "Contract" },
  { value: "RECEIPT", label: "Receipt" },
  { value: "INSURANCE_POLICY", label: "Insurance Policy" },
  { value: "LEASE_AGREEMENT", label: "Lease Agreement" },
  { value: "MORTGAGE_DOCUMENT", label: "Mortgage Document" },
  { value: "TAX_DOCUMENT", label: "Tax Document" },
  { value: "MEDICAL_RECORD", label: "Medical Record" },
  { value: "SCHOOL_RECORD", label: "School Record" },
  { value: "ID_DOCUMENT", label: "ID Document" },
  { value: "OTHER", label: "Other" },
] as const;

// ==================== FAMILY STATUS ====================

export const FAMILY_STATUSES = [
  { value: "SINGLE", label: "Single" },
  { value: "COUPLE", label: "Couple" },
  { value: "FAMILY", label: "Family" },
  { value: "OTHER", label: "Other" },
] as const;

// ==================== US STATES ====================

export const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
] as const;

// ==================== MOVE TYPES ====================

export const MOVE_TYPES = [
  { value: "PERSONAL", label: "Personal Move" },
  { value: "BUSINESS", label: "Business Relocation" },
  { value: "VACATION", label: "Vacation / Second Home" },
  { value: "MILITARY", label: "Military (PCS)" },
] as const;

export const BUSINESS_TYPES = [
  { value: "LLC", label: "LLC" },
  { value: "CORP", label: "Corporation" },
  { value: "SOLE_PROP", label: "Sole Proprietorship" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "NONPROFIT", label: "Nonprofit" },
] as const;

export const IMMIGRATION_STATUSES = [
  { value: "CITIZEN", label: "US Citizen" },
  { value: "GREEN_CARD", label: "Green Card" },
  { value: "H1B", label: "H-1B Visa" },
  { value: "L1", label: "L-1 Visa" },
  { value: "F1", label: "F-1 Student" },
  { value: "O1", label: "O-1 Visa" },
  { value: "OTHER_VISA", label: "Other Visa" },
] as const;

// ==================== RELOCATION PHASES ====================

export const RELOCATION_PHASES = [
  { phase: 0, label: "Before the Move", shortLabel: "Pre-Move", daysOffset: -14, icon: "📦", color: "#6E7C92" },
  { phase: 1, label: "Move Week", shortLabel: "Move Week", daysOffset: 0, icon: "🚚", color: "#CBA45E" },
  { phase: 2, label: "First 10 Days", shortLabel: "Days 1-10", daysOffset: 10, icon: "⚡", color: "#E25C5C" },
  { phase: 3, label: "First 30 Days", shortLabel: "Days 11-30", daysOffset: 30, icon: "📋", color: "#CBA45E" },
  { phase: 4, label: "First 60 Days", shortLabel: "Days 31-60", daysOffset: 60, icon: "🔧", color: "#B0852F" },
  { phase: 5, label: "Settling In", shortLabel: "60+ Days", daysOffset: 90, icon: "🏠", color: "#54CB7E" },
] as const;

export function getCurrentRelocationPhase(daysSinceMove: number): number {
  if (daysSinceMove < -7) return 0;
  if (daysSinceMove <= 3) return 1;
  if (daysSinceMove <= 10) return 2;
  if (daysSinceMove <= 30) return 3;
  if (daysSinceMove <= 60) return 4;
  return 5;
}

// ==================== SERVICE PRIORITY MAP ====================

export interface ServicePriorityItem {
  id: string;
  category: string;
  title: string;
  description: string;
  phase: number;
  daysRelativeToMove: number;
  deadlineDays: number | null;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  isRequired: boolean;
  moveTypes: ("PERSONAL" | "BUSINESS" | "VACATION" | "MILITARY")[];
  conditions: string[];
  estimatedMinutes: number;
  icon: string;
  actionUrl?: string;
  tips?: string;
}

/**
 * Official USPS Mover's Guide (change-of-address) URL — IMMUTABLE, code-owned
 * single source of truth. Anti-phishing: the mail-forwarding link MUST always
 * point at the official USPS site; never build it from config/DB/query/template.
 */
export const USPS_MOVERS_GUIDE_URL = "https://moversguide.usps.com/";

export const SERVICE_PRIORITY_MAP: ServicePriorityItem[] = [
  // ── PHASE 0: Before the Move (2+ weeks before) ──
  {
    id: "P0_USPS", category: "GOVERNMENT_POSTAL", title: "USPS Mail Forwarding",
    description: "Forward your mail to your new address. Do this 2 weeks before moving.",
    phase: 0, daysRelativeToMove: -14, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL", "BUSINESS"], conditions: [],
    estimatedMinutes: 10, icon: "📬", actionUrl: USPS_MOVERS_GUIDE_URL,
    tips: "Finish on the official USPS site (usps.com), which charges a small one-time identity-verification fee — Move never collects it. Forward for 6–12 months, and notify important contacts separately.",
  },
  {
    id: "P0_SCHOOL_RECORDS", category: "KIDS_SCHOOL", title: "Request School Transfer Records",
    description: "Get official transcripts and records from your children's current school.",
    phase: 0, daysRelativeToMove: -14, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["hasChildren"],
    estimatedMinutes: 30, icon: "🏫",
    tips: "Request immunization records, IEP/504 plans if applicable, and report cards.",
  },
  {
    id: "P0_MEDICAL_RECORDS", category: "HEALTHCARE_DOCTORS", title: "Request Medical Records Transfer",
    description: "Get copies of medical records for all family members.",
    phase: 0, daysRelativeToMove: -14, deadlineDays: null, priority: "MEDIUM", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 20, icon: "🩺",
    tips: "Request prescription history, vaccination records, and specialist referrals.",
  },
  {
    id: "P0_STORAGE", category: "HOUSING_STORAGE", title: "Arrange Storage Unit",
    description: "Reserve a storage unit if you need temporary storage during the move.",
    phase: 0, daysRelativeToMove: -7, deadlineDays: null, priority: "MEDIUM", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["needsStorage"],
    estimatedMinutes: 30, icon: "📦",
  },
  {
    id: "P0_PET_VET", category: "HEALTHCARE_VET", title: "Get Pet Health Certificate",
    description: "Some states require a health certificate for pets. Visit your vet before moving.",
    phase: 0, daysRelativeToMove: -10, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["hasPets"],
    estimatedMinutes: 60, icon: "🐾",
    tips: "Certificate usually valid for 30 days. Check destination state requirements.",
  },

  // ── PHASE 1: Move Week (±3 days of move date) ──
  {
    id: "P1_ELECTRIC", category: "UTILITY_ELECTRIC", title: "Set Up Electric Service",
    description: "Activate electricity at your new address before move-in day.",
    phase: 1, daysRelativeToMove: -3, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 15, icon: "⚡",
    tips: "Schedule activation 3 days before move. Keep old service active until move-out.",
  },
  {
    id: "P1_WATER", category: "UTILITY_WATER", title: "Set Up Water Service",
    description: "Activate water at your new address.",
    phase: 1, daysRelativeToMove: -3, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 15, icon: "💧",
  },
  {
    id: "P1_GAS", category: "UTILITY_GAS", title: "Set Up Gas Service",
    description: "Activate natural gas if your new home uses it.",
    phase: 1, daysRelativeToMove: -3, deadlineDays: null, priority: "HIGH", isRequired: false,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 15, icon: "🔥",
    tips: "May require an in-person appointment for meter reading.",
  },
  {
    id: "P1_INTERNET", category: "UTILITY_INTERNET", title: "Schedule Internet Installation",
    description: "Set up internet service. Schedule 1-2 weeks in advance.",
    phase: 1, daysRelativeToMove: -7, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 20, icon: "🌐",
    tips: "Check availability at new address first. Self-install kits can be faster.",
  },
  {
    id: "P1_RENTERS_INSURANCE", category: "FINANCIAL_INSURANCE_HOME", title: "Update Home/Renters Insurance",
    description: "Update your policy with the new address or get a new policy.",
    phase: 1, daysRelativeToMove: -1, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 30, icon: "🏠",
    tips: "Coverage must be active from day 1. Moving is a qualifying event for changes.",
  },
  {
    id: "P1_OLD_UTILITIES", category: "UTILITY_ELECTRIC", title: "Cancel/Transfer Old Utilities",
    description: "Schedule disconnection of utilities at your old address.",
    phase: 1, daysRelativeToMove: 1, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 30, icon: "🔌",
  },

  // ── PHASE 2: First 10 Days (Federal & Banking) ──
  {
    id: "P2_IRS", category: "GOVERNMENT_TAX", title: "IRS Address Change (Form 8822)",
    description: "Notify the IRS of your new address to receive tax correspondence.",
    phase: 2, daysRelativeToMove: 3, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL", "BUSINESS"], conditions: [],
    estimatedMinutes: 15, icon: "🧾", actionUrl: "https://www.irs.gov/forms-pubs/about-form-8822",
    tips: "Can be done online via your IRS account or by mailing Form 8822.",
  },
  {
    id: "P2_USCIS", category: "GOVERNMENT_IMMIGRATION", title: "USCIS Address Change (AR-11)",
    description: "Federal law requires reporting address change within 10 DAYS.",
    phase: 2, daysRelativeToMove: 1, deadlineDays: 10, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["isImmigrant"],
    estimatedMinutes: 15, icon: "🌍", actionUrl: "https://www.uscis.gov/ar-11",
    tips: "MANDATORY within 10 days. Failure can affect immigration status. File online at USCIS.gov.",
  },
  {
    id: "P2_SSA", category: "GOVERNMENT_BENEFITS", title: "Social Security Address Update",
    description: "Update your address with the Social Security Administration.",
    phase: 2, daysRelativeToMove: 5, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 10, icon: "🏛️", actionUrl: "https://www.ssa.gov/myaccount/",
    tips: "Can be done online at ssa.gov or by calling 1-800-772-1213.",
  },
  {
    id: "P2_BANKS", category: "FINANCIAL_BANK", title: "Update All Bank Account Addresses",
    description: "Update your address on checking, savings, and investment accounts.",
    phase: 2, daysRelativeToMove: 3, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL", "BUSINESS"], conditions: [],
    estimatedMinutes: 20, icon: "🏦",
    tips: "Most banks allow address changes online or via mobile app.",
  },
  {
    id: "P2_CREDIT_CARDS", category: "FINANCIAL_CREDIT_CARD", title: "Update Credit Card Addresses",
    description: "Update billing addresses on all credit cards.",
    phase: 2, daysRelativeToMove: 3, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 15, icon: "💳",
    tips: "Update each card separately. Check auto-pay settings too.",
  },
  {
    id: "P2_MORTGAGE", category: "FINANCIAL_MORTGAGE", title: "Update Mortgage/Rent Payments",
    description: "Set up rent or mortgage payments for the new address.",
    phase: 2, daysRelativeToMove: 5, deadlineDays: null, priority: "HIGH", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 20, icon: "🔑",
  },
  {
    id: "P2_SELECTIVE_SERVICE", category: "GOVERNMENT_OTHER", title: "Selective Service Address Update",
    description: "Update your address with Selective Service if you are a male age 18-25.",
    phase: 2, daysRelativeToMove: 7, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 5, icon: "🏛️",
  },

  // ── PHASE 3: First 30 Days (State-specific, Legal) ──
  {
    id: "P3_DRIVERS_LICENSE", category: "GOVERNMENT_DMV", title: "Transfer Driver's License",
    description: "Get a new driver's license in your new state.",
    phase: 3, daysRelativeToMove: 14, deadlineDays: 90, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["carCount>0"],
    estimatedMinutes: 120, icon: "🪪",
    tips: "Deadline varies by state (10-90 days). Bring proof of identity, residency, and SSN.",
  },
  {
    id: "P3_VEHICLE_REG", category: "GOVERNMENT_DMV", title: "Transfer Vehicle Registration",
    description: "Register your vehicle(s) in the new state.",
    phase: 3, daysRelativeToMove: 21, deadlineDays: 60, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["carCount>0"],
    estimatedMinutes: 60, icon: "🚗",
    tips: "Usually done at DMV. Need current title, proof of insurance, and inspection (if required).",
  },
  {
    id: "P3_VEHICLE_INSPECTION", category: "TRANSPORTATION_AUTO", title: "Vehicle Safety Inspection",
    description: "Get vehicle inspected if required by your new state.",
    phase: 3, daysRelativeToMove: 21, deadlineDays: 30, priority: "HIGH", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: ["carCount>0"],
    estimatedMinutes: 60, icon: "🔧",
    tips: "Required in TX, NY, PA, VA, MO and others. Check your state's requirements.",
  },
  {
    id: "P3_AUTO_INSURANCE", category: "FINANCIAL_INSURANCE_AUTO", title: "Update Auto Insurance",
    description: "Update your auto insurance policy for the new state. Rates change by state.",
    phase: 3, daysRelativeToMove: 7, deadlineDays: 30, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["carCount>0"],
    estimatedMinutes: 30, icon: "🚗",
    tips: "Rates vary significantly by state. Shop around for better rates.",
  },
  {
    id: "P3_HEALTH_INSURANCE", category: "FINANCIAL_INSURANCE_HEALTH", title: "Update Health Insurance",
    description: "Moving is a qualifying life event. You have 60 days to enroll/change plans.",
    phase: 3, daysRelativeToMove: 7, deadlineDays: 60, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 45, icon: "🏥",
    tips: "60-DAY WINDOW from move date. Check Healthcare.gov or your employer's plan.",
  },
  {
    id: "P3_VOTER", category: "GOVERNMENT_VOTER", title: "Register to Vote",
    description: "Register to vote in your new state/county.",
    phase: 3, daysRelativeToMove: 14, deadlineDays: null, priority: "MEDIUM", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 10, icon: "🗳️", actionUrl: "https://vote.gov",
    tips: "Register online at vote.gov. Deadlines vary by state before elections.",
  },
  {
    id: "P3_MOTORCYCLE_REG", category: "GOVERNMENT_DMV", title: "Transfer Motorcycle Registration",
    description: "Register your motorcycle in the new state.",
    phase: 3, daysRelativeToMove: 21, deadlineDays: 60, priority: "MEDIUM", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["hasMotorcycle"],
    estimatedMinutes: 60, icon: "🏍️",
  },
  {
    id: "P3_BOAT_REG", category: "GOVERNMENT_DMV", title: "Transfer Boat/RV Registration",
    description: "Register your boat or RV in the new state.",
    phase: 3, daysRelativeToMove: 30, deadlineDays: 60, priority: "MEDIUM", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["hasBoatRV"],
    estimatedMinutes: 60, icon: "⛵",
  },
  {
    id: "P3_PET_LICENSE", category: "HEALTHCARE_VET", title: "New Pet License/Registration",
    description: "Register your pet with the new city/county if required.",
    phase: 3, daysRelativeToMove: 21, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: ["hasPets"],
    estimatedMinutes: 15, icon: "🐾",
  },

  // ── PHASE 4: First 60 Days (Important but less urgent) ──
  {
    id: "P4_TOLL_PASS", category: "TRANSPORTATION_TOLL", title: "Transfer/Get Toll Pass",
    description: "Set up EZ-Pass, SunPass, TxTag, or your region's toll system.",
    phase: 4, daysRelativeToMove: 30, deadlineDays: null, priority: "MEDIUM", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: ["carCount>0"],
    estimatedMinutes: 15, icon: "🛣️",
  },
  {
    id: "P4_VET", category: "HEALTHCARE_VET", title: "Find New Veterinarian",
    description: "Find a new vet and transfer your pet's medical records.",
    phase: 4, daysRelativeToMove: 30, deadlineDays: null, priority: "MEDIUM", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["hasPets"],
    estimatedMinutes: 30, icon: "🐾",
  },
  {
    id: "P4_PHARMACY", category: "HEALTHCARE_PHARMACY", title: "Transfer Prescriptions",
    description: "Transfer your prescriptions to a new pharmacy.",
    phase: 4, daysRelativeToMove: 14, deadlineDays: null, priority: "HIGH", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 15, icon: "💊",
    tips: "Most pharmacies can transfer electronically. Call your new pharmacy.",
  },
  {
    id: "P4_DOCTOR", category: "HEALTHCARE_DOCTORS", title: "Find New Primary Care Doctor",
    description: "Find a new PCP in your area and schedule an initial visit.",
    phase: 4, daysRelativeToMove: 30, deadlineDays: null, priority: "MEDIUM", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 30, icon: "🩺",
  },
  {
    id: "P4_DENTIST", category: "HEALTHCARE_DENTIST", title: "Find New Dentist",
    description: "Find a new dentist and transfer dental records.",
    phase: 4, daysRelativeToMove: 45, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 20, icon: "🦷",
  },
  {
    id: "P4_SCHOOL_ENROLL", category: "KIDS_SCHOOL", title: "Enroll Children in New School",
    description: "Complete enrollment for your children at their new school.",
    phase: 4, daysRelativeToMove: 7, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["hasChildren"],
    estimatedMinutes: 120, icon: "🏫",
    tips: "Bring birth certificates, immunization records, transcripts, and proof of residency.",
  },
  {
    id: "P4_DAYCARE", category: "KIDS_DAYCARE", title: "Find Daycare/Childcare",
    description: "Research and enroll in daycare or after-school programs.",
    phase: 4, daysRelativeToMove: 14, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["hasChildren"],
    estimatedMinutes: 60, icon: "👶",
    tips: "Waitlists can be long. Start researching before you move.",
  },
  {
    id: "P4_GYM", category: "FITNESS_GYM", title: "Find New Gym/Fitness",
    description: "Cancel old gym membership and find a new one.",
    phase: 4, daysRelativeToMove: 30, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 15, icon: "💪",
  },
  {
    id: "P4_SUBSCRIPTIONS", category: "SHOPPING_SUBSCRIPTION", title: "Update Subscription Addresses",
    description: "Update addresses on Amazon, streaming services, delivery subscriptions, etc.",
    phase: 4, daysRelativeToMove: 14, deadlineDays: null, priority: "MEDIUM", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 20, icon: "📦",
  },
  {
    id: "P4_LIFE_INSURANCE", category: "FINANCIAL_INSURANCE_LIFE", title: "Update Life Insurance",
    description: "Update your address with your life insurance provider.",
    phase: 4, daysRelativeToMove: 30, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: [],
    estimatedMinutes: 10, icon: "🛡️",
  },
  {
    id: "P4_PET_INSURANCE", category: "FINANCIAL_INSURANCE_PET", title: "Update Pet Insurance",
    description: "Update your address with your pet insurance provider.",
    phase: 4, daysRelativeToMove: 30, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL"], conditions: ["hasPets"],
    estimatedMinutes: 10, icon: "🐾",
  },
  {
    id: "P4_SENIOR_CARE", category: "HEALTHCARE_SENIOR", title: "Find Senior Care Services",
    description: "Research senior care, assisted living, or home health services in your new area.",
    phase: 4, daysRelativeToMove: 14, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["PERSONAL"], conditions: ["hasSenior"],
    estimatedMinutes: 60, icon: "👴",
  },

  // ── PHASE 5: Settling In (60+ days) ──
  {
    id: "P5_HOA", category: "HOUSING_HOA", title: "Register with HOA",
    description: "Contact your HOA, get rules/CC&Rs, set up dues payment.",
    phase: 5, daysRelativeToMove: 7, deadlineDays: null, priority: "MEDIUM", isRequired: false,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 30, icon: "🏢",
  },
  {
    id: "P5_LAWN", category: "HOUSING_LAWN_CARE", title: "Set Up Lawn Care",
    description: "Find a lawn care service or set up your own equipment.",
    phase: 5, daysRelativeToMove: 30, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 20, icon: "🌿",
  },
  {
    id: "P5_PEST", category: "HOUSING_PEST_CONTROL", title: "Set Up Pest Control",
    description: "Schedule pest control service, especially in warmer climates.",
    phase: 5, daysRelativeToMove: 30, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 15, icon: "🐛",
  },
  {
    id: "P5_FLOOD_INSURANCE", category: "FINANCIAL_INSURANCE_FLOOD", title: "Evaluate Flood Insurance",
    description: "Check if your new home is in a flood zone and get coverage.",
    phase: 5, daysRelativeToMove: 14, deadlineDays: null, priority: "MEDIUM", isRequired: false,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 30, icon: "🌊",
    tips: "Check FEMA flood maps. Required for federally-backed mortgages in flood zones.",
  },
  {
    id: "P5_HOME_SERVICES", category: "HOUSING_HOME_SERVICE", title: "Find Local Home Services",
    description: "Find a trusted plumber, electrician, and handyman in your area.",
    phase: 5, daysRelativeToMove: 60, deadlineDays: null, priority: "LOW", isRequired: false,
    moveTypes: ["PERSONAL", "VACATION"], conditions: [],
    estimatedMinutes: 30, icon: "🔧",
  },

  // ── BUSINESS-SPECIFIC ITEMS ──
  {
    id: "B0_STATE_REG", category: "GOVERNMENT_OTHER", title: "Register Business in New State",
    description: "File with the Secretary of State to register your business entity.",
    phase: 2, daysRelativeToMove: 3, deadlineDays: 30, priority: "URGENT", isRequired: true,
    moveTypes: ["BUSINESS"], conditions: ["isBusinessOwner"],
    estimatedMinutes: 60, icon: "🏛️",
    tips: "May need a registered agent in the new state. Check LLC/Corp requirements.",
  },
  {
    id: "B0_BIZ_LICENSE", category: "GOVERNMENT_OTHER", title: "Apply for Business License",
    description: "Get local business license/permit in the new city or county.",
    phase: 2, daysRelativeToMove: 7, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["BUSINESS"], conditions: ["isBusinessOwner"],
    estimatedMinutes: 45, icon: "📋",
  },
  {
    id: "B1_STATE_TAX", category: "GOVERNMENT_TAX", title: "State Tax Registration",
    description: "Register for state taxes (income, sales, franchise) in the new state.",
    phase: 3, daysRelativeToMove: 14, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["BUSINESS"], conditions: ["isBusinessOwner"],
    estimatedMinutes: 45, icon: "🧾",
  },
  {
    id: "B1_WORKERS_COMP", category: "FINANCIAL_INSURANCE_HOME", title: "Workers Compensation Insurance",
    description: "Update or get new workers comp insurance for the new state.",
    phase: 3, daysRelativeToMove: 14, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["BUSINESS"], conditions: ["isBusinessOwner"],
    estimatedMinutes: 30, icon: "🛡️",
  },
  {
    id: "B2_BIZ_BANK", category: "FINANCIAL_BANK", title: "Update Business Bank Accounts",
    description: "Update address on all business bank and payment accounts.",
    phase: 2, daysRelativeToMove: 5, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["BUSINESS"], conditions: ["isBusinessOwner"],
    estimatedMinutes: 20, icon: "🏦",
  },
  {
    id: "B2_COMMERCIAL_INSURANCE", category: "FINANCIAL_INSURANCE_HOME", title: "Update Commercial Insurance",
    description: "Update business liability, property, and professional insurance.",
    phase: 3, daysRelativeToMove: 7, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["BUSINESS"], conditions: ["isBusinessOwner"],
    estimatedMinutes: 45, icon: "🛡️",
  },

  // ── VACATION HOME ITEMS ──
  {
    id: "V0_HOME_INSURANCE", category: "FINANCIAL_INSURANCE_HOME", title: "Second Home Insurance",
    description: "Get homeowners insurance for your vacation property.",
    phase: 1, daysRelativeToMove: -7, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["VACATION"], conditions: [],
    estimatedMinutes: 30, icon: "🏠",
  },
  {
    id: "V1_SECURITY", category: "HOUSING_HOME_SERVICE", title: "Set Up Security System",
    description: "Install alarm/security system for when you're away.",
    phase: 1, daysRelativeToMove: 3, deadlineDays: null, priority: "HIGH", isRequired: false,
    moveTypes: ["VACATION"], conditions: [],
    estimatedMinutes: 60, icon: "🔒",
  },
  {
    id: "V1_PROPERTY_MGMT", category: "HOUSING_HOME_SERVICE", title: "Hire Property Management",
    description: "Find a property manager for when you're not there.",
    phase: 4, daysRelativeToMove: 30, deadlineDays: null, priority: "MEDIUM", isRequired: false,
    moveTypes: ["VACATION"], conditions: [],
    estimatedMinutes: 60, icon: "🏡",
  },

  // ── MILITARY / PCS-SPECIFIC ITEMS ──
  // These supplement (do NOT replace) the standard PERSONAL relocation tasks:
  // a PCS mover still gets USPS forwarding, DMV transfer, school enrollment, etc.
  // (the checklist folds MILITARY into PERSONAL for those). The items below add
  // the PCS-only obligations a civilian move never has.
  {
    id: "M0_PCS_ORDERS", category: "GOVERNMENT_OTHER", title: "Review PCS Orders & Entitlements",
    description: "Read your PCS orders carefully and confirm authorized travel, dependents, and HHG (household goods) weight allowance.",
    phase: 0, daysRelativeToMove: -21, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["MILITARY"], conditions: [],
    estimatedMinutes: 30, icon: "🎖️",
    tips: "Your weight allowance and entitlements depend on rank and dependent status. Errors here cost money out of pocket.",
  },
  {
    id: "M0_DITY_PPM", category: "GOVERNMENT_OTHER", title: "Decide PPM/DITY vs. Government Move",
    description: "Choose between a government-arranged HHG move or a Personally Procured Move (PPM/DITY) for reimbursement.",
    phase: 0, daysRelativeToMove: -21, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["MILITARY"], conditions: [],
    estimatedMinutes: 45, icon: "🚛",
    tips: "PPM/DITY can reimburse up to 100% of the government's cost. Keep every weight ticket and receipt.",
  },
  {
    id: "M0_TMO_SCHEDULE", category: "GOVERNMENT_OTHER", title: "Schedule Move with TMO/Transportation Office",
    description: "Contact your installation Transportation Management Office (TMO) to schedule HHG pickup and delivery via move.mil.",
    phase: 0, daysRelativeToMove: -14, deadlineDays: null, priority: "URGENT", isRequired: true,
    moveTypes: ["MILITARY"], conditions: [],
    estimatedMinutes: 30, icon: "🪖", actionUrl: "https://www.militaryonesource.mil/moving-pcs/",
    tips: "Book early — peak PCS season (May–Aug) fills fast. Start at the Defense Personal Property System (DPS).",
  },
  {
    id: "M2_DEERS_UPDATE", category: "GOVERNMENT_BENEFITS", title: "Update DEERS / Address with Military",
    description: "Update your address in DEERS and with your branch so pay, TRICARE, and records follow you.",
    phase: 2, daysRelativeToMove: 3, deadlineDays: null, priority: "HIGH", isRequired: true,
    moveTypes: ["MILITARY"], conditions: [],
    estimatedMinutes: 20, icon: "🪪", actionUrl: "https://milconnect.dmdc.osd.mil",
    tips: "Outdated DEERS info can interrupt TRICARE coverage and BAH payments.",
  },
  {
    id: "M3_TRICARE_TRANSFER", category: "FINANCIAL_INSURANCE_HEALTH", title: "Transfer TRICARE Region/Plan",
    description: "Update your TRICARE region and primary care manager for the new duty station within the move window.",
    phase: 3, daysRelativeToMove: 7, deadlineDays: 60, priority: "URGENT", isRequired: true,
    moveTypes: ["MILITARY"], conditions: [],
    estimatedMinutes: 30, icon: "🏥", actionUrl: "https://www.tricare.mil/moving",
    tips: "Moving to a new TRICARE region may require re-enrolling and selecting a new PCM. Don't let coverage lapse.",
  },
  {
    id: "M3_DL_MIL_EXEMPT", category: "GOVERNMENT_DMV", title: "Confirm Military License/Registration Rules",
    description: "Many states let active-duty members keep their home-of-record license/registration. Confirm the destination state's military exemption.",
    phase: 3, daysRelativeToMove: 14, deadlineDays: 90, priority: "MEDIUM", isRequired: false,
    moveTypes: ["MILITARY"], conditions: ["carCount>0"],
    estimatedMinutes: 20, icon: "🚗",
    tips: "Under the SCRA/MSRRA you often aren't forced to retitle/register in the new state. Verify before paying fees.",
  },
];

// ==================== STATE-SPECIFIC DEADLINE OVERRIDES ====================

export const STATE_DMV_DEADLINES: Record<string, { licenseDays: number; registrationDays: number; inspectionRequired: boolean; hasStateTax: boolean }> = {
  AL: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  AK: { licenseDays: 90, registrationDays: 10, inspectionRequired: false, hasStateTax: false },
  AZ: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  AR: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  CA: { licenseDays: 10, registrationDays: 20, inspectionRequired: true, hasStateTax: true },
  CO: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  CT: { licenseDays: 30, registrationDays: 60, inspectionRequired: false, hasStateTax: true },
  DE: { licenseDays: 60, registrationDays: 60, inspectionRequired: true, hasStateTax: true },
  FL: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: false },
  GA: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  HI: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  ID: { licenseDays: 90, registrationDays: 90, inspectionRequired: false, hasStateTax: true },
  IL: { licenseDays: 90, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  IN: { licenseDays: 60, registrationDays: 60, inspectionRequired: false, hasStateTax: true },
  IA: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  KS: { licenseDays: 90, registrationDays: 90, inspectionRequired: false, hasStateTax: true },
  KY: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  LA: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  ME: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  MD: { licenseDays: 60, registrationDays: 60, inspectionRequired: true, hasStateTax: true },
  MA: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  MI: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  MN: { licenseDays: 60, registrationDays: 60, inspectionRequired: false, hasStateTax: true },
  MS: { licenseDays: 60, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  MO: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  MT: { licenseDays: 90, registrationDays: 90, inspectionRequired: false, hasStateTax: false },
  NE: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  NV: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: false },
  NH: { licenseDays: 60, registrationDays: 60, inspectionRequired: true, hasStateTax: false },
  NJ: { licenseDays: 60, registrationDays: 60, inspectionRequired: true, hasStateTax: true },
  NM: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  NY: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  NC: { licenseDays: 60, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  ND: { licenseDays: 60, registrationDays: 60, inspectionRequired: false, hasStateTax: true },
  OH: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  OK: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  OR: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: true },
  PA: { licenseDays: 60, registrationDays: 20, inspectionRequired: true, hasStateTax: true },
  RI: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  SC: { licenseDays: 90, registrationDays: 45, inspectionRequired: false, hasStateTax: true },
  SD: { licenseDays: 90, registrationDays: 90, inspectionRequired: false, hasStateTax: false },
  TN: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: false },
  TX: { licenseDays: 90, registrationDays: 30, inspectionRequired: true, hasStateTax: false },
  UT: { licenseDays: 60, registrationDays: 60, inspectionRequired: true, hasStateTax: true },
  VT: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  VA: { licenseDays: 60, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  WA: { licenseDays: 30, registrationDays: 30, inspectionRequired: false, hasStateTax: false },
  WV: { licenseDays: 30, registrationDays: 30, inspectionRequired: true, hasStateTax: true },
  WI: { licenseDays: 60, registrationDays: 60, inspectionRequired: false, hasStateTax: true },
  WY: { licenseDays: 90, registrationDays: 90, inspectionRequired: false, hasStateTax: false },
};

// ==================== THEME COLORS ====================

export const COLORS = {
  primary: "#CBA45E",
  primaryLight: "#DCBC7C",
  primaryDark: "#B0852F",
  accent: "#CBA45E",
  success: "#54CB7E",
  warning: "#E0A85A",
  error: "#E25C5C",
  info: "#37C2C9",
  surface: "#070B14",
  surfaceElevated: "#18233A",
  surfaceCard: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.1)",
  borderFocus: "rgba(203, 164, 94, 0.55)",
  textPrimary: "#EFF3FA",
  textSecondary: "rgba(239, 243, 250, 0.66)",
  textTertiary: "rgba(239, 243, 250, 0.43)",
  textMuted: "rgba(239, 243, 250, 0.30)",
} as const;
