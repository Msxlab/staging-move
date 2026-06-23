# Module Audit: Budget & Expenses

> READ-ONLY audit. Evidence cited from source only. Paths are relative to repo root
> `staging-move/`. Items that cannot be confirmed from code are marked
> `[needs verification]`.

## 1. Module Summary

The Budget & Expenses module lets a user (or shared workspace) plan monthly
spending limits, project committed/one-time service costs for a given month +
address scope, log the REAL per-month actual cost of each service
(`ServiceCostLog`), and see a substantiated "real savings" reconciliation
(estimate vs actual). It also powers the Pro "Tax & Property" export
(`buildTaxReportData`) and a small VIN-decode helper used by the move checklist
(`/api/vehicles/decode`). The numeric engine is centralized in
`packages/shared/src/budget-planning.ts` (single source of truth, re-exported by
`apps/web/src/lib/budget-planning.ts`), so web and mobile compute identically.

Money-layer correctness is generally strong: per-cycle normalization, per-month
cost logs as the source of truth, savings only substantiated over logged lines,
and `Math.round(x*100)/100` rounding on persisted snapshots. The notable gaps
are: (1) the `/budget/[month]` server page ignores workspace scoping AND omits
`deletedAt: null`, so it can render soft-deleted budgets and never shows the
shared workspace budget; (2) a client can override `actualExpenses` on the saved
snapshot independently of the server-computed `savingsRate`, producing an
internally inconsistent persisted row; (3) several float/precision and
empty-state edge cases in the UI.

## 2. Related Files

- `packages/shared/src/budget-planning.ts` — engine: cycle math, projection plan,
  actuals reconciliation, category mapping, limit parsing.
- `apps/web/src/lib/budget-planning.ts` — thin re-export of the shared engine.
- `apps/web/src/lib/budget-actuals-snapshot.ts` — snapshot scope key, per-month
  service select, `resolveBudgetActualsForMonth`, `refreshBudgetSnapshotsForServiceMonth`.
- `apps/web/src/lib/tax-report-data.ts` — canonical Pro tax/property report builder.
- `apps/web/src/app/api/budget/route.ts` — GET summary + POST upsert budget.
- `apps/web/src/app/api/budget/actuals/route.ts` — GET per-month actuals + POST log/clear.
- `apps/web/src/app/api/vehicles/decode/route.ts` — VIN decode + recalls (move helper).
- `apps/web/src/app/(app)/budget/page.tsx` — main client budget dashboard.
- `apps/web/src/app/(app)/budget/[month]/page.tsx` — server drill-in for one month.
- `apps/web/src/app/expenses/page.tsx` — redirect-only to `/budget`.
- `apps/mobile/app/budget/{index,new,[id]}.tsx` — mobile budget surfaces.
- `apps/web/src/lib/validators.ts` (`budgetSchema`) — POST body validation.
- `apps/web/src/lib/service-active.ts` — active-tracked service WHERE helpers.
- `apps/web/src/lib/workspace-data-scope.ts` — scope resolution + RBAC asserts.
- `apps/web/src/app/api/export/route.ts`, `apps/web/src/app/api/export/pdf/route.ts`
  — tax-report-data consumers.
- `packages/db/prisma/schema.prisma` — `Budget`, `ServiceCostLog`, `Service` models.

## 3. Related Routes / Screens

- Web page `/budget` (`(app)/budget/page.tsx`) — dashboard (client).
- Web page `/budget/[month]` (`(app)/budget/[month]/page.tsx`) — server drill-in.
- Web page `/expenses` — redirects to `/budget`.
- Mobile `app/budget/index.tsx`, `app/budget/new.tsx`, `app/budget/[id].tsx`.

## 4. Related APIs

- `GET /api/budget` — budgets list + computed summary (projection + actuals).
- `POST /api/budget` — upsert a budget snapshot (premium + `budget.manage`).
- `GET /api/budget/actuals?month=&addressId=` — per-month logged actuals.
- `POST /api/budget/actuals` — upsert/clear one service's actual for a month.
- `GET /api/vehicles/decode?vin=` — VIN decode + recalls (paid feature).
- `POST /api/export` (`type=tax`) and `POST /api/export/pdf` (`type=tax`) — tax report.

## 5. Related Components

Web page is monolithic (no shared budget components); uses shared primitives
`EmptyState`, `CardSkeleton`, `formatCurrency`, lucide icons. Mobile uses
`Card`, `Badge`, `EmptyState`, `ErrorState`, `LoadingScreen`, `GradientProgress`,
`CountUp`, `ListEntrance`, `PressableScale`, `CollapsibleCard`, `SuccessToast`,
`HeroCard`.

## 6. Related State / Hooks / Stores

Web `BudgetPage` local state: `budgets`, `addresses`, `services`, `monthActuals`
(serviceId→amount for viewed month), `loading`, `showForm`, `saving`,
`selectedMonth`, `selectedAddressId`, `form`, `actualDrafts`, `savingActualId`.
Derived via `useMemo`: `servicesForMonth`, `currentBudget`, `budgetSummary`,
`budgetActuals`, `trackableServices`. No global store; data fetched via `fetch`.
Mobile mirrors this with `useTranslation`, `useAppTheme`, haptics.

## 7. Related Database / Models

- `Budget` (schema.prisma:649) — `userId`, `workspaceId?`, `addressId?`,
  `scopeKey`, `month`, `year`, `plannedIncome?`, `actualIncome?`,
  `plannedExpenses?`, `actualExpenses` (required Float), `categoryBreakdown?`
  (Text/JSON), `savingsRate?`, `notes?`, `deletedAt?`. Unique
  `[userId, scopeKey, month]`.
- `ServiceCostLog` (schema.prisma:585) — `serviceId`, `month` (1st of month UTC),
  `amount`. Unique `[serviceId, month]`. Per-month source of truth for actuals.
- `Service` — `monthlyCost` (raw per-cycle amount), `actualMonthlyCost` (legacy
  scalar mirror), `billingCycle`, `addressId`, `isActive`, `activatedAt`, etc.

## 8. Impact Map

- **UI**: `/budget` dashboard, `/budget/[month]` drill-in, mobile budget stack.
- **API**: budget + budget/actuals + export(tax) + vehicles/decode.
- **DB**: `Budget`, `ServiceCostLog`, `Service` (writes `actualMonthlyCost` mirror).
- **Auth**: `requireDbUserId` / `requireAppMutationUser`; workspace RBAC via
  `assertWorkspaceAction("budget.view"/"budget.manage")`,
  `assertScopedRecordAction(... "service.edit")`.
- **Admin**: none directly.
- **Mobile**: full parity dashboard + create form, same shared engine + APIs.
- **Notifications**: none.
- **Integrations**: NHTSA vPIC + recalls (vehicles/decode); Stripe/IAP plan gates
  (premium required for budget.manage / vehicleCheck / advancedExport).
- **Analytics**: `EXPORT_ATTEMPT` security events on tax export.
- **SEO**: N/A (authenticated app pages).
- **Tests**: `route.test.ts` (budget + actuals), `budget-planning.test.ts`
  (engine), `budget-page-regression.test.ts`, `expenses/page.test.ts`,
  `export/route.test.ts`.

## 9. Buttons / Actions / Functions

### Web `/budget`

1. **Month picker (`<input type="month">`)** — sets `selectedMonth`; re-fetches
   per-month actuals; recomputes projection/actuals. No loading state on the
   re-fetch (silent). Edge: a user can pick any month including far future/past;
   projection is computed but one-time costs only land in their service month.

2. **Address `<select>`** — sets `selectedAddressId`; refilters. Permission: read
   only; no IDOR (filter applied within the user/workspace-scoped service query).

3. **Manage Budget Limits / Cancel toggle** — opens/closes the form. No async.

4. **Save Budget Limits (`handleSave`)** — POST `/api/budget`. Validates at least
   one limit set client-side; disables while `saving`; toast on success/fail.
   Permission enforced server-side (premium + `budget.manage`). Edge: no numeric
   bounds client-side beyond `> 0`; very large numbers pass (see budx-06).

5. **Save actual (`saveActualDraft`)** — POST `/api/budget/actuals` with the draft
   amount. Validates `Number.isFinite && >= 0` client-side. Disabled while saving.
   Toast feedback. Permission server-side. Edge: empty/whitespace → error toast.

6. **"Looks right" (`confirmProjectedActual`)** — logs the projected per-cycle
   `monthlyCost` as the actual. No confirmation; one tap writes. Edge: if
   `monthlyCost` is 0 it would never appear (filtered out of `trackableServices`).

7. **Clear actual (`persistServiceActual(id, null)`)** — deletes the month's
   `ServiceCostLog`. Only shown when `hasActual`. No confirm dialog (low risk,
   reversible).

8. **Budget History "Set Monthly Budget" (EmptyState action)** — opens the form.

### Web `/budget/[month]` (server)

- Read-only drill-in; "Back" link only. No mutations. Uses `notFound()` for
  missing auth/budget. See budx-01 (scoping/deletedAt).

### Mobile `app/budget/index.tsx`

- Month stepper (prev/next), address picker, per-line Save / Looks-right / Clear,
  pull-to-refresh, "New budget" → `/budget/new`. Same engine + endpoints; haptics
  + `SuccessToast`. Input sanitized to `[0-9.]` before parse.

## 10. UI/UX Audit

- **budx-08 (Low, UI/UX)** — In `/budget` "Budget vs Committed", when no limit is
  set the over/under cell renders `"$0.00"` (page.tsx:829) which can read as "you
  are exactly on budget" rather than "no limit". The pill copy disambiguates, but
  the number is misleading. *Recommendation*: render an em-dash or "Not set".

- **budx-09 (Low, UI/UX)** — `confirmProjectedActual` ("Looks right") writes
  silently with no undo affordance beyond the separate Clear (X) button, and the
  per-line Save has no inline validation message (only a toast). Acceptable but a
  small inline hint would help. *Priority*: low.

- **budx-10 (Info, UI/UX)** — `actualDrafts` value falls back to
  `String(actual)` for a logged line (page.tsx:948), so the input shows the saved
  value as text; editing then Save re-writes. Fine, but typing leading zeros / a
  bare `.` is allowed on web (`type=number` lets the browser handle it; mobile
  strips to `[0-9.]`). *Recommendation*: normalize on blur for parity.

- **Theme/light-dark**: Colors use tone tokens (`tone-emerald-fg`, `bg-card`,
  `text-destructive`, `text-success`) and CSS variables; `text-success` is a
  defined token (`tailwind.config.ts:53`). No hardcoded hex in the budget page.
  Mobile uses `theme.colors.*` consistently. No theme defects found.

- **Responsive**: grids collapse (`grid-cols-2 lg:grid-cols-4`,
  `lg:grid-cols-2`); header filter grid uses `sm:grid-cols-[...]`. Looks sound.

- **Accessibility**: `aria-label` present on Back link and Clear button; the
  month/address inputs have `<label>` wrappers. Mobile sets `accessibilityRole`
  / `accessibilityLabel` on the steppers and buttons. Gap: the per-line Save and
  "Looks right" buttons on **web** have no `aria-label`/visible text pairing for
  "Looks right" beyond `title` (web uses visible text "Looks right" — OK). The
  progress bars are decorative `div`s with no `role="progressbar"`/`aria-valuenow`
  (budx-11, Low, Accessibility).

## 11. Logic Audit

- **Expected flow**: load budgets+addresses+services → compute projection from
  raw `monthlyCost` normalized per cycle → fetch per-month actuals → reconcile →
  on Save POST budget snapshot (server recomputes the real actual + savingsRate).
  This flow is coherent and the per-month log model is correctly the source of
  truth (`resolveActualAmountForMonth`, budget-planning.ts:283).

- **budx-02 (Medium, Logic)** — `POST /api/budget` lets the client override the
  realized `actualExpenses` (`validated.actualExpenses ?? realActualExpenses`,
  route.ts:182) while `savingsRate` is ALWAYS the server-computed `realSavingsRate`
  (route.ts:197). A client that posts `actualExpenses: 0` (or any number) with
  logged actuals present persists a row where `actualExpenses` and `savingsRate`
  disagree (e.g. actualExpenses=0 but savingsRate=0.2). Budget History then shows
  an inconsistent "Actual spent" vs "Savings rate". The override is described as
  "manual override / tests" in the comment but there is no UI that sends it, and
  it is not reconciled with savingsRate. See Security budx-02 for the
  data-integrity framing.

- **Projection vs actuals month mismatch**: `budgetSummary` is computed from
  `services` WITHOUT per-month cost logs (page.tsx:356) — correct, projection is
  cycle-based. `budgetActuals` uses `servicesForMonth` (with the month's log).
  Consistent.

- **`currentBudget` matching** (page.tsx:345) keys on `budgetMonthKey(month)` +
  `addressId`, but the GET summary's `monthlyBudgetLimit` keys on `scopeKey`
  (route.ts:89). In workspace mode `scopeKey` is `workspace:<id>:global` while the
  client compares bare `addressId` — the client `currentBudget` ignores workspace
  entirely, so a member viewing the shared budget may match the wrong row if they
  also have a legacy personal budget for the same month+address. `[needs
  verification]` against a live workspace dataset (budx-07, Low/Medium, Logic).

- **Stale cache**: `loadBudgetData()` and `loadMonthActuals()` are not abortable;
  a fast month-switch could race (older response lands last). Low risk (idempotent
  setState), see budx-12.

## 12. Reverse Logic Audit

- **Unauthorized user**: `/api/budget*` call `requireDbUserId` /
  `requireAppMutationUser`; `[month]` page catches auth failure → `notFound()`.
  OK.
- **Empty data**: empty states present (no services, no budgets, no logged
  actuals). OK.
- **API error**: web shows a toast and stops spinner; mobile shows
  `ErrorState`/banner. `loadMonthActuals` swallows errors to `{}` (silently shows
  "no actuals"), which can mask a real failure (budx-13, Low, Reliability).
- **Slow network / double-click**: Save buttons disable on `saving`/`savingActualId`.
  The main Save also disables. OK. The "Looks right" + per-line Save share the
  same `savingActualId` guard.
- **Stale data**: see budx-12 (no request cancellation).
- **Direct route access** `/budget/[month]`: see budx-01 — renders soft-deleted
  budgets and ignores workspace scope.
- **Mobile viewport / dark theme**: handled via theme tokens.
- **Role change / token expiry**: server re-checks per request; client surfaces
  errors via toast. A VIEW_ONLY member is blocked from `budget.manage` server-side.
- **Negative / overflow inputs**: engine guards `amount < 0` → treated as no
  actual (budget-planning.ts:290,299); `Number.isFinite` guards. `monthlyCost`
  itself is not clamped at write-time in this module (it is owned by the services
  module) — a negative stored `monthlyCost` would flow into projection as a
  negative committed cost (budx-05).

## 13. Security Audit

### budx-01 — `/budget/[month]` ignores workspace scope and omits `deletedAt`

- **Severity**: Medium
- **Affected Area**: `apps/web/src/app/(app)/budget/[month]/page.tsx:31-36`
- **Evidence**: `prisma.budget.findFirst({ where: { userId, month: { gte, lt } }, ... })`.
  No `deletedAt: null` and no `workspaceId` handling. Compare the API route which
  uses `deletedAt: null` and a workspace-aware OR clause
  (`api/budget/route.ts:51-53`), and `[month]` services query uses
  `activeTrackedServiceWhere(userId, ...)` (userId-only, no workspace).
- **Risk**: (a) A soft-deleted budget row (set `deletedAt` elsewhere) is still
  rendered on the drill-in, contradicting the rest of the app which filters it
  out — a deleted budget "comes back" via direct URL. (b) In workspace mode the
  shared household budget (stored under `ownerUserId`, `workspaceId`) is invisible
  to non-owner members here, and a member only ever sees their own legacy
  personal budget — a correctness/visibility gap, and the services total is
  computed userId-only so it diverges from the workspace-scoped summary the rest
  of the module shows.
- **Defensive Abuse Scenario (high-level)**: A user who soft-deleted a budget for
  privacy can still surface its limits/notes by visiting `/budget/<month>`
  directly; a workspace member sees a different (personal) number than the shared
  dashboard, eroding trust in the figures.
- **Prevention**: Add `deletedAt: null`; resolve workspace data scope (mirror the
  API route's OR clause and `activeTrackedServiceWhereForScope`) so the page and
  the API agree.
- **Detection**: Snapshot/integration test that soft-deletes a budget then GETs
  the page expecting `notFound()`; workspace-member test expecting the shared row.
- **Analysis (root cause)**: This server page predates / wasn't migrated to the
  workspace-data-scope helper used by the API routes.
- **Recommendation**: Route the page through `resolveWorkspaceDataScope` +
  `assertWorkspaceAction("budget.view")` and add `deletedAt: null`.
- **Tests To Add**: deleted-budget → 404; workspace member → shared budget shown;
  services total matches the workspace-scoped summary.

### budx-02 — Client can persist an `actualExpenses` inconsistent with `savingsRate`

- **Severity**: Medium
- **Affected Area**: `apps/web/src/app/api/budget/route.ts:180-197`; `budgetSchema`
  (`lib/validators.ts:172`).
- **Evidence**: `const actualExpenses = validated.actualExpenses ?? realActualExpenses;`
  but `savingsRate: realSavingsRate` is always server-computed. The schema accepts
  arbitrary `actualExpenses: z.number().min(0)`.
- **Risk**: Data integrity, not a privilege escalation. The persisted Budget row
  can have `actualExpenses` that contradicts `savingsRate` and `plannedExpenses`,
  which Budget History renders directly (`page.tsx:1105-1149`). A user can write
  an "Actual spent" figure unbacked by any `ServiceCostLog`, undermining the whole
  "substantiated savings" guarantee the module advertises.
- **Defensive Abuse Scenario (high-level)**: A user crafts a POST with a flattering
  low `actualExpenses` to show "Under Budget" in their history while the
  server-derived savingsRate (from logs) tells a different story; later exports
  (`/api/export type=budget`) carry the inconsistent number.
- **Prevention**: Either drop `actualExpenses` from the writable schema and always
  derive it server-side, or, if a manual override is intentional, recompute
  `savingsRate` from the supplied `actualExpenses` vs `projectedForLoggedServices`
  so the two stay consistent.
- **Detection**: Unit test asserting that when `actualExpenses` is supplied it is
  either rejected or that `savingsRate` is recomputed to match.
- **Analysis (root cause)**: Legacy "manual override / tests" escape hatch left in
  the production write path.
- **Recommendation**: Remove the client override from the production path (keep a
  test-only seam) or reconcile both fields.
- **Tests To Add**: POST with `actualExpenses` while logs exist → assert
  consistency (or 400).

### budx-03 — Auth/RBAC + IDOR posture (positive findings, with one note)

- **Severity**: Info
- **Evidence**: `POST /api/budget/actuals` loads the service and calls
  `assertScopedRecordAction(service, scope, "service.edit", ...)`
  (`actuals/route.ts:138-148`) — IDOR-safe. `POST /api/budget` validates an
  attached `addressId` belongs to the user/workspace (route.ts:157-167). GET
  filters are AND-merged onto a user/workspace-scoped WHERE, so a passed `id` /
  `addressId` cannot read another tenant's row.
- **Note**: confirm `requireWorkspaceContext` already rejects a `workspaceId`
  header the user is not a member of (it does enforce `context.userId === userId`
  in `resolveWorkspaceDataScope:48`). `[needs verification]` of the membership
  check inside `workspace-context.ts`.

### budx-04 — Tax report (`buildTaxReportData`) is userId-only (no workspace)

- **Severity**: Low
- **Affected Area**: `apps/web/src/lib/tax-report-data.ts:64-100`
- **Evidence**: All three queries filter `where: { userId, deletedAt: null }`.
- **Risk**: Not a cross-tenant leak (it only ever returns the caller's own data),
  but in workspace mode it excludes services/addresses owned by the workspace but
  not by the calling user's `userId`, so a Pro member's tax export may be
  incomplete relative to the shared workspace they see elsewhere. The export
  routes also gate on the individual user's plan, not the workspace plan.
- **Recommendation**: Decide intended scope; if workspace-inclusive, thread the
  data scope through `buildTaxReportData`. `[needs verification]` of product
  intent.

### Other security notes

- **Injection**: No raw SQL; Prisma parameterized. CSV export prefixes formula
  characters (`safeCsvValue`, export/route.ts:626) — CSV-injection-safe.
- **SSRF**: `vehicles/decode` calls NHTSA via `lib/nhtsa` with a strict 17-char
  VIN regex; no user-controlled URL. OK.
- **Secret/PII logging**: errors logged with `console.error(message, error)` — no
  amounts or PII in budget routes. OK.
- **Notes field**: stored plaintext in `Budget.notes`; export requires explicit
  `includeNotes` + step-up. Budget notes themselves are not encrypted (unlike
  service notes) — `[needs verification]` whether that is intended (budx-14, Low).

## 14. Performance Audit

- **budx-15 (Low, Performance)** — `/budget` fetches `/api/services?limit=200`
  and recomputes the entire projection/actuals client-side on every render via
  `useMemo` (cheap). The bigger cost: `loadBudgetData()` is called after EVERY
  actual save (`page.tsx:415`) AND `loadMonthActuals()` runs on month/address
  change, so logging N actuals triggers N full 3-endpoint reloads. Consider
  optimistic local update only (already done) without the full reload, or debounce.
- **N+1**: `refreshBudgetSnapshotsForServiceMonth` issues up to 2
  `findFirst` + 2 `resolveBudgetActualsForMonth` (each a `findMany`) per actual
  write (snapshot refresh). Bounded (≤2 scopes), acceptable.
- **Tax report**: 3 parallel `findMany` + in-memory grouping; `taxByProperty`
  does `tax.filter` per address (O(addresses×services)). Fine at expected scale;
  could be a `Map` group if datasets grow (budx-16, Info).
- **Mobile**: `CountUp`/`ListEntrance` animations per row; acceptable.

## 15. Reliability Audit

- **Error boundary**: web relies on toasts; no React error boundary around the
  page (consistent with app). Mobile has `ErrorState` + retry.
- **Retry**: mobile `onRetry`; web has none for the initial load (only a toast).
- **budx-13 (Low, Reliability)** — `loadMonthActuals` `.catch(() => setMonthActuals({}))`
  silently treats any failure as "no actuals," so a transient 500 makes the month
  look reconciled-to-zero. Surface a non-blocking error instead.
- **Transaction consistency**: `POST /api/budget/actuals` performs a
  `serviceCostLog.upsert` + a `service.update` (scalar mirror) + a snapshot
  refresh as separate awaits, not in a transaction (route.ts:162-183). A failure
  between the upsert and the scalar mirror leaves the legacy scalar stale for the
  current month (budx-17, Low). The per-month log (source of truth) is still
  correct, limiting impact.
- **Partial failure**: snapshot refresh failure would 500 the whole POST even
  though the log already wrote; the client would think it failed and may retry
  (idempotent upsert, so safe).
- **Monitoring**: export routes emit security events; budget routes do not (only
  `console.error`).

## 16. Dead Code / Cleanup

- `apps/web/src/app/expenses/page.tsx` — pure redirect to `/budget`; intentional
  (legacy URL). Not dead. `expenses/page.test.ts` confirms the redirect.
- `apps/web/src/lib/budget-planning.ts` — re-export shim; intentional (comment
  documents the indirection). Keep.
- `actualMonthlyCost` legacy scalar + its mirror writes — still read by the
  legacy fallback path (`resolveActualAmountForMonth`); not dead while any caller
  omits `costLogs`. `[needs verification]` whether any remaining caller relies on
  the scalar; if none, the mirror writes in `actuals/route.ts:157,171` are
  removable (budx-18, Info).
- `monthlyAmountForCycle` `ANNUAL` alias and `isMonthlyBillableCycle` — used by
  other surfaces; not dead.

## 17. Tests

- **Existing**: `api/budget/route.test.ts` (zero-actuals snapshot, substantiated
  savings, UTC month normalization, year derivation, soft-deleted address,
  per-address scope keys, invalid month). `api/budget/actuals/route.test.ts`.
  `packages/shared/.../budget-planning.test.ts` (cycle math incl. weekly/annual,
  one-time month gating, per-month log resolution, negative-actual exclusion,
  per-category variance, per-month different actuals). `budget-page-regression.test.ts`.
- **Missing / suggested**:
  - **budx-01** regression: `[month]` page with soft-deleted budget → 404; with a
    workspace member → shared budget + matching services total.
  - **budx-02**: POST with `actualExpenses` while logs exist → consistency/400.
  - Overflow/precision: very large `monthlyCost` (e.g. 1e15) and quarterly cycle
    → assert no float blow-up / rounding stays 2dp.
  - `tax-report-data`: one-time annualization vs recurring; unassigned-address
    counting; nickname-collision grouping by id (the comment claims it's safe).
  - E2E: log actual → Budget History "Actual spent" + savings rate update without
    re-saving the budget (the `refreshBudgetSnapshotsForServiceMonth` path).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| budx-01 | Medium | Security | `/budget/[month]` omits `deletedAt:null` and workspace scope | Renders soft-deleted budgets; hides shared workspace budget; services total diverges | Scope via `resolveWorkspaceDataScope`; add `deletedAt:null` | `(app)/budget/[month]/page.tsx` |
| budx-02 | Medium | Data | Client `actualExpenses` override not reconciled with server `savingsRate` | Persisted Budget row internally inconsistent; undermines "substantiated savings" | Derive server-side or recompute savingsRate from override | `api/budget/route.ts`, `lib/validators.ts` |
| budx-04 | Low | Security | Tax report builder is userId-only in workspace mode | Pro tax export may omit workspace-owned data | Thread data scope through `buildTaxReportData` `[needs verification]` | `lib/tax-report-data.ts`, `api/export/*` |
| budx-05 | Low | Logic | Negative stored `monthlyCost` flows into projection unguarded | Negative "committed"/projected totals | Clamp/validate at service write (cross-module) or guard in engine | `packages/shared/src/budget-planning.ts` |
| budx-07 | Low | Logic | Client `currentBudget` match ignores `scopeKey`/workspace | Member may match wrong budget row for month+address | Match on scopeKey parity `[needs verification]` | `(app)/budget/page.tsx` |
| budx-08 | Low | UI/UX | Over/under shows `$0.00` when no limit set | Reads as "on budget" not "no limit" | Render em-dash / "Not set" | `(app)/budget/page.tsx:829` |
| budx-11 | Low | Accessibility | Progress bars lack `role=progressbar`/aria values | Screen-reader users get no value | Add ARIA progressbar semantics | `(app)/budget/page.tsx` |
| budx-12 | Low | Reliability | Un-abortable fetches on rapid month switch | Possible stale render | Abort/ignore superseded responses | `(app)/budget/page.tsx` |
| budx-13 | Low | Reliability | `loadMonthActuals` swallows errors → shows zero actuals | Masks transient failures | Surface non-blocking error | `(app)/budget/page.tsx`, mobile |
| budx-15 | Low | Performance | Full 3-endpoint reload after every actual save | Extra network on bulk logging | Rely on optimistic update; skip full reload | `(app)/budget/page.tsx`, mobile |
| budx-17 | Low | Reliability | actual upsert + scalar mirror + snapshot not transactional | Stale legacy scalar on partial failure | Wrap in `$transaction` | `api/budget/actuals/route.ts` |
| budx-03 | Info | Security | Auth/RBAC/IDOR posture verified sound (one membership check to confirm) | — | Confirm membership enforcement | `api/budget/*`, `lib/workspace-data-scope.ts` |
| budx-09/10/14/16/18 | Info/Low | UI/UX,Data,Perf,Dead | Minor UX, unencrypted budget notes, tax grouping perf, removable scalar mirror | Low | See sections | various |

## 19. Module TODO

- [ ] **budx-01 (Medium)** — Scope `/budget/[month]` to workspace + add `deletedAt:null`.
  - Reason: shows deleted budgets; hides shared budget; diverging totals.
  - Related: `(app)/budget/[month]/page.tsx`, `lib/workspace-data-scope.ts`,
    `lib/service-active.ts`.
  - Suggested fix: mirror the API route's scope OR clause and
    `activeTrackedServiceWhereForScope`; add `deletedAt:null`.
  - Dependencies: workspace-context helpers. Complexity: low. Risk: low.

- [ ] **budx-02 (Medium)** — Reconcile or remove client `actualExpenses` override.
  - Reason: persisted row can contradict server savingsRate.
  - Related: `api/budget/route.ts`, `lib/validators.ts`.
  - Suggested fix: drop `actualExpenses` from writable schema (server-derive), or
    recompute savingsRate from the override.
  - Dependencies: none. Complexity: low. Risk: medium (changes write contract;
    check any client/test that sends it).

- [ ] **budx-04 (Low)** — Decide + implement workspace scope for tax export.
  - Related: `lib/tax-report-data.ts`, `api/export/route.ts`, `api/export/pdf/route.ts`.
  - Complexity: med. Risk: med. `[needs verification]` of product intent.

- [ ] **budx-05 (Low)** — Guard negative/non-finite `monthlyCost` in the engine.
  - Related: `packages/shared/src/budget-planning.ts`. Complexity: low. Risk: low.

- [ ] **budx-13 / budx-15 / budx-17 (Low)** — Surface actuals-fetch errors;
  drop the full reload after each save; wrap the actuals write trio in a
  transaction.
  - Related: `(app)/budget/page.tsx`, `apps/mobile/app/budget/index.tsx`,
    `api/budget/actuals/route.ts`. Complexity: low/med. Risk: low.

- [ ] **budx-08 / budx-11 (Low)** — Fix "no limit" over/under copy; add progressbar
  ARIA. Related: `(app)/budget/page.tsx`. Complexity: low. Risk: low.

- [ ] **Tests** — Add the regression/edge tests in §17 (deleted budget 404,
  actualExpenses consistency, overflow precision, tax annualization/grouping, log
  → history refresh E2E). Complexity: med. Risk: low.
