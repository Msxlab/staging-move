import { NextResponse } from "next/server";
import { getRequiredRuntimeConfigValues } from "@/lib/runtime-config";

export const runtime = "nodejs";

export async function GET() {
  const values = await getRequiredRuntimeConfigValues([
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "APPLE_OAUTH_CLIENT_ID",
    "APPLE_OAUTH_TEAM_ID",
    "APPLE_OAUTH_KEY_ID",
    "APPLE_OAUTH_PRIVATE_KEY",
  ]);

  const googleConfigured = Boolean(
    values.GOOGLE_OAUTH_CLIENT_ID && values.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  const appleConfigured = Boolean(
    values.APPLE_OAUTH_CLIENT_ID &&
      values.APPLE_OAUTH_TEAM_ID &&
      values.APPLE_OAUTH_KEY_ID &&
      values.APPLE_OAUTH_PRIVATE_KEY,
  );

  if (process.env.NODE_ENV !== "production") {
    console.info("[OAUTH] provider status", { googleConfigured, appleConfigured });
  }

  return NextResponse.json({
    providers: {
      google: {
        configured: googleConfigured,
        label: "Google",
        message: googleConfigured
          ? "Google sign-in is ready."
          : "Google sign-in will stay disabled until OAuth client credentials are added.",
      },
      apple: {
        configured: appleConfigured,
        label: "Apple",
        message: appleConfigured
          ? "Apple sign-in is ready."
          : "Apple sign-in will stay disabled until Apple OAuth credentials are added.",
      },
    },
  });
}
