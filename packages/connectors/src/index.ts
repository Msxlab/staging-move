/**
 * @locateflow/connectors
 *
 * The outbound connector framework: a uniform, isolated way to propagate an
 * address change to many external service providers. This barrel re-exports the
 * framework contract (`./core`); individual connectors live in their own
 * sibling folders (e.g. `./usps`) and are wired into a registry by the caller.
 */

export * from "./core";

export { uspsConnector, uspsManifest } from "./usps";
export { buildUspsCoaRequest } from "./usps/request";
