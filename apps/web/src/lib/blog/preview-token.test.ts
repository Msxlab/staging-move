import { describe, expect, it } from "vitest";
import { signPreviewToken, verifyPreviewToken } from "./preview-token";

describe("preview token", () => {
  it("round-trips a signed claim", async () => {
    const token = await signPreviewToken({ postId: "post_1", adminId: "admin_1" });
    const verified = await verifyPreviewToken(token);
    expect(verified).toEqual({ postId: "post_1", adminId: "admin_1" });
  });

  it("rejects a tampered token", async () => {
    const token = await signPreviewToken({ postId: "post_1", adminId: "admin_1" });
    const tampered = `${token.slice(0, -3)}XXX`;
    expect(await verifyPreviewToken(tampered)).toBeNull();
  });

  it("rejects gibberish", async () => {
    expect(await verifyPreviewToken("not-a-token")).toBeNull();
    expect(await verifyPreviewToken("")).toBeNull();
  });

  it("rejects a token signed with a different audience", async () => {
    // Mint a token with the user JWT secret to confirm the audience
    // and signature gate prevents cross-token reuse.
    const { SignJWT } = await import("jose");
    const stranger = await new SignJWT({ postId: "post_1", adminId: "admin_1" })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("not-blog-preview")
      .setIssuer("locateflow-admin")
      .setExpirationTime("10m")
      .setIssuedAt()
      .sign(new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!));
    expect(await verifyPreviewToken(stranger)).toBeNull();
  });
});
