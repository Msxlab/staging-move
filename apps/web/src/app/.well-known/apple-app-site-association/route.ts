import { NextResponse } from "next/server";

/**
 * Apple App Site Association (AASA) for Universal Links.
 *
 * Served at /.well-known/apple-app-site-association with the canonical
 * Content-Type `application/json` and no redirects (Apple's CDN fetches
 * this exactly once after install and won't follow 301/302). The bundle
 * identifier matches `apps/mobile/app.json` -> `ios.bundleIdentifier`.
 *
 * IMPORTANT: replace `APPLE_TEAM_ID` with the 10-character Apple Developer
 * team ID for the LocateFlow App Store Connect account. Setting the env var
 * `APPLE_TEAM_ID` (or `NEXT_PUBLIC_APPLE_TEAM_ID` for local previews) keeps
 * the value out of source control. Until the real team ID is supplied the
 * payload returns a placeholder that App Review will reject — this is
 * intentional so a build cannot ship with a fake but plausible value.
 */
const BUNDLE_ID = "com.locateflow.mobile";

const PATHS = [
  "/blog/*",
  "/mobile/oauth",
  "/mobile/oauth/*",
  "/reset-password",
  "/reset-password/*",
];

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  const teamId =
    process.env.APPLE_TEAM_ID ||
    process.env.NEXT_PUBLIC_APPLE_TEAM_ID ||
    "TEAMID-TODO";

  const appID = `${teamId}.${BUNDLE_ID}`;

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appID,
          appIDs: [appID],
          paths: PATHS,
          components: PATHS.map((path) => ({ "/": path, comment: "LocateFlow universal link" })),
        },
      ],
    },
    webcredentials: {
      apps: [appID],
    },
  };

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
