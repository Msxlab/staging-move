/**
 * Lightweight mobile error reporter.
 *
 * Posts uncaught JS errors and unhandled promise rejections to the
 * project's GlitchTip ingress (the same DSN the web app uses) using
 * the Sentry-compatible `/api/{project}/store/` endpoint. We avoid
 * `@sentry/react-native` here so the mobile app stays Expo-managed
 * and doesn't need a native rebuild — at the cost of skipping native
 * crash reports. JS-side coverage (the failure mode reported by ops
 * today) is the priority for private beta. Native crash reporting
 * via `@sentry/react-native` will land alongside the next prebuild.
 *
 * PII is scrubbed via the shared `scrubObject` helper so the same
 * redaction rules apply to both web and mobile events.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";
import { scrubObject } from "@locateflow/shared";

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
}

let initialized = false;
let dsnCache: ParsedDsn | null = null;
let originalErrorHandler: ((error: Error, isFatal?: boolean) => void) | null = null;

function readDsn(): string | null {
  // Mobile builds inject this via app config / EAS env. Falls back to the
  // public web DSN when the mobile-specific value is missing.
  const fromExtra =
    (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn ||
    (Constants.expoConfig?.extra as { SENTRY_DSN?: string } | undefined)?.SENTRY_DSN;
  if (fromExtra) return fromExtra;
  const fromEnv =
    process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  return fromEnv || null;
}

function parseDsn(dsn: string): ParsedDsn | null {
  // Sentry DSN format: https://<publicKey>@<host>/<projectId>
  try {
    const url = new URL(dsn);
    if (!url.username) return null;
    const projectId = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!projectId) return null;
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/store/`;
    return { endpoint, publicKey: url.username };
  } catch {
    return null;
  }
}

function generateEventId(): string {
  // Sentry expects a 32-char hex event ID. crypto.randomUUID() yields
  // 36 chars with dashes; strip the dashes for compliance.
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  // Fallback: 32 random hex chars derived from Math.random.
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

function buildEvent(input: {
  error: unknown;
  level: "error" | "warning" | "info";
  isFatal?: boolean;
  extra?: Record<string, unknown>;
}) {
  const err = input.error instanceof Error ? input.error : new Error(String(input.error));
  return {
    event_id: generateEventId(),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: input.level,
    sdk: { name: "locateflow.mobile", version: "0.1.0" },
    environment: process.env.NODE_ENV || "development",
    release: Constants.expoConfig?.version || "0.0.0",
    tags: scrubObject({
      "os.name": Platform.OS,
      "os.version": String(Platform.Version),
      isFatal: Boolean(input.isFatal),
    }) as Record<string, unknown>,
    extra: input.extra ? (scrubObject(input.extra) as Record<string, unknown>) : undefined,
    exception: {
      values: [
        {
          type: err.name || "Error",
          value: err.message || "Unknown error",
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split("\n")
                  .slice(0, 30)
                  .map((line, idx) => ({ filename: "anon", function: line.trim(), lineno: idx })),
              }
            : undefined,
        },
      ],
    },
  };
}

async function send(event: ReturnType<typeof buildEvent>) {
  if (!dsnCache) return;
  const auth = [
    "Sentry sentry_version=7",
    `sentry_client=${event.sdk.name}/${event.sdk.version}`,
    `sentry_key=${dsnCache.publicKey}`,
  ].join(", ");
  try {
    await fetch(dsnCache.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": auth,
      },
      body: JSON.stringify(event),
    });
  } catch {
    /* best effort — do not throw from the error reporter */
  }
}

export function initMobileSentry(): boolean {
  if (initialized) return true;
  const raw = readDsn();
  if (!raw) return false;
  const parsed = parseDsn(raw);
  if (!parsed) return false;
  dsnCache = parsed;
  initialized = true;

  // Capture uncaught JS errors via React Native's ErrorUtils.
  const ErrorUtils = (globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;
  if (ErrorUtils?.getGlobalHandler && ErrorUtils.setGlobalHandler) {
    originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      void send(buildEvent({ error, level: "error", isFatal }));
      originalErrorHandler?.(error, isFatal);
    });
  }

  // Capture unhandled promise rejections.
  if (typeof globalThis.addEventListener === "function") {
    globalThis.addEventListener("unhandledrejection", (event: unknown) => {
      const reason = (event as { reason?: unknown }).reason;
      void send(buildEvent({ error: reason, level: "error" }));
    });
  }
  return true;
}

export function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!initialized) return;
  void send(buildEvent({ error, level: "error", extra }));
}

export function captureMessage(
  message: string,
  level: "error" | "warning" | "info" = "info",
  extra?: Record<string, unknown>,
) {
  if (!initialized) return;
  void send(buildEvent({ error: new Error(message), level, extra }));
}
