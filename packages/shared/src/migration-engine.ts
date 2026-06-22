/**
 * Migration Engine
 *
 * Analyzes a user's existing services at their "from" address and determines
 * what needs to happen at the "to" address:
 *   - KEEP:     Federal provider, no change needed (e.g., Chase, Geico)
 *   - TRANSFER: Same provider appears listed for the destination state
 *   - SWITCH:   Provider not in destination state → recommend alternative
 *   - NEW:      Essential service the user doesn't have yet
 *   - CANCEL:   Service only relevant to origin (e.g., NYC MetroCard)
 */

import { SERVICE_PRIORITY_MAP, type ServicePriorityItem } from "./constants";
import type { UserChecklistProfile, TaskTemplate } from "./relocation-checklist";

// ── Types ──

export type MigrationAction = "TRANSFER" | "SWITCH" | "NEW" | "CANCEL" | "KEEP";

export interface ServiceWithProvider {
  id: string;
  category: string;
  providerName: string;
  providerId?: string | null;
  isActive: boolean;
  monthlyCost?: number | null;
  migrationAction?: MigrationAction | null;
  provider?: {
    id: string;
    name: string;
    slug?: string | null;
    scope: string;
    states: string[];
    category: string;
  } | null;
}

export interface ProviderForMigration {
  id: string;
  name: string;
  slug: string;
  category: string;
  scope: string;
  states: string[];
  popularityScore: number;
}

export interface MigrationItem {
  category: string;
  categoryLabel: string;
  currentService?: {
    id: string;
    providerName: string;
    providerId?: string | null;
    monthlyCost?: number | null;
    migrationAction?: MigrationAction | null;
  };
  recommendedProvider?: {
    id: string;
    name: string;
    slug: string;
    reason: string;
  };
  action: MigrationAction;
  urgency: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  phase: number;
  note: string;
  icon: string;
}

export interface MigrationAnalysis {
  fromState: string;
  toState: string;
  keeps: MigrationItem[];
  transfers: MigrationItem[];
  switches: MigrationItem[];
  newNeeded: MigrationItem[];
  cancels: MigrationItem[];
  summary: {
    total: number;
    keeps: number;
    transfers: number;
    switches: number;
    newNeeded: number;
    cancels: number;
  };
}

// ── Category labels ──

const CATEGORY_LABELS: Record<string, string> = {
  GOVERNMENT_POSTAL: "Mail & Postal", GOVERNMENT_TAX: "Tax (IRS)", GOVERNMENT_DMV: "DMV",
  GOVERNMENT_BENEFITS: "Benefits", GOVERNMENT_VOTER: "Voter Registration",
  GOVERNMENT_IMMIGRATION: "Immigration", GOVERNMENT_OTHER: "Government",
  UTILITY_ELECTRIC: "Electric", UTILITY_GAS: "Gas", UTILITY_WATER: "Water",
  UTILITY_INTERNET: "Internet", UTILITY_PHONE: "Phone", UTILITY_CABLE: "Cable/TV",
  UTILITY_TRASH: "Trash", UTILITY_SEWER: "Sewer",
  FINANCIAL_BANK: "Bank", FINANCIAL_CREDIT_CARD: "Credit Cards",
  FINANCIAL_INSURANCE_AUTO: "Auto Insurance", FINANCIAL_INSURANCE_HOME: "Home Insurance",
  FINANCIAL_INSURANCE_HEALTH: "Health Insurance", FINANCIAL_MORTGAGE: "Mortgage",
  FINANCIAL_INSURANCE_LIFE: "Life Insurance", FINANCIAL_INSURANCE_PET: "Pet Insurance",
  FINANCIAL_INSURANCE_FLOOD: "Flood Insurance",
  HOUSING_STORAGE: "Storage", HOUSING_HOA: "HOA", HOUSING_HOME_SERVICE: "Home Services",
  HOUSING_LAWN_CARE: "Lawn Care", HOUSING_PEST_CONTROL: "Pest Control",
  HEALTHCARE_DOCTORS: "Doctors", HEALTHCARE_DENTIST: "Dentist",
  HEALTHCARE_PHARMACY: "Pharmacy", HEALTHCARE_VET: "Veterinary",
  HEALTHCARE_SENIOR: "Senior Care",
  TRANSPORTATION_TOLL: "Toll Pass", TRANSPORTATION_TRANSIT: "Transit",
  KIDS_SCHOOL: "School", KIDS_DAYCARE: "Daycare",
  FITNESS_GYM: "Gym", SHOPPING_SUBSCRIPTION: "Subscriptions",
};

const CATEGORY_ICONS: Record<string, string> = {
  UTILITY_ELECTRIC: "⚡", UTILITY_GAS: "🔥", UTILITY_WATER: "💧",
  UTILITY_INTERNET: "🌐", UTILITY_PHONE: "📱", UTILITY_CABLE: "📺",
  UTILITY_TRASH: "🗑️", UTILITY_SEWER: "🚰",
  GOVERNMENT_POSTAL: "📬", GOVERNMENT_TAX: "🧾", GOVERNMENT_DMV: "🪪",
  GOVERNMENT_BENEFITS: "🏛️", GOVERNMENT_VOTER: "🗳️", GOVERNMENT_IMMIGRATION: "🌍",
  FINANCIAL_BANK: "🏦", FINANCIAL_CREDIT_CARD: "💳",
  FINANCIAL_INSURANCE_AUTO: "🚗", FINANCIAL_INSURANCE_HOME: "🏠",
  FINANCIAL_INSURANCE_HEALTH: "🏥", FINANCIAL_MORTGAGE: "🔑",
  FINANCIAL_INSURANCE_LIFE: "🛡️", FINANCIAL_INSURANCE_PET: "🐾",
  HEALTHCARE_DOCTORS: "🩺", HEALTHCARE_DENTIST: "🦷", HEALTHCARE_PHARMACY: "💊",
  HEALTHCARE_VET: "🐾", HEALTHCARE_SENIOR: "👴",
  TRANSPORTATION_TOLL: "🛣️", TRANSPORTATION_TRANSIT: "🚌",
  HOUSING_STORAGE: "📦", HOUSING_HOA: "🏢", HOUSING_HOME_SERVICE: "🔧",
  KIDS_SCHOOL: "🏫", KIDS_DAYCARE: "👶", FITNESS_GYM: "💪",
};

// Categories that are inherently location-specific (cancel when moving away)
const LOCAL_ONLY_CATEGORIES = new Set([
  "TRANSPORTATION_TRANSIT",
  "TRANSPORTATION_PARKING",
  "HOUSING_HOA",
]);

// Categories where the provider typically operates federally / nationwide
const TYPICALLY_FEDERAL_CATEGORIES = new Set([
  "GOVERNMENT_POSTAL",
  "GOVERNMENT_TAX",
  "GOVERNMENT_BENEFITS",
  "GOVERNMENT_IMMIGRATION",
  "FINANCIAL_BANK",
  "FINANCIAL_CREDIT_CARD",
  "FINANCIAL_INSURANCE_LIFE",
  "SHOPPING_SUBSCRIPTION",
]);

// ── Core logic ──

function evaluateCondition(condition: string, profile: UserChecklistProfile): boolean {
  switch (condition) {
    case "hasChildren": return profile.hasChildren;
    case "hasPets": return profile.hasPets;
    case "hasSenior": return profile.hasSenior;
    case "hasDisability": return profile.hasDisability;
    case "needsStorage": return profile.needsStorage;
    case "hasMotorcycle": return profile.hasMotorcycle;
    case "hasBoatRV": return profile.hasBoatRV;
    case "isImmigrant": return profile.isImmigrant;
    case "isBusinessOwner": return profile.isBusinessOwner;
    case "carCount>0": return profile.carCount > 0;
    default: return true;
  }
}

// US state names + abbreviations used to detect mislabeled provider rows.
// We use this to demote provider candidates whose display name embeds a
// state token that does not match the destination state (e.g. data drift
// in the catalog where "Spectrum Maine" was tagged with CA coverage). A
// candidate that wins solely on popularity but obviously refers to the
// wrong state would still be misleading to recommend.
const US_STATE_NAMES_BY_CODE: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

export function providerNameMentionsOtherState(name: string, toState: string): boolean {
  return detectStateMismatchInName(name, toState);
}

function detectStateMismatchInName(name: string, toState: string): boolean {
  if (!name) return false;
  const normalized = ` ${name.toLowerCase()} `;
  const targetCode = toState.toUpperCase();
  const targetName = (US_STATE_NAMES_BY_CODE[targetCode] || "").toLowerCase();
  for (const [code, fullName] of Object.entries(US_STATE_NAMES_BY_CODE)) {
    if (code === targetCode) continue;
    const lower = fullName.toLowerCase();
    // Skip the destination's own name (already handled above).
    if (lower === targetName) continue;
    // Whole-word match on the full state name. We deliberately do NOT
    // match the bare 2-letter code because plenty of brand names contain
    // those letters by coincidence (e.g. "GA" inside "Vanguard").
    if (normalized.includes(` ${lower} `) || normalized.endsWith(` ${lower} `)) {
      return true;
    }
  }
  return false;
}

function findBestProvider(
  category: string,
  toState: string,
  availableProviders: ProviderForMigration[],
): ProviderForMigration | null {
  const candidates = availableProviders.filter((p) => {
    if (p.category !== category) return false;
    if (p.scope === "FEDERAL") return true;
    if (!p.states.includes(toState)) return false;
    // Catalog hygiene: if the provider name embeds a wrong-state token
    // (e.g. "Spectrum Maine" marked as available in CA), it's almost
    // certainly bad data — exclude it from recommendations so we don't
    // present "Spectrum Maine" for a California move.
    if (detectStateMismatchInName(p.name, toState)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Sort by: state-specific first, then by popularity score
  candidates.sort((a, b) => {
    const aLocal = a.scope === "STATE" && a.states.includes(toState) ? 1 : 0;
    const bLocal = b.scope === "STATE" && b.states.includes(toState) ? 1 : 0;
    if (bLocal !== aLocal) return bLocal - aLocal;
    return (b.popularityScore || 0) - (a.popularityScore || 0);
  });

  return candidates[0];
}

/**
 * Analyze migration needs given the user's existing services and available providers.
 */
export function analyzeMigration(
  existingServices: ServiceWithProvider[],
  fromState: string,
  toState: string,
  availableProviders: ProviderForMigration[],
  profile: UserChecklistProfile,
): MigrationAnalysis {
  const keeps: MigrationItem[] = [];
  const transfers: MigrationItem[] = [];
  const switches: MigrationItem[] = [];
  const cancels: MigrationItem[] = [];
  const newNeeded: MigrationItem[] = [];

  const activeServices = existingServices.filter((s) => s.isActive);
  const coveredCategories = new Set(activeServices.map((s) => s.category));

  // ── Step 1: Analyze existing services ──
  for (const svc of activeServices) {
    const categoryLabel = CATEGORY_LABELS[svc.category] || svc.category;
    const icon = CATEGORY_ICONS[svc.category] || "📋";

    const baseItem = {
      category: svc.category,
      categoryLabel,
      icon,
      currentService: {
        id: svc.id,
        providerName: svc.providerName,
        providerId: svc.providerId,
        monthlyCost: svc.monthlyCost,
        migrationAction: svc.migrationAction ?? null,
      },
    };

    // Local-only services → CANCEL
    if (LOCAL_ONLY_CATEGORIES.has(svc.category)) {
      cancels.push({
        ...baseItem,
        action: "CANCEL",
        urgency: "LOW",
        phase: 1,
        note: `${svc.providerName} is specific to ${fromState}. Cancel before moving.`,
      });
      continue;
    }

    const providerScope = svc.provider?.scope;
    // Explicit provider scope wins over category heuristics. A regional bank
    // or insurer should not be kept just because its category is often national.
    if (providerScope === "STATE" && svc.provider) {
      const providerStates = svc.provider.states || [];
      if (providerStates.includes(toState)) {
        // Same provider is listed in the new state -> possible transfer.
        transfers.push({
          ...baseItem,
          action: "TRANSFER",
          urgency: "MEDIUM",
          phase: 1,
          note: `${svc.providerName} is listed in ${toState}. Confirm address-level availability and transfer options with the provider.`,
        });
      } else {
        // Provider not in new state → SWITCH
        const recommended = findBestProvider(svc.category, toState, availableProviders);
        switches.push({
          ...baseItem,
          action: "SWITCH",
          urgency: "HIGH",
          phase: 1,
          note: `${svc.providerName} is not available in ${toState}.${recommended ? ` Switch to ${recommended.name}.` : " Find a new provider."}`,
          recommendedProvider: recommended
            ? { id: recommended.id, name: recommended.name, slug: recommended.slug, reason: `Top-rated ${categoryLabel} in ${toState}` }
            : undefined,
        });
      }
      continue;
    }

    // Federal / nationwide providers → KEEP. Category-level federal fallback is
    // only used when the provider scope is unknown.
    if (providerScope === "FEDERAL" || (!providerScope && TYPICALLY_FEDERAL_CATEGORIES.has(svc.category))) {
      keeps.push({
        ...baseItem,
        action: "KEEP",
        urgency: "LOW",
        phase: 2,
        note: `${svc.providerName} is listed nationally. Confirm account address requirements with the provider.`,
      });
      continue;
    }

    // Unknown scope or no provider linked → check if provider name matches any available
    const matchingProvider = availableProviders.find(
      (p) => p.name.toLowerCase() === svc.providerName.toLowerCase() && p.category === svc.category,
    );

    if (matchingProvider) {
      if (matchingProvider.scope === "FEDERAL") {
        keeps.push({ ...baseItem, action: "KEEP", urgency: "LOW", phase: 2, note: `${svc.providerName} is listed nationally. Confirm account address requirements with the provider.` });
      } else if (matchingProvider.states.includes(toState)) {
        transfers.push({ ...baseItem, action: "TRANSFER", urgency: "MEDIUM", phase: 1, note: `${svc.providerName} is listed in ${toState}. Confirm address-level availability and transfer options with the provider.` });
      } else {
        const recommended = findBestProvider(svc.category, toState, availableProviders);
        switches.push({
          ...baseItem,
          action: "SWITCH",
          urgency: "HIGH",
          phase: 1,
          note: `${svc.providerName} is not available in ${toState}.${recommended ? ` Switch to ${recommended.name}.` : ""}`,
          recommendedProvider: recommended
            ? { id: recommended.id, name: recommended.name, slug: recommended.slug, reason: `Top-rated ${categoryLabel} in ${toState}` }
            : undefined,
        });
      }
    } else {
      // Can't determine → default to KEEP with address update reminder
      keeps.push({ ...baseItem, action: "KEEP", urgency: "LOW", phase: 2, note: `Record an address-update task for ${svc.providerName} and confirm requirements with the provider.` });
    }
  }

  // ── Step 2: Find missing essential services (NEW) ──
  for (const item of SERVICE_PRIORITY_MAP) {
    // Only suggest essentials
    if (!item.isRequired) continue;
    // Skip if user already has this category covered
    if (coveredCategories.has(item.category)) continue;
    // Check profile conditions
    const effectiveMoveType = profile.moveType === "MILITARY" ? "PERSONAL" : profile.moveType;
    if (!item.moveTypes.includes(effectiveMoveType)) continue;
    let conditionsMet = true;
    for (const cond of item.conditions) {
      if (!evaluateCondition(cond, profile)) { conditionsMet = false; break; }
    }
    if (!conditionsMet) continue;
    // Skip government services that don't need a "provider"
    if (item.category.startsWith("GOVERNMENT_") && item.category !== "GOVERNMENT_DMV") continue;

    const recommended = findBestProvider(item.category, toState, availableProviders);
    const categoryLabel = CATEGORY_LABELS[item.category] || item.category;
    const icon = CATEGORY_ICONS[item.category] || item.icon;

    newNeeded.push({
      category: item.category,
      categoryLabel,
      icon,
      action: "NEW",
      urgency: item.priority as "URGENT" | "HIGH" | "MEDIUM" | "LOW",
      phase: item.phase,
      note: `You need ${categoryLabel} in ${toState}.${recommended ? ` Recommended: ${recommended.name}.` : ""}`,
      recommendedProvider: recommended
        ? { id: recommended.id, name: recommended.name, slug: recommended.slug, reason: `Top provider for ${categoryLabel} in ${toState}` }
        : undefined,
    });
  }

  // Deduplicate newNeeded by category
  const seenNewCategories = new Set<string>();
  const deduplicatedNew = newNeeded.filter((item) => {
    if (seenNewCategories.has(item.category)) return false;
    seenNewCategories.add(item.category);
    return true;
  });

  const total = keeps.length + transfers.length + switches.length + deduplicatedNew.length + cancels.length;

  return {
    fromState,
    toState,
    keeps,
    transfers,
    switches,
    newNeeded: deduplicatedNew,
    cancels,
    summary: {
      total,
      keeps: keeps.length,
      transfers: transfers.length,
      switches: switches.length,
      newNeeded: deduplicatedNew.length,
      cancels: cancels.length,
    },
  };
}

/**
 * Generate a compact summary string for the AI assistant.
 */
export function getMigrationContextForAI(analysis: MigrationAnalysis): string {
  const parts: string[] = [];
  parts.push(`Migration ${analysis.fromState} → ${analysis.toState}:`);
  parts.push(`${analysis.summary.keeps} KEEP, ${analysis.summary.transfers} TRANSFER, ${analysis.summary.switches} SWITCH, ${analysis.summary.newNeeded} NEW, ${analysis.summary.cancels} CANCEL.`);

  if (analysis.switches.length > 0) {
    parts.push(
      "Need to switch: " +
      analysis.switches.map((s) => {
        const rec = s.recommendedProvider ? ` → ${s.recommendedProvider.name}` : "";
        return `${s.currentService?.providerName}${rec} (${s.categoryLabel})`;
      }).join(", ") + "."
    );
  }

  if (analysis.newNeeded.length > 0) {
    parts.push(
      "Need new: " +
      analysis.newNeeded.map((n) => {
        const rec = n.recommendedProvider ? ` (rec: ${n.recommendedProvider.name})` : "";
        return `${n.categoryLabel}${rec}`;
      }).join(", ") + "."
    );
  }

  return parts.join(" ");
}

// ── Category → generic templateId mapping for deduplication ──

const CATEGORY_TO_TEMPLATE: Record<string, string[]> = {
  UTILITY_ELECTRIC: ["P1_ELECTRIC", "P1_OLD_UTILITIES"],
  UTILITY_WATER: ["P1_WATER"],
  UTILITY_GAS: ["P1_GAS"],
  UTILITY_INTERNET: ["P1_INTERNET"],
  FINANCIAL_BANK: ["P2_BANKS", "B2_BIZ_BANK"],
  FINANCIAL_CREDIT_CARD: ["P2_CREDIT_CARDS"],
  FINANCIAL_MORTGAGE: ["P2_MORTGAGE"],
  FINANCIAL_INSURANCE_AUTO: ["P3_AUTO_INSURANCE"],
  FINANCIAL_INSURANCE_HOME: ["P1_RENTERS_INSURANCE"],
  FINANCIAL_INSURANCE_HEALTH: ["P3_HEALTH_INSURANCE"],
  FINANCIAL_INSURANCE_LIFE: ["P4_LIFE_INSURANCE"],
  FINANCIAL_INSURANCE_PET: ["P4_PET_INSURANCE"],
  HEALTHCARE_DOCTORS: ["P4_DOCTOR", "P0_MEDICAL_RECORDS"],
  HEALTHCARE_DENTIST: ["P4_DENTIST"],
  HEALTHCARE_PHARMACY: ["P4_PHARMACY"],
  HEALTHCARE_VET: ["P4_VET", "P0_PET_VET"],
  HEALTHCARE_SENIOR: ["P4_SENIOR_CARE"],
  FITNESS_GYM: ["P4_GYM"],
  TRANSPORTATION_TOLL: ["P4_TOLL_PASS"],
  KIDS_SCHOOL: ["P0_SCHOOL_RECORDS", "P4_SCHOOL_ENROLL"],
  KIDS_DAYCARE: ["P4_DAYCARE"],
  HOUSING_HOA: ["P5_HOA"],
  SHOPPING_SUBSCRIPTION: ["P4_SUBSCRIPTIONS"],
};

export interface MigrationTaskResult {
  tasks: TaskTemplate[];
  replaces: string[];
}

/**
 * Convert migration analysis into personalized task templates.
 * Returns tasks AND a list of generic templateIds they replace.
 */
export function generateMigrationTasks(
  analysis: MigrationAnalysis,
  moveDate: Date,
  toState: string,
): MigrationTaskResult {
  const tasks: TaskTemplate[] = [];
  const replaces: string[] = [];
  const moveDateMs = moveDate.getTime();

  // Helper: get due date from daysRelativeToMove
  const dueFrom = (daysRel: number) => new Date(moveDateMs + daysRel * 86400000);
  const buildMigrationTemplateId = (prefix: string, serviceId: string) => {
    const maxServiceIdLength = Math.max(1, 30 - prefix.length);
    return `${prefix}${serviceId.slice(-maxServiceIdLength)}`;
  };

  // ── KEEP items → "Update [Provider] address" ──
  for (const item of analysis.keeps) {
    const svcId = item.currentService?.id || "unknown";
    tasks.push({
      title: `${item.icon} Update ${item.currentService?.providerName || item.categoryLabel} address`,
      description: `${item.note}\n\nThis is local Move guidance. Confirm the provider's address-update process before acting.`,
      category: item.category,
      priority: "MEDIUM",
      dueDate: dueFrom(3),
      daysBeforeMove: -3,
      isAutoGenerated: true,
      templateId: buildMigrationTemplateId("MIG_KEEP_", svcId),
    });
    const genericIds = CATEGORY_TO_TEMPLATE[item.category] || [];
    replaces.push(...genericIds);
  }

  // ── TRANSFER items → "Transfer [Provider] to [state]" ──
  for (const item of analysis.transfers) {
    const svcId = item.currentService?.id || "unknown";
    tasks.push({
      title: `${item.icon} Transfer ${item.currentService?.providerName || item.categoryLabel} to ${toState}`,
      description: `${item.note}\n\nContact the provider to confirm whether service can be transferred to the new address. Move does not perform the transfer.`,
      category: item.category,
      priority: "HIGH",
      dueDate: dueFrom(-3),
      daysBeforeMove: 3,
      isAutoGenerated: true,
      templateId: buildMigrationTemplateId("MIG_TRANSFER_", svcId),
    });
    const genericIds = CATEGORY_TO_TEMPLATE[item.category] || [];
    replaces.push(...genericIds);
  }

  // ── SWITCH items → "Switch from [Old] to [New]" ──
  for (const item of analysis.switches) {
    const svcId = item.currentService?.id || "unknown";
    const oldName = item.currentService?.providerName || "current provider";
    const newName = item.recommendedProvider?.name;
    const switchTitle = newName
      ? `${item.icon} Switch from ${oldName} to ${newName}`
      : `${item.icon} Find replacement for ${oldName}`;
    const switchDesc = newName
      ? `${item.note}\n\n${oldName} is not available in ${toState}. We recommend switching to ${newName}.`
      : `${item.note}\n\n${oldName} is not available in ${toState}. You'll need to find a new ${item.categoryLabel} provider.`;

    tasks.push({
      title: switchTitle,
      description: switchDesc,
      category: item.category,
      priority: "HIGH",
      dueDate: dueFrom(-3),
      daysBeforeMove: 3,
      isAutoGenerated: true,
      templateId: buildMigrationTemplateId("MIG_SWITCH_", svcId),
    });
    const genericIds = CATEGORY_TO_TEMPLATE[item.category] || [];
    replaces.push(...genericIds);
  }

  // ── CANCEL items → "Cancel [Provider]" ──
  for (const item of analysis.cancels) {
    const svcId = item.currentService?.id || "unknown";
    tasks.push({
      title: `${item.icon} Cancel ${item.currentService?.providerName || item.categoryLabel}`,
      description: `${item.note}\n\nThis service is specific to your current location and won't be needed after your move.`,
      category: item.category,
      priority: "MEDIUM",
      dueDate: dueFrom(-1),
      daysBeforeMove: 1,
      isAutoGenerated: true,
      templateId: buildMigrationTemplateId("MIG_CANCEL_", svcId),
    });
    const genericIds = CATEGORY_TO_TEMPLATE[item.category] || [];
    replaces.push(...genericIds);
  }

  // Deduplicate replaces list
  const uniqueReplaces = [...new Set(replaces)];

  return { tasks, replaces: uniqueReplaces };
}
