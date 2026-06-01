import { createConnectorRegistry, uspsConnector } from "@locateflow/connectors";

/**
 * Web app connector registry.
 *
 * A new partner becomes dispatchable only after:
 * - its isolated connector package is added here,
 * - its manifest declares every API/OAuth host it may contact,
 * - admin creates/enables the matching ConnectorConfig row, and
 * - FEATURE_API_CONNECTORS plus annual Pro entitlement are active.
 */
export const connectorRegistry = createConnectorRegistry([uspsConnector]);
