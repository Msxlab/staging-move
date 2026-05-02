export type StoredNotificationPreference = {
  userId?: string | null;
  channel: string;
  type: string;
  enabled: boolean;
  frequency?: string | null;
};

type WebNotificationDefinition = {
  key: string;
  channel: string;
  type: string;
  defaultEnabled: boolean;
  frequency: string;
  legacyKeys?: string[];
};

type WebNotificationConfigDefinition = {
  key: "emailEnabled" | "digestDay" | "reminderDays";
  channel: string;
  type: string;
  defaultEnabled: boolean;
  defaultFrequency: string;
};

export const WEB_NOTIFICATION_PREFERENCE_DEFINITIONS: WebNotificationDefinition[] = [
  { key: "billReminder", channel: "EMAIL", type: "BILL_REMINDER", defaultEnabled: true, frequency: "IMMEDIATE", legacyKeys: ["EMAIL:REMINDER"] },
  { key: "billOverdue", channel: "EMAIL", type: "BILL_OVERDUE", defaultEnabled: true, frequency: "IMMEDIATE" },
  { key: "contractExpiring", channel: "EMAIL", type: "CONTRACT_EXPIRY", defaultEnabled: true, frequency: "IMMEDIATE", legacyKeys: ["EMAIL:REMINDER"] },
  { key: "taskReminder", channel: "EMAIL", type: "TASK_REMINDER", defaultEnabled: true, frequency: "IMMEDIATE", legacyKeys: ["EMAIL:SYSTEM"] },
  { key: "moveUpdate", channel: "EMAIL", type: "MOVE_ALERT", defaultEnabled: true, frequency: "IMMEDIATE" },
  { key: "weeklySummary", channel: "EMAIL", type: "WEEKLY_DIGEST", defaultEnabled: false, frequency: "WEEKLY", legacyKeys: ["EMAIL:MARKETING"] },
  { key: "monthlyReport", channel: "EMAIL", type: "MONTHLY_REPORT", defaultEnabled: false, frequency: "MONTHLY" },
];

export const WEB_NOTIFICATION_CONFIG_DEFINITIONS: WebNotificationConfigDefinition[] = [
  { key: "emailEnabled", channel: "EMAIL", type: "DELIVERY_ENABLED", defaultEnabled: true, defaultFrequency: "IMMEDIATE" },
  { key: "digestDay", channel: "EMAIL", type: "WEEKLY_DIGEST_DAY", defaultEnabled: true, defaultFrequency: "Monday" },
  { key: "reminderDays", channel: "EMAIL", type: "BILL_REMINDER_LEAD_TIME", defaultEnabled: true, defaultFrequency: "3" },
];

export type WebNotificationSettings = {
  prefs: Record<string, boolean>;
  config: {
    emailEnabled: boolean;
    digestDay: string;
    reminderDays: string;
  };
};

const VALID_DIGEST_DAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const VALID_REMINDER_DAY_VALUES = ["1", "3", "5", "7"] as const;
const VALID_REMINDER_DAYS = new Set<string>(VALID_REMINDER_DAY_VALUES);
export const MAX_WEB_NOTIFICATION_REMINDER_DAYS = VALID_REMINDER_DAY_VALUES.reduce(
  (max, value) => Math.max(max, Number.parseInt(value, 10)),
  0
);

function getPreferenceKey(channel: string, type: string) {
  return `${channel}:${type}`;
}

function buildPreferenceMap(records: StoredNotificationPreference[]) {
  return new Map(records.map((record) => [getPreferenceKey(record.channel, record.type), record]));
}

function resolveEnabled(definition: WebNotificationDefinition, preferenceMap: Map<string, StoredNotificationPreference>) {
  const direct = preferenceMap.get(getPreferenceKey(definition.channel, definition.type));
  if (direct) return direct.enabled;

  for (const legacyKey of definition.legacyKeys || []) {
    const legacy = preferenceMap.get(legacyKey);
    if (legacy) return legacy.enabled;
  }

  return definition.defaultEnabled;
}

function resolveConfig(definition: WebNotificationConfigDefinition, preferenceMap: Map<string, StoredNotificationPreference>) {
  const direct = preferenceMap.get(getPreferenceKey(definition.channel, definition.type));
  return {
    enabled: direct?.enabled ?? definition.defaultEnabled,
    frequency: direct?.frequency ?? definition.defaultFrequency,
  };
}

function normalizeDigestDay(value: string) {
  return VALID_DIGEST_DAYS.has(value) ? value : "Monday";
}

function normalizeReminderDays(value: string) {
  return VALID_REMINDER_DAYS.has(value) ? value : "3";
}

export function getNextBillingDate(billingDay: number, now: Date = new Date()) {
  const dueDate = new Date(now.getFullYear(), now.getMonth(), billingDay);
  if (dueDate < now) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }
  return dueDate;
}

export function getDaysUntilDate(target: Date, now: Date = new Date()) {
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildWebNotificationSettings(records: StoredNotificationPreference[]): WebNotificationSettings {
  const preferenceMap = buildPreferenceMap(records);
  const prefs = WEB_NOTIFICATION_PREFERENCE_DEFINITIONS.reduce<Record<string, boolean>>((acc, definition) => {
    acc[definition.key] = resolveEnabled(definition, preferenceMap);
    return acc;
  }, {});

  const emailEnabledConfig = resolveConfig(WEB_NOTIFICATION_CONFIG_DEFINITIONS[0], preferenceMap);
  const digestDayConfig = resolveConfig(WEB_NOTIFICATION_CONFIG_DEFINITIONS[1], preferenceMap);
  const reminderDaysConfig = resolveConfig(WEB_NOTIFICATION_CONFIG_DEFINITIONS[2], preferenceMap);

  return {
    prefs,
    config: {
      emailEnabled: emailEnabledConfig.enabled,
      digestDay: normalizeDigestDay(digestDayConfig.frequency || "Monday"),
      reminderDays: normalizeReminderDays(reminderDaysConfig.frequency || "3"),
    },
  };
}

export function isWebNotificationEnabled(records: StoredNotificationPreference[], key: string) {
  const settings = buildWebNotificationSettings(records);
  const definition = WEB_NOTIFICATION_PREFERENCE_DEFINITIONS.find((item) => item.key === key);
  if (!definition) return false;
  if (definition.channel === "EMAIL") return settings.config.emailEnabled && !!settings.prefs[key];
  return !!settings.prefs[key];
}

// Push channel defaults to enabled once a user accepts OS permission. Only an
// explicit `enabled: false` row turns it off, so freshly-registered devices
// receive task/move pushes without first visiting the settings screen.
export function isPushTypeEnabled(records: StoredNotificationPreference[], types: string | string[]): boolean {
  const list = Array.isArray(types) ? types : [types];
  let sawExplicit = false;
  for (const record of records) {
    if (record.channel !== "PUSH") continue;
    if (!list.includes(record.type)) continue;
    sawExplicit = true;
    if (record.enabled) return true;
  }
  return !sawExplicit;
}

export function groupNotificationPreferencesByUser(records: StoredNotificationPreference[]) {
  return records.reduce<Map<string, StoredNotificationPreference[]>>((acc, record) => {
    if (!record.userId) return acc;
    const existing = acc.get(record.userId) || [];
    existing.push(record);
    acc.set(record.userId, existing);
    return acc;
  }, new Map());
}
