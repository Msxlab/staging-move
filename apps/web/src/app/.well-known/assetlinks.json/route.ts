import { NextResponse } from "next/server";

/**
 * Digital Asset Links (assetlinks.json) for Android App Links autoVerify.
 *
 * Served at /.well-known/assetlinks.json with Content-Type `application/json`.
 * Android verifies this on app install when the manifest declares
 * `android:autoVerify="true"` for an intent-filter that targets one of these
 * hosts. The package name matches `apps/mobile/app.json` -> `android.package`.
 *
 * IMPORTANT: the SHA-256 fingerprint(s) below must include EVERY signing key
 * used to ship the production AAB:
 *   - The Play App Signing key (from Play Console -> Setup -> App integrity).
 *   - The upload key (if it differs from the App Signing key).
 *   - The debug key only if you want app-links to verify in debug builds.
 *
 * Provide fingerprints via the `ANDROID_APP_FINGERPRINTS` env var as a
 * comma-separated list of `AA:BB:CC:...` strings. The placeholder below is
 * intentionally invalid so a deploy without the real value fails verification
 * loudly instead of silently breaking deep links.
 */
const PACKAGE_NAME = "com.locateflow.mobile";

const PLACEHOLDER_FINGERPRINT =
  "AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA:AA";

function parseFingerprints(raw: string | undefined | null): string[] {
  if (!raw) return [PLACEHOLDER_FINGERPRINT];
  const parts = raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 ? parts : [PLACEHOLDER_FINGERPRINT];
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  const fingerprints = parseFingerprints(process.env.ANDROID_APP_FINGERPRINTS);

  const body = [
    {
      relation: [
        "delegate_permission/common.handle_all_urls",
        "delegate_permission/common.get_login_creds",
      ],
      target: {
        namespace: "android_app",
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
