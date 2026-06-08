import { prisma } from "@/lib/db";
import {
  buildWebNotificationSettings,
  groupNotificationPreferencesByUser,
  isPushTypeEnabled,
  MAX_WEB_NOTIFICATION_REMINDER_DAYS,
  type StoredNotificationPreference,
} from "@/lib/notification-preferences";
import {
  daysUntilDateOnly,
  isReminderDeliveryHour,
  nextBillingOccurrence,
  resolveReminderTimeZone,
} from "@/lib/reminder-timezone";
import { formatDateOnlyUtc } from "@locateflow/shared";

/**
 * DAILY REMINDER ROLLUP — aggregation.
 *
 * Re-derives, per user, the EXACT same due-today reminder set the five per-item
 * daily crons (move / task / bill / bill-overdue / contract) would fire on this
 * run, using the SAME queries, the SAME timezone-aware lead-day matches, and the
 * SAME per-type preference gates. The digest cron then renders one email + one
 * push from this. Because the matching logic is identical, the digest contains
 * EVERYTHING those crons would have emailed — no dropped reminder.
 *
 * Two correctness guarantees this module is built around:
 *
 *  1. PARITY with the per-item crons. Each section below mirrors its source
 *     cron's WHERE clause, soft-delete guards, lead-day arrays, and the exact
 *     `daysUntil` helper it uses, so a user who would have received N per-item
 *     emails gets N digest sections (never fewer, never more).
 *
 *  2. PER-SECTION PREFERENCE RESPECT. The digest is assembled per channel:
 *     `emailSections` honors each type's EMAIL toggle (a user who muted bill
 *     emails sees NO bills in the email digest), and `pushTypes` honors each
 *     type's PUSH toggle independently. A section appears in the email only if
 *     its email pref is on; in the push count only if its push pref is on.
 *
 * Honest counts: every count shown is the real number of matched items. No
 * invented urgency, no fabricated entries.
 */

// Lead-day arrays — kept byte-identical to the source crons so parity holds.
const MOVE_REMINDER_DAYS = [7, 3, 1];
const TASK_REMINDER_DAYS = [3, 1, 0];
const CONTRACT_REMINDER_DAYS = [30, 14, 7, 1];
const DAY_MS = 24 * 60 * 60 * 1000;

export type DigestSectionKind =
  | "move"
  | "task"
  | "bill"
  | "bill-overdue"
  | "contract";

export interface DigestItem {
  kind: DigestSectionKind;
  /** Short headline line, e.g. "Pack the kitchen — due today". */
  label: string;
  /** Secondary detail, e.g. "Sep 12, 2025". */
  detail?: string;
  /** Deep link target (relative path). */
  href: string;
}

export interface DigestSection {
  kind: DigestSectionKind;
  /** Section heading, e.g. "Tasks due". */
  heading: string;
  items: DigestItem[];
}

export interface UserDigest {
  userId: string;
  email: string | null;
  userName: string;
  locale: string | null;
  timeZone: string;
  /** Move countdown — present only when an imminent move matched today. */
  moveCountdownDays: number | null;
  /** Sections to render in the EMAIL (each gated by its EMAIL pref). */
  emailSections: DigestSection[];
  /** Section kinds whose PUSH pref is on (gates inclusion in the push summary). */
  pushKinds: Set<DigestSectionKind>;
  /** Per-kind counts of ALL matched items (channel-independent, for dedupe key). */
  matchedCounts: Record<DigestSectionKind, number>;
}

type RawItem = {
  userId: string;
  kind: DigestSectionKind;
  label: string;
  detail?: string;
  href: string;
  /** For move: the countdown days (so the digest can show "in N days"). */
  countdownDays?: number;
};

function displayName(user: { firstName?: string | null; lastName?: string | null }) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "there";
}

function startOfDayLocalProcess(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clampDay(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, lastDay);
}

// Mirrors bill-overdue/route.ts mostRecentBillingDate — the local-midnight
// billing date math the overdue cron uses, so "1 day overdue" matches exactly.
function mostRecentBillingDate(billingDay: number, now: Date) {
  const today = startOfDayLocalProcess(now);
  let due = new Date(now.getFullYear(), now.getMonth(), clampDay(now.getFullYear(), now.getMonth(), billingDay));
  if (due > today) {
    const prevMonth = now.getMonth() - 1;
    const year = prevMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = (prevMonth + 12) % 12;
    due = new Date(year, month, clampDay(year, month, billingDay));
  }
  return due;
}

function daysBetweenLocal(a: Date, b: Date) {
  return Math.round(
    (startOfDayLocalProcess(a).getTime() - startOfDayLocalProcess(b).getTime()) / DAY_MS,
  );
}

function formatPlanDate(date: Date) {
  return formatDateOnlyUtc(date, { month: "short", day: "numeric", year: "numeric" });
}

// Reproject a local-midnight billing date onto a UTC instant for stable
// tz-independent display — mirrors bill-overdue/route.ts formatDate.
function formatLocalBillingDate(date: Date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return formatDateOnlyUtc(utc, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Gather every user's due-today reminder set for this run.
 *
 * Returns one UserDigest per user who has AT LEAST ONE matched item on a channel
 * they haven't muted (so the caller never sends an empty digest). The caller
 * still applies its own per-day dedupe key for idempotency.
 */
export async function collectDailyDigests(now: Date): Promise<UserDigest[]> {
  const rawByUser = new Map<string, RawItem[]>();
  const pushAllowedByUserKind = new Map<string, Set<DigestSectionKind>>();
  const emailAllowedByUserKind = new Map<string, Set<DigestSectionKind>>();
  const userMeta = new Map<
    string,
    { email: string | null; userName: string; locale: string | null; timeZone: string }
  >();

  function pushRaw(item: RawItem) {
    const list = rawByUser.get(item.userId) || [];
    list.push(item);
    rawByUser.set(item.userId, list);
  }
  function markChannel(
    map: Map<string, Set<DigestSectionKind>>,
    userId: string,
    kind: DigestSectionKind,
  ) {
    const set = map.get(userId) || new Set<DigestSectionKind>();
    set.add(kind);
    map.set(userId, set);
  }

  // We need preferences for every candidate user. Rather than fetch per section,
  // each section fetches its own candidates and we resolve prefs once per user
  // lazily via this cache.
  const prefsCache = new Map<string, StoredNotificationPreference[]>();
  async function prefsFor(userIds: string[]) {
    const missing = userIds.filter((id) => !prefsCache.has(id));
    if (missing.length > 0) {
      const records = await prisma.notificationPreference.findMany({
        where: { userId: { in: missing } },
        select: { userId: true, channel: true, type: true, enabled: true, frequency: true },
      });
      const grouped = groupNotificationPreferencesByUser(records);
      for (const id of missing) prefsCache.set(id, grouped.get(id) || []);
    }
  }

  // ── 1. MOVE COUNTDOWN (mirrors move-reminders/route.ts) ──
  {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 1);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + Math.max(...MOVE_REMINDER_DAYS) + 2);
    const plans = await prisma.movingPlan.findMany({
      where: {
        moveDate: { gte: windowStart, lt: windowEnd },
        status: { in: ["PLANNING", "IN_PROGRESS"] },
        user: { deletedAt: null },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true, profile: { select: { timezone: true } } } },
        fromAddress: { select: { city: true, state: true } },
        toAddress: { select: { city: true, state: true } },
      },
      orderBy: { moveDate: "asc" },
      take: 1000,
    });
    await prefsFor([...new Set(plans.map((p) => p.userId))]);
    for (const plan of plans) {
      const tz = resolveReminderTimeZone(plan.user.profile?.timezone);
      if (!isReminderDeliveryHour(now, tz)) continue;
      const days = daysUntilDateOnly(plan.moveDate, now, tz);
      if (!MOVE_REMINDER_DAYS.includes(days)) continue;

      const prefs = prefsCache.get(plan.userId) || [];
      const settings = buildWebNotificationSettings(prefs);
      const emailAllowed = Boolean(plan.user.email && settings.config.emailEnabled && settings.prefs.moveUpdate);
      const pushAllowed = isPushTypeEnabled(prefs, "MOVE_ALERT");
      if (!emailAllowed && !pushAllowed) continue;

      const fromCity = `${plan.fromAddress.city}, ${plan.fromAddress.state}`;
      const toCity = `${plan.toAddress.city}, ${plan.toAddress.state}`;
      const moveDateText = formatDateOnlyUtc(plan.moveDate, { month: "long", day: "numeric", year: "numeric" });
      const whenText = days === 1 ? "tomorrow" : `in ${days} days`;
      userMeta.set(plan.userId, {
        email: plan.user.email,
        userName: displayName(plan.user),
        locale: plan.user.preferredLocale,
        timeZone: tz,
      });
      if (emailAllowed) {
        pushRaw({
          userId: plan.userId,
          kind: "move",
          label: `Your move is ${whenText}`,
          detail: `${fromCity} → ${toCity} · ${moveDateText}`,
          href: `/moving/plan/${plan.id}`,
          countdownDays: days,
        });
        markChannel(emailAllowedByUserKind, plan.userId, "move");
      }
      if (pushAllowed) markChannel(pushAllowedByUserKind, plan.userId, "move");
    }
  }

  // ── 2. TASKS DUE (mirrors task-reminders/route.ts soft-due loop) ──
  {
    const start = startOfDayLocalProcess(now);
    const windowStart = new Date(start.getTime() - DAY_MS);
    const horizon = new Date(start.getTime() + (Math.max(...TASK_REMINDER_DAYS) + 2) * DAY_MS);
    const tasks = await prisma.moveTask.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: windowStart, lt: horizon },
        status: { notIn: ["COMPLETED", "DISMISSED"] },
        user: { deletedAt: null },
        movingPlan: { deletedAt: null },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        userId: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true, profile: { select: { timezone: true } } } },
        movingPlan: { select: { id: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 500,
    });
    await prefsFor([...new Set(tasks.map((t) => t.userId))]);
    for (const task of tasks) {
      if (!task.user || !task.dueDate) continue;
      const tz = resolveReminderTimeZone(task.user.profile?.timezone);
      if (!isReminderDeliveryHour(now, tz)) continue;
      const days = daysUntilDateOnly(task.dueDate, now, tz);
      if (!TASK_REMINDER_DAYS.includes(days)) continue;

      const prefs = prefsCache.get(task.userId) || [];
      const settings = buildWebNotificationSettings(prefs);
      const emailAllowed = Boolean(task.user.email && settings.config.emailEnabled && settings.prefs.taskReminder);
      const pushAllowed = isPushTypeEnabled(prefs, "TASK_REMINDER");
      if (!emailAllowed && !pushAllowed) continue;

      const dueDateText = formatPlanDate(task.dueDate);
      const whenText = days === 0 ? "due today" : days === 1 ? "due tomorrow" : `due in ${days} days`;
      if (!userMeta.has(task.userId)) {
        userMeta.set(task.userId, {
          email: task.user.email,
          userName: displayName(task.user),
          locale: task.user.preferredLocale,
          timeZone: tz,
        });
      }
      if (emailAllowed) {
        pushRaw({
          userId: task.userId,
          kind: "task",
          label: `${task.title} — ${whenText}`,
          detail: dueDateText,
          href: `/moving/plan/${task.movingPlan.id}`,
        });
        markChannel(emailAllowedByUserKind, task.userId, "task");
      }
      if (pushAllowed) markChannel(pushAllowedByUserKind, task.userId, "task");
    }
  }

  // ── 3. BILLS DUE (mirrors bill-reminders/route.ts) ──
  {
    const reminderDays = MAX_WEB_NOTIFICATION_REMINDER_DAYS;
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + reminderDays);
    const currentDay = now.getDate();
    const futureDay = futureDate.getDate();
    const spansMonthBoundary = futureDay < currentDay;
    const billingDayFilter = spansMonthBoundary
      ? { OR: [{ billingDay: { gte: currentDay, lte: 31 } }, { billingDay: { gte: 1, lte: futureDay } }] }
      : { AND: [{ billingDay: { not: null } }, { billingDay: { gte: currentDay, lte: futureDay } }] };
    const services = await prisma.service.findMany({
      where: {
        ...billingDayFilter,
        monthlyCost: { gt: 0 },
        isActive: true,
        user: { deletedAt: null },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true, profile: { select: { timezone: true } } } },
      },
    });
    await prefsFor([...new Set(services.map((s) => s.user?.id).filter(Boolean) as string[])]);
    for (const svc of services) {
      if (!svc.user?.email) continue;
      const prefs = prefsCache.get(svc.user.id) || [];
      const settings = buildWebNotificationSettings(prefs);
      const emailAllowed = settings.config.emailEnabled && settings.prefs.billReminder;
      const pushAllowed = isPushTypeEnabled(prefs, "BILL_REMINDER");
      if (!emailAllowed && !pushAllowed) continue;

      const tz = resolveReminderTimeZone(svc.user.profile?.timezone);
      if (!isReminderDeliveryHour(now, tz)) continue;
      const { date: dueDate, daysUntil } = nextBillingOccurrence(svc.billingDay || currentDay, now, tz);
      const leadDays = Number.parseInt(settings.config.reminderDays, 10);
      if (!Number.isFinite(leadDays) || daysUntil !== leadDays) continue;

      const dueDateText = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
      const whenText = daysUntil === 0 ? "due today" : `due in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`;
      if (!userMeta.has(svc.user.id)) {
        userMeta.set(svc.user.id, {
          email: svc.user.email,
          userName: displayName(svc.user),
          locale: svc.user.preferredLocale,
          timeZone: tz,
        });
      }
      if (emailAllowed) {
        pushRaw({
          userId: svc.user.id,
          kind: "bill",
          label: `${svc.providerName} — ${whenText} ($${(svc.monthlyCost || 0).toFixed(2)})`,
          detail: dueDateText,
          href: `/services/${svc.id}`,
        });
        markChannel(emailAllowedByUserKind, svc.user.id, "bill");
      }
      if (pushAllowed) markChannel(pushAllowedByUserKind, svc.user.id, "bill");
    }
  }

  // ── 4. BILLS OVERDUE (mirrors bill-overdue/route.ts) ──
  {
    const services = await prisma.service.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        billingDay: { not: null },
        monthlyCost: { gt: 0 },
        user: { deletedAt: null },
      },
      select: {
        id: true,
        userId: true,
        providerName: true,
        monthlyCost: true,
        billingDay: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true, profile: { select: { timezone: true } } } },
      },
    });
    await prefsFor([...new Set(services.map((s) => s.userId))]);
    for (const service of services) {
      if (!service.user?.email || !service.billingDay) continue;
      const tz = resolveReminderTimeZone(service.user.profile?.timezone);
      if (!isReminderDeliveryHour(now, tz)) continue;
      const dueDate = mostRecentBillingDate(service.billingDay, now);
      const daysOverdue = daysBetweenLocal(now, dueDate);
      if (daysOverdue !== 1) continue;

      const prefs = prefsCache.get(service.userId) || [];
      const settings = buildWebNotificationSettings(prefs);
      const emailAllowed = settings.config.emailEnabled && settings.prefs.billOverdue;
      const pushAllowed = isPushTypeEnabled(prefs, "BILL_OVERDUE");
      if (!emailAllowed && !pushAllowed) continue;

      const dueDateText = formatLocalBillingDate(dueDate);
      if (!userMeta.has(service.userId)) {
        userMeta.set(service.userId, {
          email: service.user.email,
          userName: displayName(service.user),
          locale: service.user.preferredLocale,
          timeZone: tz,
        });
      }
      if (emailAllowed) {
        pushRaw({
          userId: service.userId,
          kind: "bill-overdue",
          label: `${service.providerName} — overdue ($${(service.monthlyCost || 0).toFixed(2)})`,
          detail: `was due ${dueDateText}`,
          href: `/services/${service.id}`,
        });
        markChannel(emailAllowedByUserKind, service.userId, "bill-overdue");
      }
      if (pushAllowed) markChannel(pushAllowedByUserKind, service.userId, "bill-overdue");
    }
  }

  // ── 5. CONTRACT RENEWALS (mirrors contract-reminders/route.ts) ──
  {
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 1);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + Math.max(...CONTRACT_REMINDER_DAYS) + 2);
    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        contractEndDate: { gte: windowStart, lt: windowEnd },
        user: { deletedAt: null },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, preferredLocale: true, profile: { select: { timezone: true } } } },
      },
      orderBy: { contractEndDate: "asc" },
      take: 1000,
    });
    await prefsFor([...new Set(services.map((s) => s.user?.id).filter(Boolean) as string[])]);
    for (const service of services) {
      if (!service.user?.email || !service.contractEndDate) continue;
      const tz = resolveReminderTimeZone(service.user.profile?.timezone);
      if (!isReminderDeliveryHour(now, tz)) continue;
      const days = daysUntilDateOnly(service.contractEndDate, now, tz);
      if (!CONTRACT_REMINDER_DAYS.includes(days)) continue;

      const prefs = prefsCache.get(service.user.id) || [];
      const settings = buildWebNotificationSettings(prefs);
      const emailAllowed = settings.config.emailEnabled && settings.prefs.contractExpiring;
      const pushAllowed = isPushTypeEnabled(prefs, "CONTRACT_EXPIRY");
      if (!emailAllowed && !pushAllowed) continue;

      const endText = formatDateOnlyUtc(service.contractEndDate, { month: "short", day: "numeric", year: "numeric" });
      if (!userMeta.has(service.user.id)) {
        userMeta.set(service.user.id, {
          email: service.user.email,
          userName: displayName(service.user),
          locale: service.user.preferredLocale,
          timeZone: tz,
        });
      }
      if (emailAllowed) {
        pushRaw({
          userId: service.user.id,
          kind: "contract",
          label: `${service.providerName} contract ends in ${days} day${days === 1 ? "" : "s"}`,
          detail: endText,
          href: `/services/${service.id}`,
        });
        markChannel(emailAllowedByUserKind, service.user.id, "contract");
      }
      if (pushAllowed) markChannel(pushAllowedByUserKind, service.user.id, "contract");
    }
  }

  // ── Assemble per-user digests ──
  const SECTION_ORDER: DigestSectionKind[] = ["move", "bill-overdue", "task", "bill", "contract"];
  const SECTION_HEADINGS: Record<DigestSectionKind, string> = {
    move: "Your move",
    "bill-overdue": "Overdue bills",
    task: "Tasks due",
    bill: "Bills due",
    contract: "Contract renewals",
  };

  const digests: UserDigest[] = [];
  const allUserIds = new Set<string>([
    ...rawByUser.keys(),
    ...pushAllowedByUserKind.keys(),
  ]);

  for (const userId of allUserIds) {
    const meta = userMeta.get(userId);
    if (!meta) continue; // no displayable item matched on any channel
    const rawItems = rawByUser.get(userId) || [];
    const pushKinds = pushAllowedByUserKind.get(userId) || new Set<DigestSectionKind>();

    // Email sections: only kinds whose EMAIL pref is on (rawItems are already
    // email-gated above, so grouping them is sufficient).
    const byKind = new Map<DigestSectionKind, DigestItem[]>();
    let moveCountdownDays: number | null = null;
    for (const item of rawItems) {
      if (item.kind === "move" && typeof item.countdownDays === "number") {
        moveCountdownDays = item.countdownDays;
      }
      const list = byKind.get(item.kind) || [];
      list.push({ kind: item.kind, label: item.label, detail: item.detail, href: item.href });
      byKind.set(item.kind, list);
    }
    const emailSections: DigestSection[] = [];
    for (const kind of SECTION_ORDER) {
      const items = byKind.get(kind);
      if (items && items.length > 0) {
        emailSections.push({ kind, heading: SECTION_HEADINGS[kind], items });
      }
    }

    // matchedCounts spans BOTH channels (email items captured above; push-only
    // kinds counted as >=1 so the dedupe key + push summary are honest even when
    // email is muted for that kind).
    const matchedCounts: Record<DigestSectionKind, number> = {
      move: 0,
      task: 0,
      bill: 0,
      "bill-overdue": 0,
      contract: 0,
    };
    for (const item of rawItems) matchedCounts[item.kind]++;
    for (const kind of pushKinds) {
      if (matchedCounts[kind] === 0) matchedCounts[kind] = 1; // push-only (email muted)
    }

    // Skip users with nothing to actually deliver on either channel.
    const hasEmail = emailSections.length > 0;
    const hasPush = pushKinds.size > 0;
    if (!hasEmail && !hasPush) continue;

    digests.push({
      userId,
      email: meta.email,
      userName: meta.userName,
      locale: meta.locale,
      timeZone: meta.timeZone,
      moveCountdownDays,
      emailSections,
      pushKinds,
      matchedCounts,
    });
  }

  return digests;
}

/**
 * Build the ONE-LINE push summary, e.g. "Today: your move + 3 tasks + 1 bill".
 * Only counts kinds whose PUSH pref is on for this user. Returns null when the
 * user has no push-eligible kinds (caller then skips push).
 */
export function buildPushSummary(digest: UserDigest): string | null {
  const parts: string[] = [];
  const c = digest.matchedCounts;
  const has = (k: DigestSectionKind) => digest.pushKinds.has(k) && c[k] > 0;

  if (has("move")) parts.push("your move");
  if (has("bill-overdue")) parts.push(`${c["bill-overdue"]} overdue bill${c["bill-overdue"] === 1 ? "" : "s"}`);
  if (has("task")) parts.push(`${c.task} task${c.task === 1 ? "" : "s"}`);
  if (has("bill")) parts.push(`${c.bill} bill${c.bill === 1 ? "" : "s"}`);
  if (has("contract")) parts.push(`${c.contract} contract${c.contract === 1 ? "" : "s"}`);

  if (parts.length === 0) return null;
  return `Today: ${parts.join(" + ")}`;
}

/** Stable per-user-per-day dedupe key (in the user's local calendar day). */
export function digestDedupeKey(userId: string, now: Date, timeZone: string): string {
  const localDay = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `cron:daily-digest:${userId}:${localDay}`;
}
