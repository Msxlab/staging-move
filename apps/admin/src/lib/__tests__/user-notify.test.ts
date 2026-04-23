import { describe, it, expect, beforeEach, vi } from "vitest";

const findUniqueUser = vi.fn();
const findFirstNotification = vi.fn();
const createNotification = vi.fn();
const findUniqueRuntimeConfigEntry = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => findUniqueUser(...args) },
    notification: {
      findFirst: (...args: unknown[]) => findFirstNotification(...args),
      create: (...args: unknown[]) => createNotification(...args),
    },
    runtimeConfigEntry: {
      findUnique: (...args: unknown[]) => findUniqueRuntimeConfigEntry(...args),
    },
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

import { notifyUserOfAdminChange } from "../user-notify";

describe("notifyUserOfAdminChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueUser.mockResolvedValue({ email: "alice@example.com", firstName: "Alice" });
    findFirstNotification.mockResolvedValue(null);
    createNotification.mockResolvedValue({ id: "notif_1" });
    findUniqueRuntimeConfigEntry.mockResolvedValue(null);
    sendEmail.mockResolvedValue(true);
  });

  it("skips entirely when there are no changes", async () => {
    await notifyUserOfAdminChange({
      userId: "u1",
      changes: {},
      actorAdminId: "a1",
    });
    expect(findUniqueUser).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("writes a Notification and sends an email when no recent notification exists", async () => {
    await notifyUserOfAdminChange({
      userId: "u1",
      changes: { plan: { from: "FREE_TRIAL", to: "FAMILY_MONTHLY" } },
      actorAdminId: "a1",
    });

    expect(createNotification).toHaveBeenCalledTimes(1);
    const arg = createNotification.mock.calls[0][0];
    expect(arg.data.userId).toBe("u1");
    expect(arg.data.type).toBe("ACCOUNT_UPDATED_BY_ADMIN");
    expect(arg.data.channel).toBe("EMAIL");
    expect(arg.data.body).toContain("FAMILY_MONTHLY");

    // sendEmail is fire-and-forget (void); allow the microtask to run.
    await new Promise((r) => setImmediate(r));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("alice@example.com");
  });

  it("debounces email when a recent notification already exists", async () => {
    findFirstNotification.mockResolvedValue({ id: "notif_old" });

    await notifyUserOfAdminChange({
      userId: "u1",
      changes: { firstName: { from: "Alice", to: "Alicia" } },
      actorAdminId: "a1",
    });

    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification.mock.calls[0][0].data.channel).toBe("IN_APP");
    await new Promise((r) => setImmediate(r));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no email on record", async () => {
    findUniqueUser.mockResolvedValue({ email: null, firstName: null });

    await notifyUserOfAdminChange({
      userId: "u1",
      changes: { firstName: { from: "A", to: "B" } },
      actorAdminId: "a1",
    });

    expect(createNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
