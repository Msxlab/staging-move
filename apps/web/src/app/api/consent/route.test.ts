import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    dataConsent: {
      create: vi.fn(),
    },
    profile: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { POST } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockDataConsent = (prisma as unknown as {
  dataConsent: { create: Mock };
}).dataConsent;
const mockProfile = (prisma as unknown as { profile: { updateMany: Mock } }).profile;
const mockTransaction = (prisma as unknown as { $transaction: Mock }).$transaction;

function postConsent(grants: Array<{ category: string; granted: boolean }>) {
  return POST(
    new Request("http://localhost/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grants }),
    }) as any,
  );
}

describe("consent POST sensitive-data lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockDataConsent.create.mockReturnValue("consent-create-op");
    mockProfile.updateMany.mockReturnValue("profile-clear-op");
    mockTransaction.mockResolvedValue([]);
  });

  it("clears stored sensitive profile fields when SENSITIVE consent is withdrawn", async () => {
    const response = await postConsent([{ category: "SENSITIVE", granted: false }]);

    expect(response.status).toBe(200);
    expect(mockProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: {
        hasDisability: false,
        isImmigrant: false,
        isMilitary: false,
        immigrationStatus: null,
      },
    });
    // The consent row and the profile clear must land in the same transaction.
    expect(mockTransaction).toHaveBeenCalledWith([
      "consent-create-op",
      "profile-clear-op",
    ]);
  });

  it("does not touch the profile when SENSITIVE consent is granted", async () => {
    const response = await postConsent([{ category: "SENSITIVE", granted: true }]);

    expect(response.status).toBe(200);
    expect(mockProfile.updateMany).not.toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalledWith(["consent-create-op"]);
  });

  it("does not touch the profile when an unrelated category is revoked", async () => {
    const response = await postConsent([{ category: "MARKETING", granted: false }]);

    expect(response.status).toBe(200);
    expect(mockProfile.updateMany).not.toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalledWith(["consent-create-op"]);
  });
});
