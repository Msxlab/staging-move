/**
 * Relocation Checklist Generator
 *
 * Generates a personalized, phase-ordered checklist based on:
 * - User profile (kids, pets, cars, senior, disability, etc.)
 * - Move type (PERSONAL, BUSINESS, VACATION)
 * - Destination state (for state-specific deadlines)
 * - Move date (for calculating due dates)
 */

import {
  SERVICE_PRIORITY_MAP,
  STATE_DMV_DEADLINES,
  RELOCATION_PHASES,
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
  moveType: "PERSONAL" | "BUSINESS" | "VACATION";
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
  if (!item.moveTypes.includes(profile.moveType)) return false;
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
  completedTaskCategories: Set<string> = new Set(),
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

    // Calculate due date
    const dueDate = new Date(moveDateMs + item.daysRelativeToMove * 24 * 60 * 60 * 1000);
    const deadlineDate = deadlineDays
      ? new Date(moveDateMs + deadlineDays * 24 * 60 * 60 * 1000)
      : null;

    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilDeadline = deadlineDate
      ? Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const isCompleted =
      completedTaskTemplateIds.has(item.id) ||
      completedTaskCategories.has(item.category);

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

  // Group into phases
  const phases = RELOCATION_PHASES.map((phaseInfo) => {
    const items = allItems.filter((item) => item.phase === phaseInfo.phase);
    const completedCount = items.filter((i) => i.isCompleted).length;
    const isActive = daysSinceMove >= (phaseInfo.daysOffset - 14) &&
      daysSinceMove < (phaseInfo.daysOffset + 30);

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

  // Determine current phase
  let currentPhase = 0;
  if (daysSinceMove < -7) currentPhase = 0;
  else if (daysSinceMove < 3) currentPhase = 1;
  else if (daysSinceMove < 10) currentPhase = 2;
  else if (daysSinceMove < 30) currentPhase = 3;
  else if (daysSinceMove < 60) currentPhase = 4;
  else currentPhase = 5;

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

export function generateTaskTemplates(
  profile: UserChecklistProfile,
  moveDate: Date,
  toState: string,
  stateRule?: ChecklistStateRuleContext | null,
): TaskTemplate[] {
  const moveDateMs = moveDate.getTime();
  const templates: TaskTemplate[] = [];

  for (const item of SERVICE_PRIORITY_MAP) {
    if (!itemMatchesProfile(item, profile)) continue;

    const { deadlineDays, stateNote } = applyStateOverrides(item, toState, stateRule);

    if (item.id === "P3_VEHICLE_INSPECTION" && stateNote?.includes("does not require")) {
      continue;
    }

    const dueDate = new Date(moveDateMs + item.daysRelativeToMove * 24 * 60 * 60 * 1000);

    let description = item.description;
    if (stateNote) description += `\n\n📍 ${stateNote}`;
    if (item.tips) description += `\n\n💡 ${item.tips}`;
    if (item.actionUrl) description += `\n\n🔗 ${item.actionUrl}`;
    if (item.estimatedMinutes) description += `\n\n⏱ Estimated: ~${item.estimatedMinutes} min`;

    templates.push({
      title: `${item.icon} ${item.title}`,
      description,
      category: item.category,
      priority: item.priority,
      dueDate,
      daysBeforeMove: item.daysRelativeToMove,
      isAutoGenerated: true,
      templateId: item.id,
    });
  }

  return templates;
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
