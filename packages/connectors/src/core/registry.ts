/**
 * Connector core — in-memory registry.
 *
 * The registry maps a connector key to its implementation. Adding a partner is
 * a one-line change here (plus the connector's own isolated folder); the
 * framework, the apps, and the database schema never change. Construction
 * validates every manifest and rejects duplicate keys, so a broken connector
 * cannot be registered.
 */

import type { AddressConnector } from "./connector";
import { validateManifest } from "./manifest";

export interface ConnectorRegistry {
  /** The connector for `key`, or undefined if not registered. */
  get(key: string): AddressConnector | undefined;
  /** Whether a connector is registered for `key`. */
  has(key: string): boolean;
  /** All registered connectors. */
  list(): readonly AddressConnector[];
}

/**
 * Build a registry from a list of connectors. Throws if any manifest is invalid
 * or two connectors share a key — failing at startup rather than at runtime.
 */
export function createConnectorRegistry(connectors: readonly AddressConnector[]): ConnectorRegistry {
  const byKey = new Map<string, AddressConnector>();

  for (const connector of connectors) {
    const { key } = connector.manifest;

    const issues = validateManifest(connector.manifest);
    if (issues.length > 0) {
      throw new Error(`Invalid connector manifest "${key}": ${issues.join("; ")}`);
    }
    if (byKey.has(key)) {
      throw new Error(`Duplicate connector key "${key}"`);
    }
    byKey.set(key, connector);
  }

  const all = Object.freeze([...byKey.values()]);

  return {
    get: (key) => byKey.get(key),
    has: (key) => byKey.has(key),
    list: () => all,
  };
}
