/**
 * Fallback (guided) action resolution — Fallback 2.0.
 *
 * A connector that can't auto-push (GUIDED_UPDATE) or is disabled degrades to a
 * manual action: a deep-link, a prefilled mailto, or a PDF. This module layers
 * an admin-editable `ConnectorFallbackAction` DB row OVER the in-code default
 * (guided-connector-actions.ts), so adding a partner's guided flow becomes a
 * data change, not a deploy. An empty/unavailable table always keeps the shipped
 * default, so existing connectors never regress.
 *
 * When a specific move is supplied, `{{to.city}}`-style placeholders are
 * rendered against the canonical change (URL values are URL-encoded).
 */

import type { CanonicalAddressChange } from "@locateflow/connectors";
import { prisma } from "@/lib/db";
import { getGuidedConnectorAction, type GuidedConnectorAction } from "@/lib/guided-connector-actions";

export type FallbackActionType = "DEEP_LINK" | "MAILTO" | "PDF" | "PHONE";

export interface ResolvedFallbackAction extends GuidedConnectorAction {
  type: FallbackActionType;
}

/** Flatten the canonical change into the `{{path}}` values templates may use. */
function templateValues(change: CanonicalAddressChange): Record<string, string> {
  return {
    fullName: change.fullName ?? "",
    effectiveDate: change.effectiveDate ?? "",
    "to.street1": change.to.street1 ?? "",
    "to.street2": change.to.street2 ?? "",
    "to.city": change.to.city ?? "",
    "to.state": change.to.state ?? "",
    "to.zip": change.to.zip ?? "",
    "from.street1": change.from?.street1 ?? "",
    "from.city": change.from?.city ?? "",
    "from.state": change.from?.state ?? "",
    "from.zip": change.from?.zip ?? "",
  };
}

function fillTemplate(template: string, change: CanonicalAddressChange, encode: boolean): string {
  const values = templateValues(change);
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key] ?? "";
    return encode ? encodeURIComponent(value) : value;
  });
}

function normalizeActionType(value: unknown): FallbackActionType {
  return value === "MAILTO" || value === "PDF" || value === "PHONE" || value === "DEEP_LINK" ? value : "DEEP_LINK";
}

function isUsableFallbackUrl(rawUrl: string, type: FallbackActionType): boolean {
  const value = rawUrl.trim();
  if (!value) return false;
  if ((type === "DEEP_LINK" || type === "PDF") && value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const parsed = new URL(value);
    if (type === "MAILTO") return parsed.protocol === "mailto:";
    if (type === "PHONE") return parsed.protocol === "tel:";
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function finalizeAction(
  action: ResolvedFallbackAction | null,
  change: CanonicalAddressChange | undefined,
): ResolvedFallbackAction | null {
  if (!action) return null;
  const rendered = change ? renderFallbackAction(action, change) : action;
  return isUsableFallbackUrl(rendered.url, rendered.type) ? rendered : null;
}

/** Render a resolved action's url (encoded) + helperText (plain) for one move. */
export function renderFallbackAction(
  action: ResolvedFallbackAction,
  change: CanonicalAddressChange,
): ResolvedFallbackAction {
  return {
    ...action,
    url: fillTemplate(action.url, change, true),
    helperText: fillTemplate(action.helperText, change, false),
  };
}

/**
 * Resolve the fallback action for a manifest `fallbackActionKey`, layering an
 * enabled DB override over the in-code default. The DB read is best-effort: a
 * missing table/row or any error keeps the shipped default so the guided flow
 * never breaks. When `change` is given, templates are rendered for that move.
 */
export async function resolveFallbackAction(
  actionKey: string | null | undefined,
  change?: CanonicalAddressChange,
): Promise<ResolvedFallbackAction | null> {
  if (!actionKey) return null;

  const codeDefault = getGuidedConnectorAction(actionKey);
  const codeResolved: ResolvedFallbackAction | null = codeDefault
    ? { ...codeDefault, type: "DEEP_LINK" }
    : null;
  let resolved: ResolvedFallbackAction | null = codeResolved;

  try {
    const row = await prisma.connectorFallbackAction.findUnique({ where: { actionKey } });
    if (row && row.enabled) {
      const candidate = {
        key: actionKey,
        label: row.label,
        url: row.urlTemplate ?? resolved?.url ?? "",
        helperText: row.helperText,
        type: normalizeActionType(row.type),
      };
      resolved = finalizeAction(candidate, change) ?? finalizeAction(codeResolved, change);
      return resolved;
    }
  } catch {
    // Best-effort override: keep the in-code default on any DB error.
  }

  return finalizeAction(resolved, change);
}
