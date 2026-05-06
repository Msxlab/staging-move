import {
  FEDERAL_NEW as RAW_FEDERAL_NEW,
  STATE_DMVS,
  STATE_PROVIDERS as RAW_STATE_PROVIDERS,
} from "./providers";
import { applyProviderCoverageOverrides } from "./provider-coverage-overrides";
import { STATE_PROVIDER_EXPANSIONS } from "./state-provider-catalog";
import { getControlledActiveProviderSeeds } from "./controlled-provider-import";
import { sanitizeProviderSeedRecords } from "@locateflow/shared";

export const FEDERAL_NEW = sanitizeProviderSeedRecords(
  applyProviderCoverageOverrides(RAW_FEDERAL_NEW),
).providers;
export const STATE_PROVIDERS = sanitizeProviderSeedRecords(
  applyProviderCoverageOverrides([
    ...RAW_STATE_PROVIDERS,
    ...STATE_PROVIDER_EXPANSIONS,
    ...getControlledActiveProviderSeeds(),
  ]),
).providers;
export { STATE_DMVS };
