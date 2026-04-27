import { prisma } from "@/lib/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/user-auth";

export const MOBILE_OAUTH_CLIENT_COOKIE = "oauth_client";
export const MOBILE_OAUTH_REDIRECT_COOKIE = "oauth_mobile_redirect";

const MOBILE_OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MOBILE_REDIRECT_URIS = ["locateflow://oauth"];

function allowedMobileRedirectUris() {
  const configured = (process.env.MOBILE_OAUTH_REDIRECT_URIS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_MOBILE_REDIRECT_URIS;
}

export function normalizeMobileOAuthRedirectUri(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  return allowedMobileRedirectUris().includes(value) ? value : null;
}

export function isMobileOAuthClient(value: string | null | undefined) {
  return (value || "").toLowerCase() === "mobile";
}

export function buildMobileOAuthRedirectUrl(input: {
  redirectUri: string;
  code: string;
  provider: "google" | "apple";
}) {
  const url = new URL(input.redirectUri);
  url.searchParams.set("code", input.code);
  url.searchParams.set("provider", input.provider);
  return url;
}

export async function createMobileOAuthExchangeCode(input: {
  userId: string;
  provider: "google" | "apple";
  redirectUri: string;
}) {
  const { token, hash } = generateOpaqueToken();
  await prisma.mobileOAuthCode.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      redirectUri: input.redirectUri,
      codeHash: hash,
      expiresAt: new Date(Date.now() + MOBILE_OAUTH_CODE_TTL_MS),
    },
  });
  return token;
}

export type MobileOAuthExchangeResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
        emailVerifiedAt: Date | null;
        mfaEnabled: boolean;
      };
    }
  | { ok: false; error: "INVALID_CODE" | "EXPIRED_CODE" | "REPLAYED_CODE" | "ACCOUNT_UNAVAILABLE" };

export async function consumeMobileOAuthExchangeCode(code: string): Promise<MobileOAuthExchangeResult> {
  const codeHash = hashOpaqueToken(code);
  const record = await prisma.mobileOAuthCode.findUnique({
    where: { codeHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          imageUrl: true,
          emailVerifiedAt: true,
          mfaEnabled: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!record) return { ok: false, error: "INVALID_CODE" };
  if (record.usedAt) return { ok: false, error: "REPLAYED_CODE" };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, error: "EXPIRED_CODE" };
  if (!record.user || record.user.deletedAt) return { ok: false, error: "ACCOUNT_UNAVAILABLE" };

  const consumed = await prisma.mobileOAuthCode.updateMany({
    where: {
      id: record.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, error: "REPLAYED_CODE" };

  return {
    ok: true,
    user: {
      id: record.user.id,
      email: record.user.email,
      firstName: record.user.firstName,
      lastName: record.user.lastName,
      imageUrl: record.user.imageUrl,
      emailVerifiedAt: record.user.emailVerifiedAt,
      mfaEnabled: record.user.mfaEnabled,
    },
  };
}
