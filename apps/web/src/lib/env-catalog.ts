/**
 * Web-app re-export of the shared EXPECTED-ENV catalog (env audit F-006).
 *
 * Mirrors the `shared-runtime-config.ts` convention so app code imports the
 * catalog via the local `@/lib/env-catalog` alias instead of a deep relative
 * path into the shared package.
 */
export {
  EXPECTED_ENV_KEYS,
  getExpectedEnvKey,
  countExpectedEnvByClassification,
  evaluateEnvReadiness,
  buildEnvReadinessWarnings,
  type ExpectedEnvKey,
  type EnvKeyClassification,
  type EnvKeyApp,
  type EnvKeyPresence,
  type EnvReadinessEntry,
  type EnvReadinessReport,
} from "../../../../packages/shared/src/env-catalog";
