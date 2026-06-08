/**
 * Relocation Checklist Generator
 *
 * Generates a personalized, phase-ordered checklist based on:
 * - User profile (kids, pets, cars, senior, disability, etc.)
 * - Move type (PERSONAL, BUSINESS, VACATION, MILITARY)
 * - Destination state (for state-specific deadlines)
 * - Move date (for calculating due dates)
 */

import {
  SERVICE_PRIORITY_MAP,
  STATE_DMV_DEADLINES,
  RELOCATION_PHASES,
  getCurrentRelocationPhase,
  type ServicePriorityItem,
} from "./constants";

// ── Types ──

export interface UserChecklistProfile {
  hasChildren: boolean;
  childrenCount: number;
  hasPets: boolean;
  hasSenior: boolean;
  carCount: number;
  hasDisability: boolean;
  needsStorage: boolean;
  hasMotorcycle: boolean;
  hasBoatRV: boolean;
  isImmigrant: boolean;
  isBusinessOwner: boolean;
  moveType: "PERSONAL" | "BUSINESS" | "VACATION" | "MILITARY";
}

export interface ChecklistStateRuleContext {
  dmvRules?: string | null;
  voterRegistration?: string | null;
  taxInfo?: string | null;
}

export interface ChecklistItem extends ServicePriorityItem {
  dueDate: Date | null;
  deadlineDate: Date | null;
  isOverdue: boolean;
  daysUntilDue: number | null;
  daysUntilDeadline: number | null;
  isCompleted: boolean;
  completedAt: Date | null;
  linkedTaskId: string | null;
  stateNote: string | null;
}

export interface RelocationChecklist {
  moveDate: Date;
  fromState: string;
  toState: string;
  moveType: string;
  phases: {
    phase: number;
    label: string;
    shortLabel: string;
    icon: string;
    color: string;
    items: ChecklistItem[];
    completedCount: number;
    totalCount: number;
    isActive: boolean;
  }[];
  totalItems: number;
  completedItems: number;
  progressPercent: number;
  currentPhase: number;
  nextAction: ChecklistItem | null;
  urgentItems: ChecklistItem[];
  overdueItems: ChecklistItem[];
}

// ── Condition Evaluator ──

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

function itemMatchesProfile(item: ServicePriorityItem, profile: UserChecklistProfile): boolean {
  // A MILITARY (PCS) move is a PERSONAL move PLUS extra obligations: the mover
  // still needs USPS forwarding, DMV transfer, school enrollment, etc. So a
  // MILITARY profile matches both PERSONAL-typed items AND MILITARY-typed items.
  // (Previously MILITARY was folded to PERSONAL, which silently dropped every
  // MILITARY-only item — PCS orders, TMO scheduling, DEERS, TRICARE region.)
  const matchesMoveType =
    profile.moveType === "MILITARY"
      ? item.moveTypes.includes("PERSONAL") || item.moveTypes.includes("MILITARY")
      : item.moveTypes.includes(profile.moveType);
  if (!matchesMoveType) return false;
  for (const condition of item.conditions) {
    if (!evaluateCondition(condition, profile)) return false;
  }
  return true;
}

// ── State-specific Overrides ──

function applyStateOverrides(
  item: ServicePriorityItem,
  toState: string,
  stateRule?: ChecklistStateRuleContext | null,
): { deadlineDays: number | null; stateNote: string | null } {
  const stateInfo = STATE_DMV_DEADLINES[toState];
  let deadlineDays = item.deadlineDays;
  let stateNote: string | null = null;

  if (stateInfo) {
    if (item.id === "P3_DRIVERS_LICENSE") {
      deadlineDays = stateInfo.licenseDays;
      stateNote = `${toState} requires license transfer within ${stateInfo.licenseDays} days`;
    }
    if (item.id === "P3_VEHICLE_REG") {
      deadlineDays = stateInfo.registrationDays;
      stateNote = `${toState} requires vehicle registration within ${stateInfo.registrationDays} days`;
    }
    if (item.id === "P3_VEHICLE_INSPECTION") {
      if (!stateInfo.inspectionRequired) {
        return { deadlineDays: null, stateNote: `${toState} does not require vehicle inspection` };
      }
      stateNote = `${toState} requires vehicle safety inspection`;
    }
    // Suppress the state-income-tax registration in no-income-tax states
    // (AK, FL, NV, NH, SD, TN, TX, WA, WY). Signalled by a sentinel note the
    // generators/templates check for, mirroring the vehicle-inspection skip.
    if (item.id === "B1_STATE_TAX" && stateInfo.hasStateTax === false) {
      return {
        deadlineDays: null,
        stateNote: `${toState} has no state income tax — no income-tax registration needed`,
      };
    }
  }

  if (item.category === "GOVERNMENT_DMV" && stateRule?.dmvRules) {
    stateNote = stateNote ? `${stateNote}. ${stateRule.dmvRules}` : stateRule.dmvRules;
  }
  if (item.id === "P3_VOTER" && stateRule?.voterRegistration) {
    stateNote = stateNote ? `${stateNote}. ${stateRule.voterRegistration}` : stateRule.voterRegistration;
  }
  if (item.id === "B1_STATE_TAX" && stateRule?.taxInfo) {
    stateNote = stateNote ? `${stateNote}. ${stateRule.taxInfo}` : stateRule.taxInfo;
  }

  return { deadlineDays, stateNote };
}

// ── Checklist Generator ──

export function generateChecklist(
  profile: UserChecklistProfile,
  moveDate: Date,
  fromState: string,
  toState: string,
  completedTaskTemplateIds: Set<string> = new Set(),
  stateRule?: ChecklistStateRuleContext | null,
): RelocationChecklist {
  const now = new Date();
  const moveDateMs = moveDate.getTime();
  const daysSinceMove = Math.floor((now.getTime() - moveDateMs) / (1000 * 60 * 60 * 24));

  const allItems: ChecklistItem[] = [];

  for (const item of SERVICE_PRIORITY_MAP) {
    if (!itemMatchesProfile(item, profile)) continue;

    const { deadlineDays, stateNote } = applyStateOverrides(item, toState, stateRule);

    // Skip vehicle inspection if state doesn't require it
    if (item.id === "P3_VEHICLE_INSPECTION" && stateNote?.includes("does not require")) {
      continue;
    }
    // Skip state income-tax registration in no-income-tax states.
    if (item.id === "B1_STATE_TAX" && stateNote?.includes("no state income tax")) {
      continue;
    }

    // Calculate due date
    const dueDate = new Date(moveDateMs + item.daysRelativeToMove * 24 * 60 * 60 * 1000);
    const deadlineDate = deadlineDays != null
      ? new Date(moveDateMs + deadlineDays * 24 * 60 * 60 * 1000)
      : null;

    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilDeadline = deadlineDate
      ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const isCompleted = completedTaskTemplateIds.has(item.id);

    const isOverdue = !isCompleted && daysUntilDue < 0;

    allItems.push({
      ...item,
      deadlineDays,
      dueDate,
      deadlineDate,
      isOverdue,
      daysUntilDue,
      daysUntilDeadline,
      isCompleted,
      completedAt: null,
      linkedTaskId: null,
      stateNote,
    });
  }

  // Sort by phase, then by priority weight, then by daysRelativeToMove
  const priorityWeight = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  allItems.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase - b.phase;
    if (priorityWeight[a.priority] !== priorityWeight[b.priority])
      return priorityWeight[a.priority] - priorityWeight[b.priority];
    return a.daysRelativeToMove - b.daysRelativeToMove;
  });

  const currentPhase = getCurrentRelocationPhase(daysSinceMove);

  // Group into phases
  const phases = RELOCATION_PHASES.map((phaseInfo) => {
    const items = allItems.filter((item) => item.phase === phaseInfo.phase);
    const completedCount = items.filter((i) => i.isCompleted).length;
    const isActive = phaseInfo.phase === currentPhase;

    return {
      phase: phaseInfo.phase,
      label: phaseInfo.label,
      shortLabel: phaseInfo.shortLabel,
      icon: phaseInfo.icon,
      color: phaseInfo.color,
      items,
      completedCount,
      totalCount: items.length,
      isActive,
    };
  }).filter((p) => p.totalCount > 0);

  const totalItems = allItems.length;
  const completedItems = allItems.filter((i) => i.isCompleted).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Find next action (first incomplete item in current or earlier phase)
  const nextAction = allItems.find(
    (i) => !i.isCompleted && i.phase <= currentPhase
  ) || allItems.find((i) => !i.isCompleted) || null;

  // Urgent items (deadline within 7 days or overdue)
  const urgentItems = allItems.filter(
    (i) =>
      !i.isCompleted &&
      ((i.daysUntilDeadline !== null && i.daysUntilDeadline <= 7) || i.isOverdue)
  );

  // Overdue items
  const overdueItems = allItems.filter((i) => !i.isCompleted && i.isOverdue);

  return {
    moveDate,
    fromState,
    toState,
    moveType: profile.moveType,
    phases,
    totalItems,
    completedItems,
    progressPercent,
    currentPhase,
    nextAction,
    urgentItems,
    overdueItems,
  };
}

// ── Task Template Generator ──

export interface TaskTemplate {
  title: string;
  description: string;
  category: string;
  priority: string;
  dueDate: Date;
  daysBeforeMove: number;
  isAutoGenerated: boolean;
  templateId: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Richer, persistable form of a checklist item — everything the move-task
 * persistence layer (syncSuggestedMoveTasks) needs to UPSERT a real MoveTask
 * row keyed by `templateId`. This is the bridge that makes the rich relocation
 * checklist (USPS, IRS 8822, USCIS AR-11, DMV, school, utilities, PCS) survive
 * past client display and reach the reminder crons.
 */
export interface ChecklistTaskTemplate {
  /** Stable checklist template id, e.g. "P2_USCIS" — the idempotency anchor. */
  templateId: string;
  category: string;
  /** Display title WITHOUT the leading icon (icon kept separate for callers). */
  title: string;
  icon: string;
  description: string;
  priority: ServicePriorityItem["priority"];
  phase: number;
  isRequired: boolean;
  /**
   * Soft due date (when the user should START), deadline-aware: for items with
   * a hard legal deadline (AR-11, DMV, health-insurance window) we schedule the
   * soft due a buffer before the hard deadline, instead of a flat per-type
   * offset. Always a real Date so reminder crons have something to fire on.
   */
  dueDate: Date;
  /** Hard legal/compliance deadline, when the item has one (else null). */
  deadlineDate: Date | null;
  /** Days the deadline falls after the move date (after state overrides). */
  deadlineDays: number | null;
  daysRelativeToMove: number;
  estimatedMinutes: number;
  actionUrl?: string;
  tips?: string;
  stateNote: string | null;
}

/**
 * How many days BEFORE a hard deadline the soft due date should land, so the
 * user is nudged to start with enough runway. Deadline-bearing items get a
 * buffer; everything else falls back to its phase-relative `daysRelativeToMove`.
 */
function dueDateForTemplateItem(
  moveDateMs: number,
  daysRelativeToMove: number,
  deadlineDays: number | null,
): { dueDate: Date; deadlineDate: Date | null } {
  const deadlineDate =
    deadlineDays != null ? new Date(moveDateMs + deadlineDays * DAY_MS) : null;

  if (deadlineDays == null || deadlineDate == null) {
    return { dueDate: new Date(moveDateMs + daysRelativeToMove * DAY_MS), deadlineDate: null };
  }

  // Buffer scales with how tight the deadline is: a 10-day AR-11 window needs a
  // near-immediate nudge; a 90-day DMV window can sit a couple weeks out.
  const buffer = deadlineDays <= 14 ? 3 : deadlineDays <= 30 ? 7 : 14;
  const bufferedDueMs = moveDateMs + (deadlineDays - buffer) * DAY_MS;
  // Never schedule the soft due AFTER the hard deadline, and never before the
  // item's natural phase start (so a generous deadline doesn't pull work
  // unrealistically early).
  const phaseDueMs = moveDateMs + daysRelativeToMove * DAY_MS;
  const dueMs = Math.min(deadlineDate.getTime(), Math.max(phaseDueMs, bufferedDueMs));
  return { dueDate: new Date(dueMs), deadlineDate };
}

/**
 * Build the personalized, deadline-aware set of checklist task templates for a
 * mover. Used BOTH to persist real MoveTask rows and (optionally) as a quick-win
 * fallback when the user tracks zero services. Filters by profile + move type
 * (PERSONAL/BUSINESS/VACATION/MILITARY), applies state overrides (DMV deadlines,
 * vehicle-inspection skip, no-income-tax state-tax suppression), and computes a
 * deadline-aware due date per item.
 */
export function buildChecklistTaskTemplates(
  profile: UserChecklistProfile,
  moveDate: Date,
  toState: string,
  stateRule?: ChecklistStateRuleContext | null,
): ChecklistTaskTemplate[] {
  const moveDateMs = moveDate.getTime();
  const templates: ChecklistTaskTemplate[] = [];

  for (const item of SERVICE_PRIORITY_MAP) {
    if (!itemMatchesProfile(item, profile)) continue;

    const { deadlineDays, stateNote } = applyStateOverrides(item, toState, stateRule);

    if (item.id === "P3_VEHICLE_INSPECTION" && stateNote?.includes("does not require")) {
      continue;
    }
    if (item.id === "B1_STATE_TAX" && stateNote?.includes("no state income tax")) {
      continue;
    }

    const { dueDate, deadlineDate } = dueDateForTemplateItem(
      moveDateMs,
      item.daysRelativeToMove,
      deadlineDays,
    );

    templates.push({
      templateId: item.id,
      category: item.category,
      title: item.title,
      icon: item.icon,
      description: item.description,
      priority: item.priority,
      phase: item.phase,
      isRequired: item.isRequired,
      dueDate,
      deadlineDate,
      deadlineDays,
      daysRelativeToMove: item.daysRelativeToMove,
      estimatedMinutes: item.estimatedMinutes,
      actionUrl: item.actionUrl,
      tips: item.tips,
      stateNote,
    });
  }

  return templates;
}

/** Compose a multi-line description for a persisted checklist task. */
export function composeChecklistTaskDescription(template: ChecklistTaskTemplate): string {
  let description = template.description;
  if (template.stateNote) description += `\n\n📍 ${template.stateNote}`;
  if (template.deadlineDate) {
    description += `\n\n⏳ Hard deadline: ${template.deadlineDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })}`;
  }
  if (template.tips) description += `\n\n💡 ${template.tips}`;
  if (template.actionUrl) description += `\n\n🔗 ${template.actionUrl}`;
  if (template.estimatedMinutes) description += `\n\n⏱ Estimated: ~${template.estimatedMinutes} min`;
  return description;
}

/**
 * Backward-compatible thin wrapper that preserves the original
 * `generateTaskTemplates` shape (title with leading icon, daysBeforeMove,
 * isAutoGenerated). Built on top of {@link buildChecklistTaskTemplates}.
 */
export function generateTaskTemplates(
  profile: UserChecklistProfile,
  moveDate: Date,
  toState: string,
  stateRule?: ChecklistStateRuleContext | null,
): TaskTemplate[] {
  return buildChecklistTaskTemplates(profile, moveDate, toState, stateRule).map((template) => ({
    title: `${template.icon} ${template.title}`,
    description: composeChecklistTaskDescription(template),
    category: template.category,
    priority: template.priority,
    dueDate: template.dueDate,
    daysBeforeMove: template.daysRelativeToMove,
    isAutoGenerated: true,
    templateId: template.templateId,
  }));
}

// ── Phase Summary for AI Context ──

export function getPhaseContextForAI(
  checklist: RelocationChecklist,
): string {
  const parts: string[] = [];

  parts.push(
    `Move: ${checklist.fromState} → ${checklist.toState}, ` +
    `date: ${checklist.moveDate.toLocaleDateString("en-US")}, ` +
    `type: ${checklist.moveType}.`
  );

  parts.push(
    `Progress: ${checklist.completedItems}/${checklist.totalItems} ` +
    `(${checklist.progressPercent}%) complete. ` +
    `Current phase: ${checklist.currentPhase} (${RELOCATION_PHASES[checklist.currentPhase]?.label || "Unknown"}).`
  );

  if (checklist.overdueItems.length > 0) {
    parts.push(
      `OVERDUE (${checklist.overdueItems.length}): ` +
      checklist.overdueItems.map((i) => i.title).join(", ") + "."
    );
  }

  if (checklist.urgentItems.length > 0) {
    const nonOverdue = checklist.urgentItems.filter((i) => !i.isOverdue);
    if (nonOverdue.length > 0) {
      parts.push(
        `URGENT (deadline soon): ` +
        nonOverdue.map((i) => {
          const dl = i.daysUntilDeadline !== null ? ` (${i.daysUntilDeadline}d left)` : "";
          return `${i.title}${dl}`;
        }).join(", ") + "."
      );
    }
  }

  if (checklist.nextAction) {
    parts.push(`Next action: ${checklist.nextAction.title}.`);
  }

  // State-specific notes
  const stateNotes = checklist.phases
    .flatMap((p) => p.items)
    .filter((i) => i.stateNote && !i.isCompleted)
    .map((i) => i.stateNote);

  if (stateNotes.length > 0) {
    parts.push("State rules: " + [...new Set(stateNotes)].join("; ") + ".");
  }

  return parts.join(" ");
}
