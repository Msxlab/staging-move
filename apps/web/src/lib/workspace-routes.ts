/**
 * Shared helpers for the workspace management routes (/api/workspaces/*).
 * Keeps the feature gate + plan-label derivation in one place.
 */

import { NextResponse } from "next/server";
import { seatLimitForPlan } from "@locateflow/shared";
import { prisma } from "@/lib/db";
import { isWorkspaceModelEnabled } from "@/lib/workspace-context";
import { resolveConsumerEntitlement } from "@/lib/consumer-entitlement";

/**
 * 404 when the workspace model is off — routes are invisible until enabled.
 * The stable `WORKSPACE_DISABLED` code lets clients tell "feature is off" apart
 * from a transient/network failure, so they don't render a permanent
 * "coming soon" state on a flaky connection.
 */
export async function workspaceFeatureGate(): Promise<NextResponse | null> {
  if (!(await isWorkspaceModelEnabled())) {
    return NextResponse.json({ error: "Not found", code: "WORKSPACE_DISABLED" }, { status: 404 });
  }
  return null;
}

/** Plan → user-facing workspace label (D1). */
export function workspacePlanLabel(plan: string | null | undefined): string {
  if (plan === "FAMILY") return "Household";
  if (plan === "PRO") return "Workspace";
  return "My move";
}

/** Resolve the plan label for a workspace from its owner's subscription. */
export async function planLabelForOwner(ownerUserId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { userId: ownerUserId } });
  const plan = (await resolveConsumerEntitlement(sub)).entitlement.effectivePlan as string;
  return workspacePlanLabel(plan);
}

/** Plan label + seat ceiling for a workspace, from its owner's subscription. */
export async function planSummaryForOwner(ownerUserId: string): Promise<{ planLabel: string; seatLimit: number }> {
  const sub = await prisma.subscription.findUnique({ where: { userId: ownerUserId } });
  const plan = (await resolveConsumerEntitlement(sub)).entitlement.effectivePlan as string;
  return { planLabel: workspacePlanLabel(plan), seatLimit: seatLimitForPlan(plan) };
}

/** Mask an email for members without full-email visibility (e.g. a***@gmail.com). */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}
