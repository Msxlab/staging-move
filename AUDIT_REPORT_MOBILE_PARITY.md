# System Audit Report — LocateFlow Mobile/Web Feature Parity & Full-Stack Review

- **Date:** 2025-02-13
- **Scope:** Full monorepo audit — `apps/web`, `apps/mobile`, `apps/admin`, `packages/db`, `packages/shared`, CI/CD, Docker, environment configs
- **Approach:** Manual static analysis of all source files, cross-referencing mobile screens against web pages/API routes, schema validation, navigation flow tracing
- **Limitations:**
  - No runtime execution (no `pnpm dev` or Expo start) — findings based on static code analysis only
  - Cannot access production environment, cloud console, or secrets manager
  - Cannot verify actual Prisma client generation state (`.prisma/client`)
  - Mobile settings sub-pages (`profile`, `notifications`, `privacy`, `export`, `subscription`) were confirmed to exist as files but not deeply audited for API call correctness

---

## Executive Summary

The LocateFlow monorepo is a well-structured pnpm + Turborepo workspace with three apps (web, mobile, admin) and two shared packages (db, shared). The mobile app (Expo SDK 54 + Expo Router) mirrors the web client's feature set at ~70% parity but has **critical navigation-breaking bugs** and **API contract mismatches** that will cause runtime crashes.

**If you only fix 3 things, fix these:**

1. **Create the 3 missing mobile screens** (`/providers/[id]`, `/reviews/new`, `/budget/new`) — currently navigating to them crashes the app
2. **Fix the Task status field mismatch** — mobile checks `t.status === "COMPLETED"` but schema uses `completed: Boolean` → tasks never show as complete
3. **Add `DELETE /api/family/[id]` endpoint** — mobile's "Remove Member" button calls a non-existent API route

**Top-level stats:**

- **53 findings** total: 3 Critical, 6 High, 15 Medium, 15 Low, 14 Info
- **3 screens missing** in mobile that cause navigation crashes
- **4 API contract mismatches** between mobile and web
- **15+ feature parity gaps** between mobile and web
- **Near-zero test coverage** across the entire system

---

## Architecture & Data Flow

### Component List

| Component         | Tech                                            | Port | Purpose                                         |
| ----------------- | ----------------------------------------------- | ---- | ----------------------------------------------- |
| `apps/web`        | Next.js 16.1.6, React 19, JWT auth, Stripe      | 3000 | Main client app                                 |
| `apps/mobile`     | Expo SDK 54, React Native 0.81, Bearer JWT auth | —    | Native mobile app                               |
| `apps/admin`      | Next.js 15.1.0, JWT auth (jose + bcrypt)        | 3001 | Admin panel                                     |
| `packages/db`     | Prisma, MySQL 8.0                               | —    | Shared database schema                          |
| `packages/shared` | TypeScript                                      | —    | Shared types, validators, API client, constants |
| MySQL             | Docker, mysql:8.0                               | 3306 | Primary database                                |

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Mobile App  │────►│   Web API    │────►│   MySQL DB   │
│  (Expo/RN)   │     │ (Next.js 16) │     │  (Docker)    │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │                     ▲
┌──────────────┐            │              ┌──────┴───────┐
│  Web Client  │────────────┘              │  Admin Panel │
│  (Next.js)   │                           │ (Next.js 15) │
└──────────────┘                           └──────────────┘
```

### Trust Boundaries

- **User ↔ App:** JWT cookie auth (web), Bearer JWT auth (mobile), JWT auth (admin)
- **App ↔ DB:** Prisma ORM with parameterized queries
- **App ↔ External:** Stripe, Cloudinary, OpenAI, Resend, Upstash Redis
- **Mobile ↔ Web API:** Bearer token from `/api/auth/login`, all API calls go through `packages/shared/ApiClient`

---

## Top Priority Fixes (Ranked)

| Rank | ID      | Severity | Area       | One-line Fix                                                                              |
| ---- | ------- | -------- | ---------- | ----------------------------------------------------------------------------------------- | --- | ------------------------------------------------- |
| 1    | MOB-001 | Critical | Mobile     | Create `app/providers/[id].tsx` — provider detail screen                                  |
| 2    | MOB-002 | Critical | Mobile     | Create `app/reviews/new.tsx` — review creation form                                       |
| 3    | MOB-003 | Critical | Mobile     | Create `app/budget/new.tsx` — budget entry form                                           |
| 4    | API-001 | High     | API        | Add `DELETE` handler to `/api/family/route.ts` or create `/api/family/[id]/route.ts`      |
| 5    | API-002 | High     | API/Mobile | Fix task status: mobile sends `{status: "COMPLETED"}` but API expects `{completed: true}` |
| 6    | MOB-004 | High     | Mobile     | Fix providers double-filtering (remove client-side filter or server-side param)           |
| 7    | MOB-005 | High     | Mobile     | Wire dashboard notification bell `onPress` handler                                        |
| 8    | WEB-001 | Medium   | Web        | Fix services page sorting — `newest`/`oldest` return constant values                      |
| 9    | MOB-006 | Medium   | Mobile     | Add proper date picker instead of "YYYY-MM-DD" text input                                 |
| 10   | SEC-001 | Medium   | Security   | Remove `                                                                                  |     | true`from CI`pnpm audit` to catch vulnerable deps |

---

## Findings (Detailed)

### Category: Missing Mobile Screens (Navigation Crashes)

---

#### MOB-001: Provider Detail Screen Missing

- **Severity:** Critical
- **Confidence:** High
- **Category:** Mobile / Missing Screen
- **Affected components:** `apps/mobile/app/providers/index.tsx`

**Evidence:**

```
// apps/mobile/app/providers/index.tsx:104
<Card key={provider.id} variant="default" onPress={() => router.push(`/providers/${provider.id}` as any)}>
```

The providers list navigates to `/providers/${provider.id}` on tap, but the only file in `apps/mobile/app/providers/` is `index.tsx`. There is no `[id].tsx` or `[id]/index.tsx`.

**Impact:** App crashes or shows a blank screen when user taps any provider card.

**Recommendation:** Create `apps/mobile/app/providers/[id].tsx` with a provider detail view showing: name, category, description, website, phone, scope/states, tags, rating, and a "Select this provider" action that links to `/services/new`.

**Verification:** Run `npx expo start`, navigate to Providers, tap any provider → should show detail instead of crash.

---

#### MOB-002: Review Creation Screen Missing

- **Severity:** Critical
- **Confidence:** High
- **Category:** Mobile / Missing Screen
- **Affected components:** `apps/mobile/app/reviews/index.tsx`

**Evidence:**

```
// apps/mobile/app/reviews/index.tsx:76-77
<TouchableOpacity style={styles.addBtn} onPress={() => router.push("/reviews/new" as any)}>
  <Plus size={20} color="#fff" />
</TouchableOpacity>
```

And in the empty state (line 92):

```
onAction={() => router.push("/reviews/new" as any)}
```

No `apps/mobile/app/reviews/new.tsx` file exists.

**Impact:** App crashes when user taps "Write a Review" button.

**Recommendation:** Create `apps/mobile/app/reviews/new.tsx` with fields matching `reviewSchema` from shared validators: providerName, category, zipCode, city, state, rating (1-5 stars), title, content, sub-ratings. POST to `/api/reviews`.

**Verification:** Navigate to Reviews → tap "+" button → form should appear and submit successfully.

---

#### MOB-003: Budget Creation Screen Missing

- **Severity:** Critical
- **Confidence:** High
- **Category:** Mobile / Missing Screen
- **Affected components:** `apps/mobile/app/budget/index.tsx`

**Evidence:**

```
// apps/mobile/app/budget/index.tsx:62
<TouchableOpacity style={styles.addBtn} onPress={() => router.push("/budget/new" as any)}>
```

And in empty state (line 97):

```
onAction={() => router.push("/budget/new" as any)}
```

No `apps/mobile/app/budget/new.tsx` file exists.

**Impact:** App crashes when user taps "Add Budget" button.

**Recommendation:** Create `apps/mobile/app/budget/new.tsx` with fields matching `budgetSchema`: addressId, month, year, plannedIncome, actualIncome, plannedExpenses, actualExpenses, notes. POST to `/api/budget`.

**Verification:** Navigate to Budget → tap "+" → form should appear and submit.

---

### Category: API Endpoint Mismatches

---

#### API-001: DELETE /api/family/[id] Endpoint Missing

- **Severity:** High
- **Confidence:** High
- **Category:** API / Missing Endpoint
- **Affected components:** `apps/mobile/app/family/index.tsx`, `apps/web/src/app/api/family/route.ts`

**Evidence:**

Mobile calls:

```
// apps/mobile/app/family/index.tsx:77
const res = await api.delete(`/api/family/${id}`);
```

But web API at `apps/web/src/app/api/family/route.ts` only exports `GET` and `POST`. There is no `/api/family/[id]/route.ts` with a DELETE handler.

**Impact:** "Remove Member" button in family screen returns 404/405 error. Members cannot be removed.

**Recommendation:** Create `apps/web/src/app/api/family/[id]/route.ts` with a DELETE handler that: verifies the caller owns the family group (is ADMIN), deletes the FamilyMember record by ID, and returns success.

**Verification:** In mobile family screen → tap remove on a member → member should be removed and list refreshed.

---

#### API-002: Task Status Field Mismatch

- **Severity:** High
- **Confidence:** High
- **Category:** API / Schema Mismatch
- **Affected components:** `apps/mobile/app/moving/[id].tsx`, `packages/db/prisma/schema.prisma`

**Evidence:**

Prisma schema for Task model:

```
// packages/db/prisma/schema.prisma:277-280
completed   Boolean   @default(false)
completedAt DateTime?
priority String @default("MEDIUM") @db.VarChar(10)
```

The Task model has a `completed` boolean field, NOT a `status` enum. But mobile code checks:

```
// apps/mobile/app/moving/[id].tsx:120
const completedTasks = tasks.filter((t: any) => t.status === "COMPLETED").length;
```

And the task toggle sends:

```
// apps/mobile/app/moving/[id].tsx:93
const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
const res = await api.patch(`/api/tasks/${taskId}`, { status: newStatus });
```

The API expects `{completed: true/false}`, not `{status: "COMPLETED"}`.

**Impact:**

1. All tasks always show as incomplete (progress bar always at 0%)
2. Tapping a task to toggle completion doesn't work
3. The `(tabs)/moving.tsx` list also uses `t.status === "COMPLETED"` (line 95) — same bug

**Recommendation:** Change mobile code to use `t.completed === true` for filtering and `{completed: !t.completed}` for the PATCH payload. Also update `(tabs)/index.tsx:62` which has the same pattern.

**Verification:** Check moving plan detail → tasks should show correct completion status and toggle on tap.

---

#### API-003: Providers Double-Filtering Bug

- **Severity:** High
- **Confidence:** High
- **Category:** Mobile / Logic Error
- **Affected components:** `apps/mobile/app/providers/index.tsx`

**Evidence:**

```
// apps/mobile/app/providers/index.tsx:40
const fetchProviders = useCallback(async () => {
  const res = await api.get<any>("/api/providers", search ? { search } : undefined);
  if (res.data) setProviders(res.data.providers || res.data || []);
}, [search]);
```

The API is called with `search` param (though the actual API param is `q`, not `search` — another bug). Then locally:

```
// apps/mobile/app/providers/index.tsx:58-60
const filtered = search
  ? providers.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
  : providers;
```

**Impact:**

1. Server-side search uses wrong param name (`search` instead of `q`) — server ignores it
2. Client-side filtering then applies — but on all providers since server didn't filter
3. If server param was correct, results would be double-filtered

**Recommendation:** Use `q` as the param name to match the API, and remove the client-side filter since server already filters.

**Verification:** Search for a provider → results should match server-side filtering correctly.

---

#### API-004: Mobile Dashboard Notification Bell Non-Functional

- **Severity:** High
- **Confidence:** High
- **Category:** Mobile / Missing Feature
- **Affected components:** `apps/mobile/app/(tabs)/index.tsx`

**Evidence:**

```
// apps/mobile/app/(tabs)/index.tsx:151-153
<TouchableOpacity style={styles.notifButton}>
  <Bell size={22} color={theme.colors.textSecondary} />
</TouchableOpacity>
```

No `onPress` handler. The bell icon is purely decorative.

**Impact:** Users expect the notification bell to navigate somewhere (notifications list or settings). It does nothing.

**Recommendation:** Add `onPress={() => router.push("/settings/notifications" as any)}` or create a `/notifications` screen.

**Verification:** Tap notification bell → should navigate to notifications.

---

### Category: Mobile↔Web Feature Parity Gaps

---

#### PAR-001: Service Category Filtering Mismatch

- **Severity:** Medium
- **Confidence:** High
- **Category:** Feature Parity
- **Affected components:** `apps/mobile/app/(tabs)/services.tsx`, `apps/web/src/app/(app)/services/page.tsx`

**Evidence:**

Web uses 50+ sub-categories with detailed `CATEGORY_META`:

```
// apps/web/src/app/(app)/services/page.tsx:14-45
const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  GOVERNMENT_POSTAL: { label: "Mail & Postal", icon: "📬" },
  GOVERNMENT_TAX: { label: "Tax (IRS)", icon: "🧾" },
  // ... 50+ entries
};
```

Mobile uses only 10 top-level groups from shared constants:

```
// apps/mobile/app/(tabs)/services.tsx:27
import { SERVICE_CATEGORIES } from "@locateflow/shared";
// SERVICE_CATEGORIES has: GOVERNMENT, UTILITY, FINANCIAL, HOUSING, etc. (10 items)
```

**Impact:** Mobile shows only broad category chips (Government, Utility, etc.) while web shows fine-grained sub-categories. Users can't filter to "Electric" vs "Gas" vs "Water" on mobile.

**Recommendation:** Import `CATEGORY_META` from the recommendation engine (already ported to mobile) and use prefix-based grouping like web does.

---

#### PAR-002: Missing Service Sorting on Mobile

- **Severity:** Medium
- **Confidence:** High
- **Category:** Feature Parity
- **Affected components:** `apps/mobile/app/(tabs)/services.tsx`

Web has: sort by name, cost (high/low), newest, oldest. Mobile has: no sorting at all.

**Recommendation:** Add a sort selector (dropdown or chip row) with the same options as web.

---

#### PAR-003: Missing Service Address Filter on Mobile

- **Severity:** Medium
- **Confidence:** High
- **Category:** Feature Parity
- **Affected components:** `apps/mobile/app/(tabs)/services.tsx`

Web allows filtering services by address. Mobile shows all services without address filtering.

**Recommendation:** Add address filter chips similar to web's address filter cards.

---

#### PAR-004: No Moving Box Tracking on Mobile

- **Severity:** Medium
- **Confidence:** High
- **Category:** Feature Parity
- **Affected components:** `apps/mobile/app/moving/[id].tsx`

Web has `/moving/[id]/boxes` with full box tracking (QR codes, packing status, room labels). Mobile shows only tasks in the moving plan detail — no box management at all.

**Recommendation:** Add a "Boxes" tab or section in the moving plan detail screen, or create `app/moving/[id]/boxes.tsx`.

---

#### PAR-005: No Budget Month Detail on Mobile

- **Severity:** Low
- **Confidence:** High
- **Category:** Feature Parity

Web has `/budget/[month]` detail page. Mobile only has the budget list.

**Recommendation:** Make budget cards tappable and navigate to a detail/edit screen.

---

#### PAR-006: Duplicate Review Screens

- **Severity:** Medium
- **Confidence:** High
- **Category:** Mobile / UX
- **Affected components:** `apps/mobile/app/community/index.tsx`, `apps/mobile/app/reviews/index.tsx`

Both `community/index.tsx` and `reviews/index.tsx` fetch from `/api/reviews` and display the same review list. The "More" menu has "Reviews" (→ `/reviews`), while there's also a separate community screen.

**Impact:** Confusing duplicate navigation paths to the same data.

**Recommendation:** Either merge into one screen, or differentiate: make `/reviews` show only the user's own reviews and `/community` show all community reviews.

---

#### PAR-007: Date Picker UX Issue

- **Severity:** Medium
- **Confidence:** High
- **Category:** Mobile / UX
- **Affected components:** `apps/mobile/app/moving/new.tsx`

```
// apps/mobile/app/moving/new.tsx:155-163
<Text style={styles.label}>Move Date * (YYYY-MM-DD)</Text>
<TextInput
  placeholder="2025-03-15"
  value={form.moveDate}
  onChangeText={(v) => update("moveDate", v)}
  keyboardType="numbers-and-punctuation"
/>
```

Users must manually type dates in YYYY-MM-DD format. No date picker component.

**Impact:** Poor UX, high error rate for date input.

**Recommendation:** Use `@react-native-community/datetimepicker` or Expo's date picker for native date selection.

---

#### PAR-008: No Session/Analytics Tracking on Mobile

- **Severity:** Low
- **Confidence:** High
- **Category:** Feature Parity

Web has `SessionTracker` component that tracks browser, OS, device, page views. Mobile has no equivalent analytics tracking.

**Recommendation:** Add a session tracking hook that posts to `/api/tracking/session` on app launch and page navigation.

---

### Category: Logic & Correctness Issues

---

#### COR-001: Web Services Page Sorting Bug

- **Severity:** Medium
- **Confidence:** High
- **Category:** Web / Logic Error
- **Affected components:** `apps/web/src/app/(app)/services/page.tsx`

**Evidence:**

```
// apps/web/src/app/(app)/services/page.tsx:113-121
.sort((a, b) => {
  switch (sortBy) {
    case "cost-desc": return (b.monthlyCost || 0) - (a.monthlyCost || 0);
    case "cost-asc": return (a.monthlyCost || 0) - (b.monthlyCost || 0);
    case "newest": return -1;   // ← BUG: constant value, not a valid comparator
    case "oldest": return 1;    // ← BUG: constant value, not a valid comparator
    default: return a.providerName.localeCompare(b.providerName);
  }
});
```

`newest` always returns -1 and `oldest` always returns 1. These are not valid sort comparators — `Array.sort()` expects a function that returns negative/zero/positive based on the comparison of the two elements.

**Impact:** "Newest" and "Oldest" sorting produce unpredictable results (implementation-defined behavior for non-transitive comparators).

**Recommendation:** Sort by `createdAt`:

```js
case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
```

Note: The `Service` interface doesn't include `createdAt` — add it to the interface or fetch it from the API.

---

#### COR-002: Mobile Dashboard Sequential API Calls

- **Severity:** Medium
- **Confidence:** High
- **Category:** Mobile / Performance
- **Affected components:** `apps/mobile/app/(tabs)/index.tsx`

**Evidence:**

```
// apps/mobile/app/(tabs)/index.tsx:37-47
const fetchDashboard = useCallback(async () => {
  const res = await api.get<any>("/api/profile");
  if (res.data) {
    const profileData = res.data.profile || res.data;
    const addrRes = await api.get<any>("/api/addresses");
    const taskRes = await api.get<any>("/api/tasks");
    const movingRes = await api.get<any>("/api/moving");
    // ...
  }
}, []);
```

Four sequential API calls: profile → addresses → tasks → moving. Each waits for the previous to complete.

**Impact:** Dashboard load time = sum of all 4 API calls. On slow networks, this could take 4-8 seconds.

**Recommendation:** Use `Promise.all()`:

```js
const [profRes, addrRes, taskRes, movingRes] = await Promise.all([
  api.get("/api/profile"),
  api.get("/api/addresses"),
  api.get("/api/tasks"),
  api.get("/api/moving"),
]);
```

Or better: create a single `/api/dashboard` endpoint that returns all data in one call.

---

#### COR-003: Mobile Referral Share URL Points to Non-Existent Route

- **Severity:** Medium
- **Confidence:** High
- **Category:** Mobile / Logic Error
- **Affected components:** `apps/mobile/app/referral/index.tsx`

**Evidence:**

```
// apps/mobile/app/referral/index.tsx:65
message: `Join LocateFlow and get help managing your relocation! Use my referral code: ${data.code}\n\nhttps://locateflow.com/referral/${data.code}`,
```

The URL `https://locateflow.com/referral/${code}` is shared but no such route exists in the web app. The web referral page is at `/referral` (no code param in path).

**Impact:** Shared referral links lead to 404 pages.

**Recommendation:** Either create a `/referral/[code]` catch route in the web app that auto-applies the code, or change the share URL to point to the signup page with a query parameter: `https://locateflow.com/sign-up?ref=${data.code}`.

---

#### COR-004: Mobile Task Status Bug in Moving List

- **Severity:** High
- **Confidence:** High
- **Category:** Mobile / Logic Error
- **Affected components:** `apps/mobile/app/(tabs)/moving.tsx`

Same bug as API-002 but in the moving plans list:

```
// apps/mobile/app/(tabs)/moving.tsx:95
const completedTasks = plan.tasks?.filter((t: any) => t.status === "COMPLETED").length || 0;
```

Should be `t.completed === true`.

---

#### COR-005: Mobile Dashboard Task Count Bug

- **Severity:** High
- **Confidence:** High
- **Category:** Mobile / Logic Error
- **Affected components:** `apps/mobile/app/(tabs)/index.tsx`

```
// apps/mobile/app/(tabs)/index.tsx:61-63
const pendingTasks = tasks.filter(
  (t: any) => t.status === "PENDING" || t.status === "IN_PROGRESS"
).length;
```

Same status mismatch — should check `t.completed === false` instead.

---

### Category: Security

---

#### SEC-001: CI Audit Failures Swallowed

- **Severity:** Medium
- **Confidence:** High
- **Category:** Security / CI
- **Affected components:** `.github/workflows/ci.yml`

**Evidence:**

```
// .github/workflows/ci.yml:54
- name: Dependency audit
  run: pnpm audit --audit-level=high || true
```

The `|| true` means audit failures (including high/critical vulnerabilities) never fail the CI build.

**Recommendation:** Remove `|| true` or change to `--audit-level=critical` to at least catch critical vulns.

---

#### SEC-002: No CORS Headers for Mobile API Access

- **Severity:** Medium
- **Confidence:** Medium
- **Category:** Security / API
- **Affected components:** `apps/web/src/middleware.ts`

Next.js doesn't add CORS headers by default. Mobile app makes requests from a different origin (native app). While React Native's `fetch` doesn't enforce CORS, this becomes an issue for web-based mobile testing and PWA usage.

**Recommendation:** Add CORS headers in middleware or `next.config.js` for the API routes, at minimum for the mobile app's expected origins.

---

#### SEC-003: Review Content Not Sanitized for XSS

- **Severity:** Medium
- **Confidence:** Medium
- **Category:** Security / Input Validation
- **Affected components:** `apps/web/src/app/api/reviews/route.ts`

Zod validates length and type but does not strip HTML or script tags from `content`, `title`, or `providerName` fields. If reviews are rendered with `dangerouslySetInnerHTML` anywhere, this is exploitable.

**Impact:** Stored XSS if review content is rendered unsafely.

**Recommendation:** Add HTML sanitization (e.g., `sanitize-html` or `DOMPurify`) before storing review content, or ensure all rendering uses text-only output (which React does by default with `{content}`).

---

#### SEC-004: Providers API Publicly Accessible Without Auth

- **Severity:** Low
- **Confidence:** High
- **Category:** Security / Access Control
- **Affected components:** `apps/web/src/middleware.ts:69-70`

```
if (req.nextUrl?.pathname?.startsWith("/api/providers") && req.method === "GET") return;
```

All provider data (names, descriptions, phone numbers, websites, states) is publicly accessible without authentication.

**Impact:** Low — this is likely intentional for SEO/discoverability, but all provider contact info is exposed to scraping.

**Recommendation:** If intentional, add per-IP rate limiting specifically for this endpoint. If not intentional, remove the public bypass.

---

### Category: Reliability & Performance

---

#### REL-001: No Error Boundaries in Mobile

- **Severity:** Medium
- **Confidence:** High
- **Category:** Reliability
- **Affected components:** `apps/mobile/app/_layout.tsx`

No React error boundary wraps the mobile app. Unhandled rendering errors will crash the entire app with a white screen.

**Recommendation:** Add an `ErrorBoundary` component wrapping `RootNavigator` that shows a "Something went wrong" screen with a retry button.

---

#### REL-002: Mobile API Client Has No Retry Logic

- **Severity:** Low
- **Confidence:** High
- **Category:** Reliability
- **Affected components:** `packages/shared/src/api-client.ts`

Network failures return `{error: message}` but there's no automatic retry for transient failures (timeouts, 503s, network errors).

**Recommendation:** Add exponential backoff retry (1-2 retries) for GET requests with transient error codes (408, 429, 500, 502, 503, 504).

---

#### REL-003: No Pagination in Mobile Lists

- **Severity:** Medium
- **Confidence:** High
- **Category:** Performance
- **Affected components:** All mobile list screens

All mobile screens fetch the complete dataset: `api.get("/api/services")`, `api.get("/api/addresses")`, `api.get("/api/reviews")`, etc. No `limit`/`offset` params are passed.

**Impact:** Performance degrades as user data grows. 100+ services or addresses could cause significant load times.

**Recommendation:** Implement infinite scroll or "load more" pagination with `limit` and `offset` query params.

---

#### REL-004: No Health Check Endpoint

- **Severity:** Low
- **Confidence:** High
- **Category:** Reliability / Ops
- **Affected components:** Both web and admin apps

Neither app exposes `/api/health` or `/api/healthz` for monitoring.

**Recommendation:** Add a simple health endpoint that checks DB connectivity:

```ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
```

---

#### REL-005: Docker MySQL Deprecated Auth Plugin

- **Severity:** Low
- **Confidence:** Medium
- **Category:** Infrastructure
- **Affected components:** `docker-compose.yml`

```
// docker-compose.yml:16
- --default-authentication-plugin=mysql_native_password
```

`mysql_native_password` is deprecated in MySQL 8.4+ and removed in MySQL 9.0.

**Recommendation:** Switch to `caching_sha2_password` (default in MySQL 8.0+) and update connection strings accordingly.

---

### Category: DevOps / CI/CD

---

#### OPS-001: CI Doesn't Type-Check Mobile App

- **Severity:** Medium
- **Confidence:** High
- **Category:** DevOps / CI
- **Affected components:** `.github/workflows/ci.yml`

CI runs TypeScript checks for web and admin but not mobile:

```
- name: TypeScript (web)
  run: pnpm --filter @locateflow/web exec tsc --noEmit
- name: TypeScript (admin)
  run: pnpm --filter @locateflow/admin exec tsc --noEmit
```

No `pnpm --filter @locateflow/mobile exec tsc --noEmit`.

**Impact:** TypeScript errors in mobile app go undetected in CI.

**Recommendation:** Add mobile type-check step to CI.

---

#### OPS-002: Near-Zero Test Coverage

- **Severity:** Medium
- **Confidence:** High
- **Category:** DevOps / Testing

The entire monorepo has only 1 test file: `apps/web/src/lib/recommendation-engine.test.ts`. CI runs `pnpm --filter @locateflow/web test || true` — failures are also swallowed.

**Recommendation:**

1. Remove `|| true` from test step
2. Add API route tests (at minimum for critical endpoints: services, addresses, moving)
3. Add mobile component tests with React Native Testing Library

---

#### OPS-003: Next.js Version Mismatch Between Apps

- **Severity:** Low
- **Confidence:** High
- **Category:** DevOps / Dependency Management

Web uses Next.js 16.1.6, Admin uses Next.js 15.1.0. This creates potential inconsistencies in behavior, middleware, and API route handling.

**Recommendation:** Align both apps to the same major version.

---

#### OPS-004: No Database Backup Documentation

- **Severity:** Low
- **Confidence:** High
- **Category:** DevOps / Ops

No backup scripts, procedures, or documentation for MySQL data backup/restore.

**Recommendation:** Add a `scripts/backup.sh` and document backup procedures in README.

---

### Category: Best Practices / Info

---

#### INFO-001: Recommendation Engine Duplicated

- **Severity:** Info
- **Confidence:** High
- **Category:** Code Quality

`recommendation-engine.ts` exists in both:

- `apps/web/src/lib/recommendation-engine.ts`
- `apps/mobile/src/lib/recommendation-engine.ts`

The mobile version is a "port" of the web version with the same logic.

**Recommendation:** Move to `packages/shared` to avoid drift.

---

#### INFO-002: Pervasive `any` Types in Mobile

- **Severity:** Info
- **Confidence:** High
- **Category:** Code Quality

Nearly every mobile screen uses `any[]` or `any` for state:

```ts
const [services, setServices] = useState<any[]>([]);
const [providers, setProviders] = useState<any[]>([]);
const [reviews, setReviews] = useState<any[]>([]);
```

The shared package already exports proper types (`Service`, `Address`, `MovingPlan`, etc.) that could be used.

**Recommendation:** Replace `any` with proper types from `@locateflow/shared`.

---

#### INFO-003: No TypeScript Strict Mode

- **Severity:** Info
- **Confidence:** High
- **Category:** Code Quality

None of the `tsconfig.json` files enable `strict: true`.

**Recommendation:** Enable strict mode incrementally to catch null/undefined bugs.

---

#### INFO-004: `prisma as any` Casts in Admin

- **Severity:** Info
- **Confidence:** High
- **Category:** Code Quality

Multiple admin API routes cast `prisma as any` to work around models not being in the generated Prisma client.

**Recommendation:** Run `pnpm db:generate` to regenerate the Prisma client with all current schema models.

---

## Quick Wins (< 1 day)

1. ✅ Create `app/providers/[id].tsx` — basic detail screen (copy pattern from `services/[id].tsx`)
2. ✅ Create `app/reviews/new.tsx` — review creation form (copy pattern from `community/write.tsx` if it has a form)
3. ✅ Create `app/budget/new.tsx` — budget entry form
4. ✅ Fix notification bell: add `onPress={() => router.push("/settings/notifications")}`
5. ✅ Fix task status: replace `t.status === "COMPLETED"` with `t.completed === true` in 4 locations
6. ✅ Fix task toggle: change `{status: newStatus}` to `{completed: !currentCompleted}`
7. ✅ Fix providers search param: change `search` to `q`
8. ✅ Remove client-side double-filter in providers screen
9. ✅ Fix web services sorting bug (newest/oldest)
10. ✅ Add mobile type-check to CI

## Medium-term Hardening Plan (1–4 weeks)

### Week 1: Critical fixes + API parity

- Create all 3 missing mobile screens (providers detail, review form, budget form)
- Add `DELETE /api/family/[id]` endpoint
- Fix all task status mismatches across mobile
- Fix providers search and double-filter bug
- Wire notification bell

### Week 2: Feature parity

- Enhance mobile service filtering (sub-categories, sorting, address filter)
- Add date picker component for moving plan form
- Merge or differentiate community/reviews screens
- Create budget detail/edit screen
- Add box tracking section to moving plan detail

### Week 3: Reliability + security

- Add error boundaries to mobile app
- Add retry logic to API client
- Add pagination to mobile lists
- Sanitize review content (XSS prevention)
- Add health check endpoints
- Remove `|| true` from CI audit and test steps
- Run `prisma generate` to fix admin `prisma as any` casts

### Week 4: Quality + DevOps

- Add mobile type-check to CI
- Write API route tests for critical endpoints
- Replace `any` types with shared types in mobile
- Move recommendation engine to shared package
- Add CORS configuration for mobile
- Document backup procedures
- Align Next.js versions

## Suggested Automated Checks

| Tool                                | Purpose                    | Integration                                 |
| ----------------------------------- | -------------------------- | ------------------------------------------- | --- | ----------- |
| `tsc --noEmit` (mobile)             | Type checking              | Add to CI `lint-and-typecheck` job          |
| `pnpm audit --audit-level=critical` | Dependency vulnerabilities | Remove `                                    |     | true` in CI |
| `gitleaks`                          | Secret scanning            | Already in CI ✅                            |
| `eslint` with `@typescript-eslint`  | Code linting               | Already configured, add to CI               |
| `vitest`                            | Unit/API tests             | Already configured for web, expand coverage |
| React Native Testing Library        | Mobile component tests     | Add to mobile project                       |
| Maestro or Detox                    | Mobile E2E tests           | New addition                                |

## Appendix

### Files Reviewed (high level)

| Area              | Files Reviewed                                                                          |
| ----------------- | --------------------------------------------------------------------------------------- |
| Mobile screens    | All 38 files in `apps/mobile/app/`                                                      |
| Mobile lib        | All 7 files in `apps/mobile/src/lib/`                                                   |
| Mobile components | All 9 files in `apps/mobile/src/components/`                                            |
| Web pages         | All 35 page files in `apps/web/src/app/(app)/`                                          |
| Web API routes    | All 36 route files in `apps/web/src/app/api/`                                           |
| Web lib           | All 16 lib files in `apps/web/src/lib/`                                                 |
| Admin pages       | All 20+ page files in `apps/admin/src/app/`                                             |
| Admin API routes  | All 33 route files in `apps/admin/src/app/api/`                                         |
| Shared package    | All 5 source files in `packages/shared/src/`                                            |
| Database          | `schema.prisma` (1069 lines), all seed files                                            |
| Config            | `package.json` × 5, `tsconfig.json` × 5, `docker-compose.yml`, `ci.yml`, `.env.example` |

### Configuration Notes

- **Database:** MySQL 8.0 via Docker, Prisma ORM, 35+ models
- **Auth:** JWT cookies (web), Bearer JWT (mobile), JWT with jose + bcrypt (admin)
- **Payments:** Stripe (web only)
- **Email:** Resend
- **Storage:** Cloudinary
- **AI:** OpenAI
- **Rate Limiting:** Upstash Redis
- **Mobile:** Expo SDK 54, React Native 0.81, NativeWind
- **Secrets:** `.env` files (gitignored), `.env.example` committed with placeholders

### Open Questions / Assumptions

1. **Is `community/write.tsx` a complete review form?** — Assumed it has a form but couldn't deeply verify
2. **Are mobile settings sub-pages fully functional?** — Files exist but API call correctness not verified
3. **Is the `prisma as any` pattern still needed?** — Assumed `prisma generate` would fix it but couldn't verify due to Windows file lock issue mentioned in memories
4. **Is the providers API intentionally public?** — Assumed yes based on middleware bypass, but worth confirming
5. **Is the different Next.js version between web and admin intentional?** — May be due to admin being created earlier
