import { getUserSession } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { loadUserPreferences } from "@/lib/user-preferences";
import {
  CONSUMER_FREE_FLAG,
  UX_AI_BRIEFING_EXPERIENCE_FLAG,
  UX_TRUST_COPY_FLAG,
  type UxAiBriefingExperienceVariant,
  type UxTrustCopyVariant,
} from "@locateflow/shared";
import DashboardClient, { type DashboardWidgetPrefs } from "./dashboard-client";

export const dynamic = "force-dynamic";

async function loadWidgetPrefs(): Promise<DashboardWidgetPrefs | null> {
  const session = await getUserSession();
  if (!session) return null;

  const user = await loadUserPreferences(session.userId);

  const raw = user?.dashboardWidgetPrefs;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const prefs = raw as { order?: unknown; visibility?: unknown; collapsed?: unknown };

  const order = Array.isArray(prefs.order)
    ? (prefs.order.filter((k) => typeof k === "string") as string[])
    : undefined;
  const visibility =
    prefs.visibility && typeof prefs.visibility === "object" && !Array.isArray(prefs.visibility)
      ? Object.fromEntries(
          Object.entries(prefs.visibility as Record<string, unknown>).filter(
            ([, v]) => typeof v === "boolean"
          ) as Array<[string, boolean]>
        )
      : undefined;
  // `collapsed` stays undefined (not {}) when the user has never toggled, so
  // the client applies the smart collapse defaults exactly once.
  const collapsed =
    prefs.collapsed && typeof prefs.collapsed === "object" && !Array.isArray(prefs.collapsed)
      ? Object.fromEntries(
          Object.entries(prefs.collapsed as Record<string, unknown>).filter(
            ([, v]) => typeof v === "boolean"
          ) as Array<[string, boolean]>
        )
      : undefined;

  return { order, visibility, collapsed };
}

export default async function DashboardPage() {
  const initialPrefs = await loadWidgetPrefs();
  const session = await getUserSession();
  const userPrefs = session ? await loadUserPreferences(session.userId) : null;
  const [flagEnabled, trustFlagEnabled, consumerFree] = session
    ? await Promise.all([
        isFeatureEnabled(UX_AI_BRIEFING_EXPERIENCE_FLAG, { userId: session.userId }),
        isFeatureEnabled(UX_TRUST_COPY_FLAG, { userId: session.userId }),
        isFeatureEnabled(CONSUMER_FREE_FLAG, { userId: session.userId }),
      ])
    : [false, false, false];
  const uxAiBriefingExperienceVariant: UxAiBriefingExperienceVariant = flagEnabled ? "variant" : "control";
  const uxTrustCopyVariant: UxTrustCopyVariant = trustFlagEnabled ? "variant" : "control";
  return (
    <DashboardClient
      initialPrefs={initialPrefs}
      uxAiBriefingExperienceVariant={uxAiBriefingExperienceVariant}
      uxTrustCopyVariant={uxTrustCopyVariant}
      consumerFree={consumerFree}
      userFirstName={userPrefs?.firstName ?? null}
    />
  );
}
