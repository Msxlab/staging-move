-- PR-3: Persist dashboard widget visibility + order per user.
-- `dashboardWidgetPrefs` holds `{ order: string[], visibility: Record<string, boolean> }`.
ALTER TABLE `User` ADD COLUMN `dashboardWidgetPrefs` JSON NULL;
