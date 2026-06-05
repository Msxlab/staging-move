import { describe, expect, it } from "vitest";
import { connectorRegistry } from "./connector-registry";

describe("connector registry — webhook addressability invariant", () => {
  // F2 guard: the inbound webhook route resolves connectors from THIS registry
  // and only delivers to one that implements parseWebhook. So every connector
  // that declares async confirmation must implement parseWebhook, or its
  // partner's confirmations would silently 404. (Vacuously true while only the
  // sync USPS connector is registered — this protects the next async partner.)
  it("every async-confirm connector implements parseWebhook", () => {
    for (const connector of connectorRegistry.list()) {
      if (connector.manifest.capabilities.asyncConfirm) {
        expect(typeof connector.parseWebhook).toBe("function");
      }
    }
  });
});
