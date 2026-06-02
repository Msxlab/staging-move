/**
 * Connector mode resolution — the "the system cannot lie" core.
 *
 * A connector's operating mode is NEVER set by hand. It is DERIVED, every time,
 * from objective facts: what the connector can technically do (its manifest),
 * whether we have a signed production partner agreement, whether real
 * credentials are configured, and the admin control-plane state (enabled +
 * rollout stage). One resolver, consumed everywhere — the dispatcher, the user
 * Connections screen, the admin Partner Control Plane, and any marketing copy
 * generated from connector state — so what we SHOW can never drift from what we
 * can actually DO.
 *
 * Pure + side-effect-free: no I/O, no env reads. The caller assembles the
 * inputs (e.g. credentialsPresent from the OAuth config loader) and this maps
 * them to a single honest answer.
 */

/** What we are allowed to claim/do for a connector right now. */
export type ConnectorMode =
  | "API_SYNC" //       live server-side push to the partner (real automatic sync)
  | "GUIDED_UPDATE" //  no automated push available → secure deep-link / guided flow
  | "COMING_SOON" //    registered but still in shadow testing, not live to users
  | "DISABLED"; //      kill-switched or retired — not offered

/**
 * Legal/commercial posture of a partner integration. API_SYNC is gated on
 * PRODUCTION: an operator can only mark this once a real authorized-agent /
 * API agreement is signed. Until then the connector cannot advertise or perform
 * automatic sync, no matter what the code is capable of.
 */
export type AgreementStatus = "NONE" | "SANDBOX" | "PRODUCTION";

export interface ConnectorModeInput {
  /** manifest.capabilities.addressUpdatePush — can it push server-side at all. */
  addressUpdatePush: boolean;
  /** Signed partner agreement posture (operator-set, gated). */
  agreementStatus: AgreementStatus;
  /** Whether real partner credentials (OAuth client / API key) are configured. */
  credentialsPresent: boolean;
  /** ConnectorConfig.enabled — the kill switch. */
  enabled: boolean;
  /** ConnectorConfig.stage — SHADOW | ROLLOUT | GA | RETIRED. */
  stage: string;
}

export interface ConnectorModeResult {
  mode: ConnectorMode;
  /** Human-readable why — surfaced in the admin panel + audit, never to end users. */
  reason: string;
  /** Convenience flag: are all conditions for real automatic sync met. */
  canApiSync: boolean;
}

const DISABLED_STAGES = new Set(["RETIRED"]);

/**
 * Resolve a connector's honest operating mode. Precedence (first match wins):
 *  1. kill switch / retired      → DISABLED
 *  2. shadow testing             → COMING_SOON
 *  3. cannot push server-side    → GUIDED_UPDATE
 *  4. no PRODUCTION agreement     → GUIDED_UPDATE  (legal gate)
 *  5. no credentials configured   → GUIDED_UPDATE
 *  6. all of the above satisfied  → API_SYNC
 *
 * Note: this is the CONNECTOR-level capability. Per-user rollout-percent
 * eligibility is a separate gate applied by the dispatcher; a connector can be
 * API_SYNC-capable while a given user is still outside the rollout bucket.
 */
export function resolveConnectorMode(input: ConnectorModeInput): ConnectorModeResult {
  if (!input.enabled) {
    return { mode: "DISABLED", reason: "Connector disabled (kill switch).", canApiSync: false };
  }
  if (DISABLED_STAGES.has(input.stage)) {
    return { mode: "DISABLED", reason: "Connector retired.", canApiSync: false };
  }
  if (input.stage === "SHADOW") {
    return { mode: "COMING_SOON", reason: "In shadow testing — not live to users yet.", canApiSync: false };
  }
  // Live (ROLLOUT/GA, enabled) from here. Can it actually sync automatically?
  if (!input.addressUpdatePush) {
    return {
      mode: "GUIDED_UPDATE",
      reason: "Connector cannot push server-side; guided update only.",
      canApiSync: false,
    };
  }
  if (input.agreementStatus !== "PRODUCTION") {
    return {
      mode: "GUIDED_UPDATE",
      reason: `No production partner agreement (status: ${input.agreementStatus}); guided update until signed.`,
      canApiSync: false,
    };
  }
  if (!input.credentialsPresent) {
    return {
      mode: "GUIDED_UPDATE",
      reason: "Partner credentials not configured; guided update until set.",
      canApiSync: false,
    };
  }
  return {
    mode: "API_SYNC",
    reason: "Live, push-capable, production agreement and credentials present.",
    canApiSync: true,
  };
}
