/**
 * Connector core — manifest validation.
 *
 * A connector's manifest is the contract the framework enforces. These pure
 * checks run in CI (every connector must pass) and when a registry is built, so
 * a misconfigured connector — e.g. a real-push connector with no manual
 * fallback, or an empty egress allowlist — fails fast instead of stranding a
 * user at runtime.
 */

import type { ConnectorManifest } from "./types";

const KEY_PATTERN = /^[a-z][a-z0-9-]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Validate a single manifest. Returns a list of human-readable issues;
 * an empty array means the manifest is well-formed.
 */
export function validateManifest(manifest: ConnectorManifest): string[] {
  const issues: string[] = [];

  if (!KEY_PATTERN.test(manifest.key)) {
    issues.push(`key "${manifest.key}" must be lowercase kebab-case (e.g. "usps")`);
  }
  if (!SEMVER_PATTERN.test(manifest.version)) {
    issues.push(`version "${manifest.version}" must be semver (e.g. "1.0.0")`);
  }
  if (!manifest.displayName.trim()) {
    issues.push("displayName is required");
  }
  if (manifest.allowedHosts.length === 0) {
    // An empty allowlist would let the HTTP client reach nothing — almost
    // always a mistake, and a silent one. Force the author to be explicit.
    issues.push("allowedHosts must list at least one partner host");
  }
  for (const host of manifest.allowedHosts) {
    if (host !== host.toLowerCase() || host.includes("/") || host.includes(" ")) {
      issues.push(`allowedHosts entry "${host}" must be a bare lowercase host (no scheme, path, or spaces)`);
    }
  }
  if (manifest.auth.type === "OAUTH" && (!manifest.auth.scopes || manifest.auth.scopes.length === 0)) {
    issues.push("OAUTH connectors must declare at least one scope (least privilege)");
  }
  if (manifest.capabilities.addressUpdatePush && !manifest.fallbackActionKey) {
    // The golden rule: a connector that can fail must have somewhere to fall
    // back to, so a failure never blocks the user's move.
    issues.push("a push-capable connector must declare a fallbackActionKey");
  }
  if (manifest.capabilities.readBackVerify && !manifest.capabilities.addressUpdatePush) {
    issues.push("readBackVerify only makes sense alongside addressUpdatePush");
  }

  return issues;
}

/** Convenience guard: true when the manifest has no validation issues. */
export function isValidManifest(manifest: ConnectorManifest): boolean {
  return validateManifest(manifest).length === 0;
}
