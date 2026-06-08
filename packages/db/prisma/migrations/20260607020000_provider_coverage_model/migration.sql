-- PROVIDER COVERAGE MODEL OVERRIDE
--
-- Additive & backward-compatible. ONE change, which alters/drops no existing
-- column or data:
--
--   1. ServiceProvider.coverageModel — a NULLABLE VARCHAR(20) holding the
--      per-provider coverage MODEL ("state" | "zip_prefix" | "polygon" |
--      "live_address"). Historically the model lived ONLY in the curated
--      seed metadata keyed by slug (packages/db/src/provider-coverage-metadata.ts),
--      so an admin could not change it without editing seed code. The new admin
--      coverage editor writes this column; the matcher (apps/web provider
--      recommendations) prefers this override, then falls back to the seed
--      metadata, then to the existing zip-vs-state heuristic.
--
--      Existing rows get NULL, which means "no override" — behavior is
--      byte-for-byte identical to before for every current provider. No data
--      migration is required.

-- AlterTable (additive, nullable — existing rows backfill to NULL = no override)
ALTER TABLE `ServiceProvider` ADD COLUMN `coverageModel` VARCHAR(20) NULL;
