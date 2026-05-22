# LocateFlow Mobile App

React Native (Expo) mobile app for LocateFlow — Android & iOS from a single codebase.

## Tech Stack

- **Expo SDK 55** + Expo Router v6 (file-based navigation)
- **NativeWind v4** (TailwindCSS for React Native)
- **Custom JWT auth** (Bearer token from `/api/auth/login`, stored in Expo SecureStore)
- **Zustand** (state management)
- **React Hook Form + Zod** (form validation — shared with web)
- **Lucide React Native** (icons)

## Getting Started

```bash
# From monorepo root
pnpm install

# Start Expo dev server
pnpm mobile:dev

# Or from this directory
npx expo start
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000/api
EXPO_PUBLIC_APP_URL=http://YOUR_LOCAL_IP:3000
```

> **Note:** Use your machine's local IP (not `localhost`) for the API URL when testing on a physical device.

## Building

Run EAS from `apps/mobile` so it uses this app's `app.json`, `eas.json`,
bundle identifier, package name, and EAS project ID. From the monorepo root,
use the `pnpm mobile:*` scripts or `pnpm --dir apps/mobile ...`.

The iOS bundle identifier is `com.locateflow.mobile`. Keep App Store Connect,
Apple capabilities, IAP runtime config, and backend Apple receipt validation on
that same identifier unless you intentionally migrate all of them together.

On this Windows machine, Expo/EAS API calls may need Node to use the system
certificate store:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
```

```bash
# Android APK (for testing)
eas build -p android --profile staging-preview

# Android AAB (for Google Play)
eas build -p android --profile production

# iOS (for App Store)
eas build -p ios --profile production

# iOS TestFlight guided flow
npx testflight

# iOS TestFlight via explicit EAS build + submit
eas build -p ios --profile production --auto-submit --what-to-test "Initial internal TestFlight build"

# Submit to stores
eas submit -p android
eas submit -p ios
```

## EAS Update

OTA updates are enabled through `expo-updates` and EAS Update. Build profiles
publish against these channels:

- `preview` and `staging-preview` use the `preview` channel.
- `production` and `play-internal` use the `production` channel.

```bash
# Publish a preview OTA update
pnpm mobile:update:preview -- --message "Describe the update"

# Publish a production OTA update
pnpm mobile:update:production -- --message "Describe the update"
```

Only ship JavaScript, styling, and asset changes through OTA. Native dependency,
permission, bundle identifier, app.json native config, or Expo SDK changes need
a new EAS build before they can receive compatible updates. The current mobile
runtime is `sdk55-1.0.0`; do not publish SDK 55 JavaScript to older SDK 54
runtime builds.

## Project Structure

```
app/                  # Expo Router screens
├── (auth)/           # Sign In / Sign Up / OAuth handoff
├── (tabs)/           # Main tab navigator
│   ├── index.tsx     # Dashboard
│   ├── addresses.tsx # Addresses list
│   ├── moving.tsx    # Moving plans
│   ├── services.tsx  # Services list
│   └── more.tsx      # Settings & features menu
├── onboarding.tsx    # New user onboarding wizard
├── addresses/        # Address detail / new / edit
├── blog/             # Blog index + post detail (deep link target)
├── budget/           # Budget tracking
├── custom-providers/ # User-defined providers
├── help/             # Help center + support tickets
├── moving/           # Moving plan detail / new
├── notifications/    # Notification inbox
├── providers/        # Provider search & detail
├── services/         # Service detail / new / edit
├── settings/         # Settings screens
└── _layout.tsx       # Root layout (auth hydration, theme, routing)

src/
├── components/       # AnimatedSplash, SessionTracker, ui/, address/, legal/, provider/
├── hooks/            # React Query data hooks
├── i18n/             # i18next config + en/es message catalogs
├── lib/              # API client, auth-store, iap, push, sentry, theme, haptics
├── store/            # Zustand stores (app-level)
└── styles/           # Global styling helpers
```

## Authentication

- The web app issues a JWT at `/api/auth/login`.
- Mobile stores that token in Expo SecureStore.
- All authenticated API calls send `Authorization: Bearer <token>` via the shared API client.
- `refreshUser()` hydrates the signed-in user via `/api/auth/me`.

## Shared Code

The app uses `@locateflow/shared` package for:

- Zod validators (same as web)
- TypeScript types
- Constants (categories, states, colors)
- API client base class
