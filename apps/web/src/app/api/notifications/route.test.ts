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
