# LocateFlow Mobile App

React Native (Expo) mobile app for LocateFlow — Android & iOS from a single codebase.

## Tech Stack

- **Expo SDK 54** + Expo Router v6 (file-based navigation)
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

```bash
# Android APK (for testing)
eas build -p android --profile staging-preview

# Android AAB (for Google Play)
eas build -p android --profile production

# iOS (for App Store)
eas build -p ios --profile production

# Submit to stores
eas submit -p android
eas submit -p ios
```

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
├── settings/         # Settings screens
├── providers/        # Provider search & detail
├── badges/           # Badge collection
├── assistant/        # AI chat assistant
└── _layout.tsx       # Root layout (auth hydration, theme, routing)

src/
├── components/ui/    # Reusable UI components
├── hooks/            # React Query data hooks
├── lib/              # API client, auth-store, theme, haptics, push
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
