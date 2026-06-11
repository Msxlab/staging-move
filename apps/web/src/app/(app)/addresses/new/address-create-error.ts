import type { ServiceLimitDetails } from "@/components/shared/service-limit-upsell";
import { isAddressLimitCode } from "@/components/shared/service-limit-upsell";

/**
 * Maps a failed POST /api/addresses response onto either the polished
 * limit-upsell modal (plan-gate failures) or a human-readable inline message
 * (everything else).
 *
 * Defensive by design:
 * - The limit decision keys on the error CODE (or the 403 + upgradeRequired
 *   signal), never on parsing the reason string.
 * - Unknown upgrade-required codes (e.g. SUBSCRIPTION_REQUIRED / TRIAL_EXPIRED
 *   normalizations) are funneled onto the generic address-limit copy instead
 *   of leaking service-flavored or enum copy.
 * - A bare server enum (e.g. "ADDRESS_LIMIT_REACHED") is never rendered as
 *   inline copy — the fallback message wins.
 */
export type AddressCreateErrorResolution =
  | { kind: "limit"; details: ServiceLimitDetails }
  | { kind: "message"; message: string };

const ADDRESS_UPGRADE_PATH = "/pricing";

export function resolveAddressCreateError(
  status: number,
  data: unknown,
  fallback: string,
): AddressCreateErrorResolution {
  const body = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code : null;
  const isLimitError =
    isAddressLimitCode(code) || (status === 403 && body.upgradeRequired === true);

  if (isLimitError) {
    return {
      kind: "limit",
      details: {
        // Non-address upgrade codes still render the friendly generic
        // address-limit copy rather than service copy or a raw enum.
        code: isAddressLimitCode(code) ? code : "ADDRESS_LIMIT_REACHED",
        limit: typeof body.limit === "number" ? body.limit : null,
        current: typeof body.current === "number" ? body.current : null,
        upgradePath: ADDRESS_UPGRADE_PATH,
      },
    };
  }

  const message = typeof body.error === "string" ? body.error.trim() : "";
  // Never surface a bare enum-looking server string as user copy.
  if (!message || /^[A-Z0-9_]+$/.test(message)) {
    return { kind: "message", message: fallback };
  }
  return { kind: "message", message };
}
