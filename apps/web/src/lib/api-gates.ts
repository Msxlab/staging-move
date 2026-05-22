import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth";
import {
  LEGAL_CONSENT_EVENT,
  getDefaultLegalConsents,
  hasRequiredLegalConsents,
} from "@/lib/legal";
import { getUserPlan, type PlanLimitCheck } from "@/lib/plan-limits";

export type ApiGateCode =
  | "UNAUTHORIZED"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "LEGAL_ACCEPTANCE_REQUIRED"
  | "SUBSCRIPTION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND";

const GATE_RESPONSES: Record<ApiGateCode, { status: number; error: string }> = {
  UNAUTHORIZED: { status: 401, error: "Please sign in again." },
  EMAIL_VERIFICATION_REQUIRED: { status: 403, error: "Please verify your email before continuing." },
  LEGAL_ACCEPTANCE_REQUIRED: { status: 403, error: "You must accept the Terms of Use and Disclaimer before continuing." },
  SUBSCRIPTION_REQUIRED: { status: 403, error: "An active subscription is required to continue." },
  FORBIDDEN: { status: 403, error: "You do not have permission to perform this action." },
  NOT_FOUND: { status: 404, error: "Not found." },
};

const SUBSCRIPTION_CODES = new Set(["SUBSCRIPTION_REQUIRED", "SUBSCRIPTION_INACTIVE", "TRIAL_EXPIRED"]);

export class ApiGateError extends Error {
  code: ApiGateCode;
  publicMessage?: string;
  extra?: Record<string, unknown>;

  constructor(code: ApiGateCode, publicMessage?: string, extra?: Record<string, unknown>) {
    super(code);
    this.name = "ApiGateError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.extra = extra;
  }
}

function parseStoredLegalConsents(metadata: string | null | undefined) {
  if (!metadata) return null;
  try {
    return getDefaultLegalConsents(JSON.parse(metadata));
  } catch {
    return null;
  }
}

function gateCodeFromError(error: unknown): ApiGateCode | null {
  if (error instanceof ApiGateError) return error.code;
  if (!(error instanceof Error)) return null;
  return error.message in GATE_RESPONSES ? (error.message as ApiGateCode) : null;
}

export function apiGateResponse(
  code: ApiGateCode,
  message?: string,
  extra: Record<string, unknown> = {},
) {
  const mapped = GATE_RESPONSES[code];
  return NextResponse.json(
    { code, error: message || mapped.error, ...extra },
    { status: mapped.status },
  );
}

export function apiGateErrorResponse(error: unknown) {
  const code = gateCodeFromError(error);
  if (!code) return null;
  if (error instanceof ApiGateError) {
    return apiGateResponse(code, error.publicMessage, error.extra);
  }
  return apiGateResponse(code);
}

export function entitlementErrorResponse(
  check: PlanLimitCheck,
  fallbackLimitCode: string,
) {
  const normalizedCode = SUBSCRIPTION_CODES.has(check.code || "")
    ? "SUBSCRIPTION_REQUIRED"
    : check.code || fallbackLimitCode;

  return NextResponse.json(
    {
      code: normalizedCode,
      error: check.reason || GATE_RESPONSES.SUBSCRIPTION_REQUIRED.error,
      upgradeRequired: check.upgradeRequired,
      current: check.current,
      limit: check.limit,
      entitlementCode: check.code,
    },
    { status: 403 },
  );
}

export async function requireAppMutationUser(options: {
  requireActiveSubscription?: boolean;
  requirePremium?: boolean;
  subscriptionMessage?: string;
} = {}) {
  const userId = await requireVerifiedUser();
  const consentEvents = await prisma.userEvent.findMany({
    where: { userId, event: LEGAL_CONSENT_EVENT },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const hasLegal = consentEvents.some((event) =>
    hasRequiredLegalConsents(parseStoredLegalConsents(event.metadata)),
  );
  if (!hasLegal) {
    throw new ApiGateError("LEGAL_ACCEPTANCE_REQUIRED");
  }

  if (options.requireActiveSubscription || options.requirePremium) {
    const plan = await getUserPlan(userId);
    if (!plan.isActive || (options.requirePremium && !plan.hasPremium)) {
      throw new ApiGateError(
        "SUBSCRIPTION_REQUIRED",
        options.subscriptionMessage || GATE_RESPONSES.SUBSCRIPTION_REQUIRED.error,
        { upgradeRequired: true },
      );
    }
  }

  return userId;
}
