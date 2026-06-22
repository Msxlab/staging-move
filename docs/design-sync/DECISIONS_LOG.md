# Design-Sync Decisions Log

> Records the user's answers to the `QUESTIONS.md` decisions (D1–D34) as they are made.
> Implementation has NOT started — decisions only. The user is consulted before any code change.

## Resolved

### D1 — Rebrand scope → **Keep the name "LocateFlow"; adopt the new design system FULLY**
The product name stays **LocateFlow** (do NOT rename to "Move"). Adopt the new handoff's visual/design system **fully** (full integration), but it is a **re-skin/re-theme, not a product rename**. → All "Move" rename gaps are resolved as **keep LocateFlow**: no wordmark→"Move", no `@locateflow/*` package rename, no `com.locateflow.mobile` change, **no storage-key migration** (`locateflow-*` keys stay). Resolves/moots: DS-01 (partial), move-app-01/02, web-app-shell-02/17, admin-01, onboarding-01, auth-1, marketing-01/10, app-surfaces-1/24, brand-raccoon-2, D2, D13(key part).

### D4 — Raccoon mascot → **Official mark (yes)**, wordmark text = **"LocateFlow"** in the new Playfair display
Promote the parametric raccoon to the official logo mark; regenerate favicons/PWA/app-icons/OG with it (raster assets hand-regenerated). Wordmark reads **"LocateFlow"** (NOT "Move") in the new Playfair-900 style. Resolves: marketing-02, web-app-shell-09, admin-18, brand-raccoon-4/5, move-app-24.

### D5 — Primary accent → **Gold in dark, Sapphire (blue) in light**
NOT the brief's teal/green/Emerald. Accent is **mode-dependent**: dark theme → Gold `#CBA45E`; light theme → Sapphire (blue). This matches the current system's behavior → lowest-risk color path. **Light mode is kept** (the user named a light accent). Emerald/teal stays only as optional semantic/accent, not the brand primary. Resolves: DS-02, move-app-04, web-app-shell-13, admin-03, auth-12, providers-T1/D4, dossier-11, brand-raccoon-1/3, marketing-03. Implies **D8 = no 3-way picker** (single mode-dependent accent), **D27/D33 = keep light mode**.

### D3 — Pricing → **Truly free: remove PRO** ⚠ (scope to be confirmed before touching billing/IAP)
Adopt "100% free" for real: strip consumer PRO gating, IAP purchase UI, checkout/subscription copy, and the subscription settings screen. **High-impact, revenue-affecting, hard to reverse — billing/IAP is an `AGENTS.md` high-risk area.** Affiliate/partner lead-gen revenue is SEPARATE and stays. The EXACT deletion boundary (what is removed vs preserved-dormant vs kept for admin/affiliate) must be confirmed before any implementation. Resolves (pending scope): move-app-03/22/23, auth-3/4/11, marketing-09/15.

### D23 — Web app shell → **Keep & re-skin** (option a/c)
Keep the existing Next.js web app shell (SSR auth gate, sidebar, topbar, 13-widget drag dashboard, settings hub, ~28 routes); re-theme with the new LocateFlow design. The handoff's phone-in-bezel "web app" is treated as a **marketing showcase**, not a directive to delete the desktop product. Resolves: web-app-shell-01/03/04/05/06/11/14/15, move-app-21, D24/D25 (keep widget dashboard + sidebar/tab bar, re-skinned).

### D3 (scope) — **Free conversion via the reversible CONSUMER_FREE mechanism** (= the existing free-pivot)
Confirmed approach (user): deactivate the Individual/Family/Pro **purchasable** tiers; **every user resolves to PRO** (PRO feature set + PRO limits); remove the **user-facing** payment surfaces (paywalls, IAP buy UI, upgrade/subscription screens, checkout copy); **keep the billing backend dormant + reversible** (Stripe/IAP/webhooks, admin billing, entitlement engine) so a future return to paid is one flag away; revenue comes from **affiliate/partner**. This is exactly `docs/ai/free-pivot/` + `packages/shared/src/consumer-free.ts` (`CONSUMER_FREE` flag, `applyConsumerFreeOverride`). **Safe / lossless / reversible — backend is hidden, not deleted.** Limits stay at PRO limits (UNLIMITED consumer features, but cost/abuse/rate caps preserved per free-pivot §15). Implementation must follow the free-pivot's 2-point param-gated override (`getUserPlan` + `getEffectiveEntitlement`) and the 8 logic-hole guards (free-pivot/16). Resolves: move-app-03/22/23, auth-3/4/11, marketing-09/15.

### D32 — Providers → **Restyle, keep the engine** (option b/c)
Keep the all-category directory + recommendation engine + sponsored/affiliate surfaces (revenue + value); restyle cards/compare to match the design; optionally add a per-category compare drilldown. Speed/Price/Rating only where real data exists. Resolves: providers-D1/D2/D3/M1/M2/N1/X1, cprov-N1/M1.

### D30 — Onboarding profile → **Keep the rich capture** (option b)
Keep all current profile fields (the checklist + recommendation engines depend on them); the design's 4 move-type cards become just the move-type sub-control. Do not remove fields. Resolves: onboarding-05/06/07.

### D7 — Admin theme → **Unify onto navy #070B14** (option a)
Admin moves to the same navy canvas as web (re-skin `.adm-aurora` dark + `themeColor`); drop the deliberate graphite #171E2B. Resolves: DS-05, admin-02.

### D14 — Dossier → **Full raccoon character scene system** (option b)
Build the ~22 mood-driven raccoon scenes (large art/illustration epic). **Preserve the data-derived `ambientForSection()` mapping** on top — characters layer over the existing data-honest scene selection; do NOT regress to a manual `level` enum. Resolves: dossier-1/6/7/8/9/13/14, brand-raccoon-1. (Pairs with D16 raccoon-truck = build.)

### D21 — Reminders → **Completable** (option a)
Add a per-reminder done model + persistence (checkbox, strike-through, "{open} open · {done} done" header). Data-model change. Resolves: app-surfaces-7/8/23.

### D34 — Rollout order → **Recommended sequence**
1) Tokens & brand foundation (emitter + palette + wordmark/raccoon) → 2) Mobile app (design's primary surface) → 3) Marketing site → 4) Web app shell re-skin → 5) Admin.

## Remaining decisions — proposed sensible defaults (derived from the locked direction; confirm or flag exceptions)

| D | Topic | Proposed default |
|---|---|---|
| D2 | "by LocateFlow" lockup | Just **"LocateFlow"** wordmark (name stays LocateFlow); fix stale © year + OG "M" glyph during the pass |
| D6 | Single token source | **Yes** — one unified token source for mobile+web+admin (admin unified to navy) |
| D8 | 3-way accent picker | **No** — single mode-dependent accent (Gold dark / Sapphire light per D5); picker deferred |
| D9 | lightBg | Adopt **warm greige #EFEADF** default, no selector for v1; re-run AA contrast in light |
| D10 | Radius bump | **Adopt** the rounder scale (cards 18–26px, pills 99px) as tokens; audit hardcoded radii |
| D11 | Token emitter first | **Yes (strong)** — build `packages/shared/src/design-tokens.ts` as the build-time emitter (web vars + admin vars + mobile JS) BEFORE swapping values; **derive** shadcn HSL from the new hex (keep the HSL layer) |
| D12 | Aurora layer | **Keep + re-skin** to navy/gold for v1 (aurora regression test exists); retirement = later follow-up |
| D13 | Alias/key rename | Rename color **aliases** to honest names (gold/sapphire/teal/green); **KEEP storage keys** (no migration — name stays LocateFlow) |
| D15 | Dossier taxonomy | Keep data-backed scenes; add design-only (transit/cost/area) **only where a real data source exists** — decide per-scene at build |
| D16 | Risk gauge + raccoon-truck | **Build both** (risk gauge data-backed; raccoon-truck fits the full raccoon system from D14) |
| D17 | Onboarding welcome/done | Add the **Done/celebration** step; Welcome hero as a splash (flow starts post-auth) |
| D18 | Admin data sources | **Re-skin `/connectors`** toward status/last-sync/coverage cards (not net-new) |
| D19 | Admin AI briefings | **Skip v1** (single toggle, no current equivalent) — optional later |
| D20 | Share this move + link | v1: re-skin `/settings/workspace` + add a **Share** entry; tokenized shareable link = separate scoped feature (security review) |
| D22 | Admin per-move risk | **Add** risk column + risk stat to the moves list (leverages existing risk data) |
| D24/25 | Web dashboard + sidebar/tabs | **Keep & re-skin** (tied to D23a) |
| D26 | Admin nav | **Keep grouped RBAC nav**; adopt the mock's labels/active-bar styling; do NOT drop RBAC-gated sections |
| D27 | Admin light mode | **Keep light mode** (resolved by D5) |
| D28 | Admin settings | **Keep split routes**; adopt the mock's card layout within them |
| D29 | Auth in onboarding | **Keep auth separate** from the onboarding wizard |
| D31 | Minimal web onboarding | **Abbreviated mock** — keep legal consent / coach / teaser, re-skin only |
| D33 | Marketing home | **Selective prune** — adopt the Always-free band (from the real free-feature registry), drop clearly-redundant sections, **keep light mode**, keep what converts |

## Implications already derivable
- **Big scope reduction:** no product rename, no package/bundle/storage-key migration. The job is **theme + design-system adoption + truly-free + per-surface re-skin**, keeping the LocateFlow identity.
- Light mode stays; accent = Gold(dark)/Sapphire(light); Emerald/teal not primary.
- Raccoon becomes the mark; Playfair/DM typography adopted.

## Pending (next batches)
Group B theme mechanics: D6 (single token source), D7 (admin navy vs graphite), D9 (warm greige canvas), D10 (radius), D11 (token emitter first), D12 (aurora layer). Group C features: D14–D22. Group D IA/rollout: D23 (web shell), D26 (admin nav), D30 (onboarding profile depth), D32 (providers layout), D33 (marketing sections), D34 (rollout order).

_Last updated: 2026-06-22._
