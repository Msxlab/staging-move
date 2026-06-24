import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string) {
  return readFileSync(resolve(appRoot, relativePath), "utf8");
}

describe("admin high-blast step-up UI", () => {
  const clients = {
    notifications: read("(admin)/notifications/notifications-client.tsx"),
    featureFlags: read("(admin)/feature-flags/feature-flags-client.tsx"),
    security: read("(admin)/security/security-client.tsx"),
    stateRules: read("(admin)/state-rules/state-rules-client.tsx"),
  };

  it("renders the shared password confirmation modal in each protected client", () => {
    for (const source of Object.values(clients)) {
      expect(source).toContain("PasswordConfirmModal");
      expect(source).toContain("open={Boolean(stepUp)}");
      expect(source).toContain("onConfirm={confirmStepUp}");
      expect(source).toContain("requestStepUp({");
    }
  });

  it("sends confirmPassword in protected mutation bodies", () => {
    expect(clients.notifications).toContain("sendPayload({ ...payload, confirmPassword })");
    expect(clients.featureFlags).toContain("body: JSON.stringify({ ...payload, ...stepUpValues })");
    expect(clients.featureFlags).toContain("requiresMfa={true}");
    expect(clients.security).toContain("confirmPassword: values.confirmPassword");
    expect(clients.security).toContain("mfaCode: values.mfaCode");
    expect(clients.security).toContain("backupCode: values.backupCode");
    expect(clients.stateRules).toContain("body: JSON.stringify({ ...payload, confirmPassword })");
    expect(clients.stateRules).toContain("body: JSON.stringify({ confirmPassword })");
  });

  it("handles route-level step-up failures without closing the modal", () => {
    for (const source of Object.values(clients)) {
      expect(source).toContain("requiresPassword");
      expect(source).toContain("setStepUpError(message)");
      expect(source).toContain(".status === 401");
      expect(source).toContain(".status === 403");
    }
  });

  it("keeps non-protected read paths as unauthenticated client fetches", () => {
    expect(clients.notifications).toContain("fetch(`/api/notifications?${params.toString()}`)");
    expect(clients.featureFlags).toContain('fetch("/api/feature-flags")');
    expect(clients.security).toContain('fetch("/api/security")');
    expect(clients.stateRules).toContain('fetch("/api/state-rules")');
  });

  it("removes old direct mutation payloads that skipped step-up", () => {
    expect(clients.notifications).not.toContain("body: JSON.stringify(form)");
    expect(clients.featureFlags).not.toContain("body: JSON.stringify({ id: flag.id, enabled: !flag.enabled })");
    expect(clients.security).not.toContain('body: JSON.stringify({ action: "add_ip_rule", ...form })');
    expect(clients.stateRules).not.toContain("body: JSON.stringify(form)");
    expect(clients.stateRules).not.toContain('fetch(`/api/state-rules/${deleteTarget.id}`, { method: "DELETE" })');
  });
});
