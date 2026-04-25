# OAuth Setup Checklist

Purpose: enable live Google and Apple sign-in for staging without weakening legal acknowledgement, account security, or disabled-state behavior.

OAuth remains optional for staging. If credentials are missing, web and mobile should show honest disabled/unavailable social sign-in states and email/password auth remains available.

## Current Product Rules

- First-time OAuth signup must require Terms of Use and Legal Disclaimer acknowledgement.
- Existing OAuth users can sign in through linked provider subject IDs.
- OAuth-only users can set a password in account security.
- Safe email-change and social link/unlink are not launch-ready.
- Do not expose fake email-change or social link/unlink actions.

## Google Staging Setup

Google Cloud Console:

- Create or reuse OAuth 2.0 Client ID for web.
- Authorized JavaScript origin: `https://locateflow-web-staging.vercel.app`
- Authorized redirect URI: `https://locateflow-web-staging.vercel.app/api/auth/oauth/google/callback`

Production later:

- Authorized JavaScript origin: production app URL.
- Authorized redirect URI: `<production-app-url>/api/auth/oauth/google/callback`

Vercel web staging env:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL=https://locateflow-web-staging.vercel.app`

Expected tests:

- Without credentials, Google sign-in disabled/unavailable.
- With credentials, first-time Google signup cannot proceed without legal acknowledgement.
- Existing Google-linked user can sign in.
- OAuth-only Google user can set a password.

## Apple Staging Setup

Apple Developer:

- Create or reuse a Services ID for web sign-in.
- Configure return URL: `https://locateflow-web-staging.vercel.app/api/auth/oauth/apple/callback`
- Create Sign in with Apple key.
- Record Team ID, Key ID, Services ID, and private key.

Production later:

- Add production return URL: `<production-app-url>/api/auth/oauth/apple/callback`

Vercel web staging env:

- `APPLE_OAUTH_CLIENT_ID`
- `APPLE_OAUTH_TEAM_ID`
- `APPLE_OAUTH_KEY_ID`
- `APPLE_OAUTH_PRIVATE_KEY`
- `NEXT_PUBLIC_APP_URL=https://locateflow-web-staging.vercel.app`

Expected tests:

- Without credentials, Apple sign-in disabled/unavailable.
- With credentials, first-time Apple signup cannot proceed without legal acknowledgement.
- Existing Apple-linked user can sign in.
- OAuth-only Apple user can set a password.

## Mobile OAuth Notes

Current mobile social sign-in hands off to web OAuth routes. It does not add native Google/Apple token exchange in this pass.

Mobile preview requires:

- `EXPO_PUBLIC_API_URL=https://locateflow-web-staging.vercel.app/api`
- Staging OAuth routes reachable from device.
- Legal acknowledgement UI tested before social account creation.

## QA Checklist

- [ ] Email/password signup still works.
- [ ] OAuth disabled state works with blank credentials.
- [ ] Google staging OAuth callback works.
- [ ] Apple staging OAuth callback works.
- [ ] First-time social signup requires legal acknowledgement.
- [ ] Existing social account sign-in works.
- [ ] OAuth-only set-password works.
- [ ] Email change/social link-unlink are unavailable or clearly marked unavailable.
