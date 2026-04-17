-- Phase 0 cleanup: remove Assistant / Badges / Referral / Community / Documents /
-- Family modules and the FAMILY subscription plan.
--
-- This migration drops 10 tables, 4 columns, and migrates any FAMILY plan
-- subscriptions to INDIVIDUAL so the application keeps serving them.
--
-- DATA LOSS WARNING: Run a `mysqldump` backup before applying in production.

-- ── 1) Migrate data first so we can drop cleanly ──────────────────
UPDATE `Subscription` SET `plan` = 'INDIVIDUAL' WHERE `plan` = 'FAMILY';

-- ── 2) Drop FK-bearing tables in the right order ──────────────────
-- ChatMessage depends on ChatSession → drop messages first.
DROP TABLE IF EXISTS `ChatMessage`;
DROP TABLE IF EXISTS `ChatSession`;

-- UserBadge depends on Badge → drop join first.
DROP TABLE IF EXISTS `UserBadge`;
DROP TABLE IF EXISTS `Badge`;

-- ReferralReward depends on User → independent from ReferralCode.
DROP TABLE IF EXISTS `ReferralReward`;
DROP TABLE IF EXISTS `ReferralCode`;

-- Moderation & reviews.
DROP TABLE IF EXISTS `KeywordBlacklist`;
DROP TABLE IF EXISTS `ModerationStat`;
DROP TABLE IF EXISTS `Review`;

-- Documents (Cloudinary storage).
DROP TABLE IF EXISTS `Document`;

-- Family groups.
DROP TABLE IF EXISTS `FamilyMember`;

-- ── 3) Drop legacy gamification columns from Profile ──────────────
ALTER TABLE `Profile`
  DROP COLUMN IF EXISTS `currentStreak`,
  DROP COLUMN IF EXISTS `longestStreak`,
  DROP COLUMN IF EXISTS `lastActiveDate`,
  DROP COLUMN IF EXISTS `totalPoints`;
