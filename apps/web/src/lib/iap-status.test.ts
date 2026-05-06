import { describe, expect, it } from "vitest";
import { mapAppleStatus } from "./iap-apple";
import { mapGoogleSubscriptionState } from "./iap-google";

describe("IAP status mapping", () => {
  it("keeps store grace periods active in the unified entitlement model", () => {
    expect(mapAppleStatus(4)).toBe("GRACE_PERIOD");
    expect(mapGoogleSubscriptionState("SUBSCRIPTION_STATE_IN_GRACE_PERIOD")).toBe("GRACE_PERIOD");
  });

  it("keeps billing retry and hold states separate from grace-period access", () => {
    expect(mapAppleStatus(3)).toBe("PAST_DUE");
    expect(mapGoogleSubscriptionState("SUBSCRIPTION_STATE_ON_HOLD")).toBe("PAST_DUE");
  });
});
