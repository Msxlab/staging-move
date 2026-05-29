/**
 * Connector core — redacting logger.
 *
 * Connectors handle tokens, account numbers, and resolved partner URLs — none
 * of which may ever reach a log sink. This logger wraps a base sink and scrubs
 * known-sensitive patterns from both the message and the metadata. It is
 * defense-in-depth: connectors are also told never to log secrets, but a slip
 * should be neutralized here rather than leak.
 */

import type { ConnectorLogger } from "./types";

type LogLevel = "info" | "warn" | "error";
type LogSink = (level: LogLevel, message: string, meta?: Record<string, unknown>) => void;

const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]"],
  [/enc_v1:[^\s"']+/g, "[encrypted]"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  // Long digit runs (account/card/phone numbers). Kept last so it does not eat
  // parts of the patterns above.
  [/\d{6,}/g, "[number]"],
];

const SENSITIVE_KEY = /token|secret|authorization|password|account|confirmation/i;
const MAX_DEPTH = 4;

/** Scrub sensitive substrings from a free-text string. */
export function redactSecrets(input: string): string {
  let out = input;
  for (const [pattern, replacement] of PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function redactValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    // Drop obviously-sensitive keys wholesale rather than risk a partial scrub.
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redactValue(val, depth + 1);
  }
  return out;
}

function redactMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  return redactValue(meta, 0) as Record<string, unknown>;
}

/**
 * Build a `ConnectorLogger` that redacts before forwarding to `sink`. The
 * default sink writes to the console; production wires its own structured sink.
 */
export function createRedactingLogger(sink?: LogSink): ConnectorLogger {
  const out: LogSink =
    sink ??
    ((level, message, meta) => {
      // eslint-disable-next-line no-console
      console[level](message, meta ?? {});
    });

  return {
    info: (message, meta) => out("info", redactSecrets(message), redactMeta(meta)),
    warn: (message, meta) => out("warn", redactSecrets(message), redactMeta(meta)),
    error: (message, meta) => out("error", redactSecrets(message), redactMeta(meta)),
  };
}
