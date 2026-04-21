---
name: locateflow-design
description: Use this skill to generate well-branded interfaces and assets for LocateFlow, either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files (`colors_and_type.css`, `assets/`, `preview/`, `ui_kits/web/`, `ui_kits/mobile/`, `reference/codebase/`).

LocateFlow is a dark-first, single-accent (orange `#F97316`) product that tracks every service tied to a home — utilities, banks, insurance, subscriptions — and turns a move into a one-click relocation checklist. The mobile app (Expo/React Native, NativeWind) is the primary surface; web (Next.js + shadcn) mirrors the same tokens.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets from `assets/` and link `colors_and_type.css`, then build static HTML. If working on production code, read `reference/codebase/` for the real components and match them exactly — don't improvise.

If the user invokes this skill without other guidance, ask what they want to build, ask clarifying questions (web vs mobile vs admin; marketing vs in-app; dark vs light), and act as an expert designer who outputs HTML artifacts or production code.
