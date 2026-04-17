# LocateFlow Mobile App

React Native (Expo) mobile app for LocateFlow — Android & iOS from a single codebase.

## Tech Stack

- **Expo SDK 52** + Expo Router v4 (file-based navigation)
- **NativeWind v4** (TailwindCSS for React Native)
- **Clerk Expo** (authentication — same user pool as web)
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
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:3000/api
```

> **Note:** Use your machine's local IP (not `localhost`) for the API URL when testing on a physical device.

## Building

```bash
# Android APK (for testing)
eas build -p android --profile preview

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
├── (auth)/           # Sign In / Sign Up
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
└── _layout.tsx       # Root layout (Clerk, theme)

src/
├── components/ui/    # Reusable UI components
├── lib/              # API client, auth, theme, haptics
├── store/            # Zustand stores
└── styles/           # Global CSS (NativeWind)
```

## Shared Code

The app uses `@locateflow/shared` package for:
- Zod validators (same as web)
- TypeScript types
- Constants (categories, states, colors)
- API client base class
