import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/shared-encryption";
import { verifyBackupCode, verifyTOTP } from "@/lib/totp";
import { verifyPassword } from "@/lib/user-auth";

export type UserStepUpFailureCode =
  | "STEP_UP_REQUIRED"
  | "INVALID_STEP_UP"
  | "STEP_UP_METHOD_UNAVAILABLE";

export type UserStepUpResult =
  | { ok: true; method: "password" | "mfa" | "backup_code" }
  | { ok: false; code: UserStepUpFailureCode; message: string };

export async function verifyUserStepUp(input: {
  userId: string;
  confirmPassword?: string | null;
  mfaCode?: string | null;
  backupCode?: string | null;
}): Promise<UserStepUpResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      passwordHash: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaBackupCodes: true,
    },
  });
  if (!user) {
    return { ok: false, code: "STEP_UP_REQUIRED", message: "Re-authentication is required." };
  }

  const confirmPassword = input.confirmPassword?.trim();
  if (confirmPassword && user.passwordHash && await verifyPassword(confirmPassword, user.passwordHash)) {
    return { ok: true, method: "password" };
  }

  const mfaCode = input.mfaCode?.trim();
  if (mfaCode && user.mfaEnabled && user.mfaSecret) {
    const secret = decrypt(user.mfaSecret);
    if (secret && verifyTOTP(secret, mfaCode)) {
      return { ok: true, method: "mfa" };
    }
  }

  const backupCode = input.backupCode?.trim();
  if (backupCode && user.mfaEnabled && user.mfaBackupCodes) {
    const originalBackupCodes = user.mfaBackupCodes || "[]";
    let storedHashes: string[] = [];
    try {
      const decoded = JSON.parse(originalBackupCodes);
      if (Array.isArray(decoded)) storedHashes = decoded.filter((item) => typeof item === "string");
    } catch {
      storedHashes = [];
    }
    const matchIndex = await verifyBackupCode(backupCode, storedHashes);
    if (matchIndex >= 0) {
      storedHashes.splice(matchIndex, 1);
      const consumed = await prisma.user.updateMany({
        where: { id: user.id, mfaBackupCodes: originalBackupCodes },
        data: { mfaBackupCodes: JSON.stringify(storedHashes) },
      });
      if (consumed.count === 1) {
        return { ok: true, method: "backup_code" };
      }
    }
  }

  if (!confirmPassword && !mfaCode && !backupCode) {
    return {
      ok: false,
      code: "STEP_UP_REQUIRED",
      message: "Enter your password or a valid MFA code before deleting your account.",
    };
  }

  if (!user.passwordHash && !user.mfaEnabled) {
    return {
      ok: false,
      code: "STEP_UP_METHOD_UNAVAILABLE",
      message: "Set a password or enable MFA before deleting your account.",
    };
  }

  return {
    ok: false,
    code: "INVALID_STEP_UP",
    message: "Password or MFA verification failed.",
  };
}
