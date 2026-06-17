import type { ChecklistItem, RelocationChecklist } from "./shared-relocation";

export const FREE_MOVE_PREVIEW_STORAGE_KEY = "locateflow.freeMovePreview.v1";

export interface FreeMovePreviewContext {
  fromState: string;
  toState: string;
  moveDate: string;
  savedAt: string;
}

export interface FreeMovePreviewStep {
  id: string;
  title: string;
  reason: string | null;
  deadline: string | null;
}

function normalizeState(value: unknown): string {
  if (typeof value !== "string") return "";
  const state = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : "";
}

function normalizeDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? "" : date;
}

export function sanitizeFreeMovePreviewContext(input: {
  fromState?: unknown;
  toState?: unknown;
  moveDate?: unknown;
  savedAt?: unknown;
}): FreeMovePreviewContext | null {
  const toState = normalizeState(input.toState);
  const moveDate = normalizeDate(input.moveDate);
  if (!toState || !moveDate) return null;

  const savedAt =
    typeof input.savedAt === "string" && !Number.isNaN(new Date(input.savedAt).getTime())
      ? input.savedAt
      : new Date().toISOString();

  return {
    fromState: normalizeState(input.fromState),
    toState,
    moveDate,
    savedAt,
  };
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function writeFreeMovePreviewContext(input: {
  fromState?: unknown;
  toState?: unknown;
  moveDate?: unknown;
}): FreeMovePreviewContext | null {
  const context = sanitizeFreeMovePreviewContext(input);
  if (!context) return null;
  const storage = browserStorage();
  if (!storage) return context;
  try {
    storage.setItem(FREE_MOVE_PREVIEW_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Best-effort only; the preview still renders in the current session.
  }
  return context;
}

export function readFreeMovePreviewContext(): FreeMovePreviewContext | null {
  const storage = browserStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(FREE_MOVE_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const context = sanitizeFreeMovePreviewContext(parsed);
    if (!context) storage.removeItem(FREE_MOVE_PREVIEW_STORAGE_KEY);
    return context;
  } catch {
    try {
      storage.removeItem(FREE_MOVE_PREVIEW_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
    return null;
  }
}

function stepReason(item: ChecklistItem): string | null {
  if (item.stateNote) return item.stateNote;
  if (item.daysUntilDeadline !== null && item.daysUntilDeadline >= 0) {
    return `Deadline in ${item.daysUntilDeadline} day${item.daysUntilDeadline === 1 ? "" : "s"} after your move`;
  }
  return item.description || null;
}

export function selectFreeMovePreviewSteps(
  checklist: RelocationChecklist | null | undefined,
  limit = 5,
): FreeMovePreviewStep[] {
  if (!checklist || limit <= 0) return [];

  const picked: ChecklistItem[] = [];
  const seen = new Set<string>();
  const push = (item: ChecklistItem | null | undefined) => {
    if (!item || item.isCompleted || seen.has(item.id) || picked.length >= limit) return;
    seen.add(item.id);
    picked.push(item);
  };

  push(checklist.nextAction);
  for (const item of checklist.urgentItems) push(item);
  for (const item of checklist.overdueItems) push(item);
  for (const phase of checklist.phases) {
    for (const item of phase.items) {
      if (item.priority === "URGENT" || item.priority === "HIGH") push(item);
    }
  }
  for (const phase of checklist.phases) {
    for (const item of phase.items) push(item);
  }

  return picked.map((item) => ({
    id: item.id,
    title: item.title,
    reason: stepReason(item),
    deadline: item.daysUntilDeadline !== null ? `${item.daysUntilDeadline}d` : null,
  }));
}
