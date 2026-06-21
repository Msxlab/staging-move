# 02 · Web App (logged-in surfaces)

Once the 3 entitlement levers flip ([01](01-ENTITLEMENTS-AND-GATES.md)), the API stops returning `entitled:false` / `*_UPGRADE_REQUIRED` for consumers, so most in-app teasers **go dead automatically** (the client trusts the server payload). This report lists those surfaces so we (a) verify they no longer render and (b) optionally hide them belt-and-suspenders. Keep all teaser components as dormant scaffolding for future Concierge/Business.

## Dashboard & feature teasers (auto-dead after server flip)

| Surface | File | Current | After pivot |
|---|---|---|---|
| AI briefing card → teaser | [move-briefing-card.tsx:197](apps/web/src/components/dashboard/move-briefing-card.tsx) | `entitled===false` → renders `MoveBriefingTeaser` (blurred prose + `/pricing` CTA) | API returns real briefing → teaser branch never taken |
| `MoveBriefingTeaser` component | [move-briefing-card.tsx:296](apps/web/src/components/dashboard/move-briefing-card.tsx) | Freemium upsell; emits `UPGRADE_CLICKED` (targetPlanTier `family`) | Dormant; keep for future re-gate |
| Home Dossier card → teaser | [home-dossier.tsx:669](apps/web/src/components/dashboard/home-dossier.tsx) | `isDossierGated()` → `HomeDossierTeaser` (locked rows, `/pricing`) | Full data renders; teaser dormant |
| `HomeDossierTeaser` | [home-dossier.tsx:1272](apps/web/src/components/dashboard/home-dossier.tsx) | "Unlock with Individual" card | Dormant; copy says "Individual" → see [11-COPY-I18N](11-COPY-I18N.md) |
| Dossier preview "unlock" strip + neighborhood Pro-lock | [home-dossier.tsx:1031,1163](apps/web/src/components/dashboard/home-dossier.tsx) | Shown in preview mode | Not reached (full dossier) |

## Upsell modals / limit handlers (should never trigger)

| Surface | File | Current | After pivot |
|---|---|---|---|
| Service-limit upsell modal | onboarding `saveServices()` [onboarding-client.tsx:740](apps/web/src/app/onboarding/onboarding-client.tsx) | Handles `SERVICE_LIMIT_REACHED`/`SUBSCRIPTION_REQUIRED`/`TRIAL_EXPIRED` → `ServiceLimitUpsell` (`/settings/subscription`) | Codes no longer returned; keep handler dormant (defensive) |

## In-app pricing / billing surfaces (become dormant, not removed)

- **`/settings/subscription`** (web) — the manage/upgrade screen. Stays reachable from Settings but should present "You're on Free — everything included" + Concierge/Business coming-soon; no live checkout entry from product flows. Stripe checkout link-building preserved (dormant).
- **Stripe checkout / portal routes** — preserved; just not entered. See [09-PAYMENTS-BILLING-PRESERVED](09-PAYMENTS-BILLING-PRESERVED.md).

## Recommended approach
1. **Do nothing destructive** — flipping the server levers is what matters; the teasers self-disable.
2. **Verify** each surface above renders the real feature (not teaser) for a brand-new free account.
3. **Optional belt-and-suspenders**: early-return the teaser branches when `CONSUMER_FREE` is on (props/flag), so they can't render even if a payload is stale.
4. **Copy**: any dormant card still containing "Individual/Pro/Upgrade" text is covered by [11-COPY-I18N](11-COPY-I18N.md) (low priority since dormant).

## Analytics note
`UPGRADE_CLICKED` (and dashboard teaser-view events) stop firing for consumers. Keep the event constants in `@locateflow/shared`. See [10-ANALYTICS-FLAGS](10-ANALYTICS-FLAGS.md).
