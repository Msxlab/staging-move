import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    notificationPreference: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { GET, POST } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockPref = (prisma as unknown as {
  notificationPreference: { upsert: Mock; findMany: Mock };
}).notificationPreference;

function postConfig(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as any,
  );
}

function frequencyForType(type: string): string | undefined {
  const call = mockPref.upsert.mock.calls.find(
    ([arg]) => arg?.where?.userId_channel_type?.type === type,
  );
  return call?.[0]?.create?.frequency;
}

describe("notification prefs POST config normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockPref.upsert.mockResolvedValue({});
    mockPref.findMany.mockResolvedValue([]);
  });

  it("coerces an out-of-range digestDay and reminderDays to safe defaults before storing", async () => {
    const response = await postConfig({ digestDay: "Funday", reminderDays: "999" });

    expect(response.status).toBe(200);
    expect(frequencyForType("WEEKLY_DIGEST_DAY")).toBe("Monday");
    expect(frequencyForType("BILL_REMINDER_LEAD_TIME")).toBe("3");
  });

  it("stores valid digestDay and reminderDays values unchanged", async () => {
    const response = await postConfig({ digestDay: "Wednesday", reminderDays: "7" });

    expect(response.status).toBe(200);
    expect(frequencyForType("WEEKLY_DIGEST_DAY")).toBe("Wednesday");
    expect(frequencyForType("BILL_REMINDER_LEAD_TIME")).toBe("7");
  });

  it("never lets an oversized digestDay reach the VarChar(20) frequency column", async () => {
    const response = await postConfig({ digestDay: "x".repeat(500) });

    expect(response.status).toBe(200);
    const stored = frequencyForType("WEEKLY_DIGEST_DAY");
    expect(stored).toBe("Monday");
    expect((stored ?? "").length).toBeLessThanOrEqual(20);
  });

  it("returns an auth gate response instead of a generic 500 when unauthenticated", async () => {
    mockRequireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(mockPref.findMany).not.toHaveBeenCalled();
  });
});

describe("notification prefs web PUSH opt-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockPref.upsert.mockResolvedValue({});
    mockPref.findMany.mockResolvedValue([]);
  });

  function pushUpsertFor(type: string) {
    return mockPref.upsert.mock.calls.find(
      ([arg]) =>
        arg?.where?.userId_channel_type?.channel === "PUSH" &&
        arg?.where?.userId_channel_type?.type === type,
    )?.[0];
  }

  it("writes a PUSH opt-out row when a pushXxx key is sent", async () => {
    const response = await postConfig({ pushBillReminder: false });

    expect(response.status).toBe(200);
    const call = pushUpsertFor("BILL_REMINDER");
    expect(call).toBeTruthy();
    expect(call.create.channel).toBe("PUSH");
    expect(call.create.enabled).toBe(false);
    expect(call.update.enabled).toBe(false);
  });

  it("does not touch any PUSH row when no pushXxx key is sent", async () => {
    const response = await postConfig({ billReminder: true });

    expect(response.status).toBe(200);
    const anyPush = mockPref.upsert.mock.calls.some(
      ([arg]) => arg?.where?.userId_channel_type?.channel === "PUSH",
    );
    expect(anyPush).toBe(false);
  });

  it("reports push prefs default-on, and off after an explicit opt-out row", async () => {
    // No stored rows → every push toggle resolves on (default-on).
    let response = await GET();
    let body = await response.json();
    expect(response.status).toBe(200);
    expect(body.push.pushBillReminder).toBe(true);

    // Explicit disabled PUSH row → that type resolves off.
    mockPref.findMany.mockResolvedValueOnce([
      { channel: "PUSH", type: "BILL_REMINDER", enabled: false, frequency: "IMMEDIATE" },
    ]);
    response = await GET();
    body = await response.json();
    expect(body.push.pushBillReminder).toBe(false);
    expect(body.push.pushMoveUpdate).toBe(true);
  });
});
