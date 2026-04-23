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
-- DigitalOcean MySQL 8 rejects `ALTER TABLE ... DROP COLUMN IF EXISTS`,
-- so each drop is guarded through INFORMATION_SCHEMA instead.
SET @drop_profile_current_streak = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Profile'
        AND COLUMN_NAME = 'currentStreak'
    ),
    'ALTER TABLE `Profile` DROP COLUMN `currentStreak`',
    'SELECT 1'
  )
);
PREPARE drop_profile_current_streak_stmt FROM @drop_profile_current_streak;
EXECUTE drop_profile_current_streak_stmt;
DEALLOCATE PREPARE drop_profile_current_streak_stmt;

SET @drop_profile_longest_streak = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Profile'
        AND COLUMN_NAME = 'longestStreak'
    ),
    'ALTER TABLE `Profile` DROP COLUMN `longestStreak`',
    'SELECT 1'
  )
);
PREPARE drop_profile_longest_streak_stmt FROM @drop_profile_longest_streak;
EXECUTE drop_profile_longest_streak_stmt;
DEALLOCATE PREPARE drop_profile_longest_streak_stmt;

SET @drop_profile_last_active_date = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Profile'
        AND COLUMN_NAME = 'lastActiveDate'
    ),
    'ALTER TABLE `Profile` DROP COLUMN `lastActiveDate`',
    'SELECT 1'
  )
);
PREPARE drop_profile_last_active_date_stmt FROM @drop_profile_last_active_date;
EXECUTE drop_profile_last_active_date_stmt;
DEALLOCATE PREPARE drop_profile_last_active_date_stmt;

SET @drop_profile_total_points = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'Profile'
        AND COLUMN_NAME = 'totalPoints'
    ),
    'ALTER TABLE `Profile` DROP COLUMN `totalPoints`',
    'SELECT 1'
  )
);
PREPARE drop_profile_total_points_stmt FROM @drop_profile_total_points;
EXECUTE drop_profile_total_points_stmt;
DEALLOCATE PREPARE drop_profile_total_points_stmt;
