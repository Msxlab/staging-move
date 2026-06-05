export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getAuditRequestMeta, writeAdminAudit } from "@/lib/audit";

/**
 * Admin CRUD for ConnectorFallbackAction - the DB-backed guided/fallback actions
 * (deep-link / mailto / PDF) that a connector degrades to when it can't auto-push.
 * A row here is layered OVER the in-code default by the web resolver, so adding a
 * partner's guided flow becomes a data change, not a deploy. Reversible content
 * (not a credential or kill-switch), so permission-gated without password step-up,
 * but every write is still audit-logged.
 */

const TYPES = ["DEEP_LINK", "MAILTO", "PDF", "PHONE"] as const;
type FallbackActionType = (typeof TYPES)[number];

const ACTION_KEY_RE = /^[a-z][a-z0-9:_-]*$/i;
const CONNECTOR_KEY_RE = /^[a-z][a-z0-9-]*$/;
const LOCALE_RE = /^[a-zA-Z0-9_-]+$/;
const MAX_ACTION_KEY_LENGTH = 120;
const MAX_CONNECTOR_KEY_LENGTH = 64;
const MAX_LABEL_LENGTH = 120;
const MAX_HELPER_TEXT_LENGTH = 1200;
const MAX_URL_TEMPLATE_LENGTH = 2000;
const MAX_LOCALE_LENGTH = 16;

function authError(e: unknown): NextResponse | null {
  const msg = (e as { message?: string })?.message;
  if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

function normalizeType(value: unknown): FallbackActionType {
  return TYPES.includes(value as FallbackActionType) ? (value as FallbackActionType) : "DEEP_LINK";
}

function isAllowedUrlTemplate(value: string, type: FallbackActionType): boolean {
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

/** GET - list every admin-editable fallback action, grouped by connector. */
export async function GET() {
  try {
    await requirePermission("connectors", "canRead", { minimumRole: "ADMIN" });
    const actions = await prisma.connectorFallbackAction.findMany({
      orderBy: [{ connectorKey: "asc" }, { actionKey: "asc" }],
    });
    return NextResponse.json({ actions });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** POST - create or update a fallback action (upsert by its unique actionKey). */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("connectors", "canCreate", { minimumRole: "ADMIN" });
    const body = await req.json().catch(() => ({}));
    const { actionKey, connectorKey, type, label, helperText, urlTemplate, locale, enabled } = body ?? {};

    const actionKeyValue = typeof actionKey === "string" ? actionKey.trim() : "";
    const connectorKeyValue = typeof connectorKey === "string" ? connectorKey.trim() : "";
    const labelValue = typeof label === "string" ? label.trim() : "";
    const helperTextValue = typeof helperText === "string" ? helperText.trim() : "";
    const urlTemplateValue = typeof urlTemplate === "string" ? urlTemplate.trim() : "";
    const localeValue = typeof locale === "string" && locale.trim() ? locale.trim() : "en";
    const typeValue = normalizeType(type);

    if (!actionKeyValue || actionKeyValue.length > MAX_ACTION_KEY_LENGTH || !ACTION_KEY_RE.test(actionKeyValue)) {
      return NextResponse.json({ error: 'actionKey is required (e.g. "usps:MAIL_FORWARDING:DEEP_LINK")' }, { status: 400 });
    }
    if (
      !connectorKeyValue ||
      connectorKeyValue.length > MAX_CONNECTOR_KEY_LENGTH ||
      !CONNECTOR_KEY_RE.test(connectorKeyValue)
    ) {
      return NextResponse.json({ error: "connectorKey must be lowercase kebab-case" }, { status: 400 });
    }
    if (!labelValue || labelValue.length > MAX_LABEL_LENGTH) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }
    if (!helperTextValue || helperTextValue.length > MAX_HELPER_TEXT_LENGTH) {
      return NextResponse.json({ error: "helperText is required" }, { status: 400 });
    }
    if (urlTemplateValue.length > MAX_URL_TEMPLATE_LENGTH || (urlTemplateValue && !isAllowedUrlTemplate(urlTemplateValue, typeValue))) {
      await writeAdminAudit(session, {
        action: "REJECT_CONNECTOR_FALLBACK_ACTION",
        entityType: "ConnectorFallbackAction",
        entityId: (actionKeyValue || "invalid").slice(0, 30),
        metadata: {
          reason: "INVALID_URL_TEMPLATE",
          actionKey: actionKeyValue || null,
          connectorKey: connectorKeyValue || null,
          type: typeValue,
        },
        request: getAuditRequestMeta(req),
      });
      return NextResponse.json({ error: "urlTemplate must match the fallback action type" }, { status: 400 });
    }
    if (localeValue.length > MAX_LOCALE_LENGTH || !LOCALE_RE.test(localeValue)) {
      return NextResponse.json({ error: "locale is invalid" }, { status: 400 });
    }

    const data = {
      connectorKey: connectorKeyValue,
      type: typeValue,
      label: labelValue,
      helperText: helperTextValue,
      urlTemplate: urlTemplateValue || null,
      locale: localeValue,
      enabled: enabled !== false,
    };

    const action = await prisma.connectorFallbackAction.upsert({
      where: { actionKey: actionKeyValue },
      create: { actionKey: actionKeyValue, ...data },
      update: data,
    });
    await writeAdminAudit(session, {
      action: "UPSERT_CONNECTOR_FALLBACK_ACTION",
      entityType: "ConnectorFallbackAction",
      entityId: action.id,
      after: { actionKey: actionKeyValue, connectorKey: connectorKeyValue, type: data.type, enabled: data.enabled },
      request: getAuditRequestMeta(req),
    });
    return NextResponse.json({ action });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/** DELETE - remove a fallback action by actionKey (?actionKey=...). */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requirePermission("connectors", "canDelete", { minimumRole: "ADMIN" });
    const actionKey = new URL(req.url).searchParams.get("actionKey")?.trim() ?? "";
    if (!actionKey) return NextResponse.json({ error: "actionKey query param is required" }, { status: 400 });
    if (actionKey.length > MAX_ACTION_KEY_LENGTH || !ACTION_KEY_RE.test(actionKey)) {
      return NextResponse.json({ error: "actionKey query param is invalid" }, { status: 400 });
    }
    const { count } = await prisma.connectorFallbackAction.deleteMany({ where: { actionKey } });
    await writeAdminAudit(session, {
      action: "DELETE_CONNECTOR_FALLBACK_ACTION",
      entityType: "ConnectorFallbackAction",
      entityId: actionKey.slice(0, 30),
      metadata: { actionKey, deleted: count > 0 },
      request: getAuditRequestMeta(req),
    });
    return NextResponse.json({ deleted: count > 0 });
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
