import { SERVICE_PRIORITY_MAP } from "@locateflow/shared";

/**
 * Maps a tracked-service category (the `serviceCategory` carried on a generated
 * MoveTask, e.g. "UTILITY_ELECTRIC") to the canonical relocation-checklist
 * template item id (e.g. "P1_ELECTRIC").
 *
 * Derived from SERVICE_PRIORITY_MAP: for each category we pick the first
 * template item in phase / priority / timing order (the same ordering the
 * checklist itself uses to render items), so a completed MoveTask in that
 * category marks the most representative checklist item DONE. Self-maintaining —
 * it tracks the priority map as it evolves.
 */
const CATEGORY_TO_TEMPLATE_ID: Record<string, string> = (() => {
  const priorityWeight: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const ordered = [...SERVICE_PRIORITY_MAP].sort((a, b) => {
    if (a.phase !== b.phase) return a.phase - b.phase;
    const pa = priorityWeight[a.priority] ?? 9;
    const pb = priorityWeight[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.daysRelativeToMove - b.daysRelativeToMove;
  });
  const map: Record<string, string> = {};
  for (const item of ordered) {
    if (!(item.category in map)) map[item.category] = item.id;
  }
  return map;
})();

/**
 * Resolve the checklist template id a generated MoveTask should be linked to,
 * given its tracked-service category. Returns null when the category has no
 * corresponding checklist template item — the task then keeps templateId = null
 * and the checklist behaves exactly as before.
 */
export function resolveChecklistTemplateId(
  serviceCategory: string | null | undefined,
): string | null {
  if (!serviceCategory) return null;
  return CATEGORY_TO_TEMPLATE_ID[serviceCategory] ?? null;
}
