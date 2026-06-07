import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminSetPasswordToken: {
      updateMany: (...args: unknown[]) => mocks.updateMany(...args),
      create: (...args: unknown[]) => mocks.create(...args),
      findUnique: (...args: unknown[]) => mocks.findUnique(...args),
    },
  },
}));

import {
  sha256Hex,
  generateInviteToken,
  safeHashEqual,
  issueSetPasswordToken,
  resolveSetPasswordToken,
  consumeSetPasswordToken,
} from "./admin-invite";

describe("admin-invite token primitives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.create.mockResolvedValue({});
  });

  it("generates a high-entropy token whose hash matches sha256(token)", () => {
    const { token, tokenHash } = generateInviteToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(tokenHash).toBe(sha256Hex(token));
    // two generations differ
    expect(generateInviteToken().token).not.toBe(token);
  });

  it("safeHashEqual is true for equal hashes and false otherwise", () => {
    const a = sha256Hex("x");
    expect(safeHashEqual(a, a)).toBe(true);
    expect(safeHashEqual(a, sha256Hex("y"))).toBe(false);
    expect(safeHashEqual(a, "short")).toBe(false);
  });

  it("issueSetPasswordToken supersedes prior tokens and stores only the hash", async () => {
    const { token } = await issueSetPasswordToken({ adminUserId: "admin_2", createdBy: "admin_1" });
    // supersede call
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { adminUserId: "admin_2", purpose: "INVITE", consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    // create stores tokenHash, never the plaintext
    const createArg = mocks.create.mock.calls[0][0];
    expect(createArg.data.tokenHash).toBe(sha256Hex(token));
    expect(JSON.stringify(createArg.data)).not.toContain(token);
  });

  it("resolveSetPasswordToken rejects unknown, consumed, and expired tokens", async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    expect(await resolveSetPasswordToken("a".repeat(43))).toBeNull();

    mocks.findUnique.mockResolvedValueOnce({
      id: "t1",
      adminUserId: "admin_2",
      purpose: "INVITE",
      expiresAt: new Date(Date.now() + 10_000),
      consumedAt: new Date(),
    });
    expect(await resolveSetPasswordToken("a".repeat(43))).toBeNull();

    mocks.findUnique.mockResolvedValueOnce({
      id: "t1",
      adminUserId: "admin_2",
      purpose: "INVITE",
      expiresAt: new Date(Date.now() - 10_000),
      consumedAt: null,
    });
    expect(await resolveSetPasswordToken("a".repeat(43))).toBeNull();
  });

  it("consumeSetPasswordToken returns the row only when it wins the consume race", async () => {
    const valid = {
      id: "t1",
      adminUserId: "admin_2",
      purpose: "INVITE",
      expiresAt: new Date(Date.now() + 10_000),
      consumedAt: null,
    };
    // first call: resolve sees a valid row, updateMany flips exactly one
    mocks.findUnique.mockResolvedValue(valid);
    mocks.updateMany.mockResolvedValueOnce({ count: 1 });
    const won = await consumeSetPasswordToken("a".repeat(43));
    expect(won?.adminUserId).toBe("admin_2");

    // second call: lost the race (already consumed by the concurrent winner)
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });
    const lost = await consumeSetPasswordToken("a".repeat(43));
    expect(lost).toBeNull();
  });
});
