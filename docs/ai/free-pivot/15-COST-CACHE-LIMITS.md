# 15 · Cost, Cache & Rate Limits — PRESERVE (free ≠ unlimited spend)

> Decision (mustafa, 2026-06-19): **everything free / everyone Pro, BUT keep caching and keep cost/API/abuse limits so it doesn't blow up.**

The pivot lifts **plan/feature limits** (max addresses/services/seats, feature booleans). It must **NOT** touch the independent guardrails that protect cost & stability. Critically: these guardrails are **not entitlement-based**, so the "all accounts full" override does not affect them — but we must verify nothing in the override path bypasses them, and consider *tightening* a couple now that cost-bearing features are open to everyone.

## Two different kinds of "limit"

| Kind | Examples | Pivot action |
|---|---|---|
| **Plan / feature limits** (paywall) | maxAddresses 3, maxServices 10, seatLimit 1, `aiBriefing:false`, `homeDossier` preview | **LIFT** (everyone Pro) — [01](01-ENTITLEMENTS-AND-GATES.md) |
| **Cost / abuse / rate limits** (guardrail) | per-IP/user rate limits, AI daily cap, export ceilings, external-API throttles, sampling | **KEEP** (this report) |

## Rate-limit policy — KEEP ALL · [apps/web/src/lib/rate-limit-policy.ts](apps/web/src/lib/rate-limit-policy.ts)
Central matrix `RATE_LIMIT_POLICIES`, keyed by **IP / email / userId + route group** — **not by plan**. Unaffected by the entitlement flip; **do not relax**. Notable cost-bearing groups to keep:
- `export_data` 3 / 15 min, `export_pdf` 3 / 60s (PDF costs more) — exports are now free but still **cost-capped**.
- `provider_recommendations` 120/60s, `public_read` 240/60s, `user_write` 120/60s.
- `mobile_oauth_exchange`, auth/password/mfa/admin (security) — keep failClosed.
- Implementation: `rate-limit.ts`, `rate-limit-policy.ts`, enforced in `middleware.ts` + per route via `enforceRateLimitPolicy`/`evaluateRateLimitPolicy`. Matrix doc: `docs/audits/security/rate_limit_policy_matrix.md`.

> ⚠️ Do **not** add a "premium bypass" to rate limits as part of making everyone Pro. Limits stay per-IP/user regardless of tier.

## AI cost cap — KEEP (and consider tightening) · [apps/web/src/app/api/onboarding/briefing/route.ts](apps/web/src/app/api/onboarding/briefing/route.ts)
- `DAILY_AI_GENERATION_CAP` (≈3/day, line 58 + gen gate ~355) → degrades to a deterministic **rule-based briefing** when exceeded. This is **cost control, not a paywall** — KEEP.
- `ANTHROPIC_API_KEY` "configured" check (line 151) — deployment switch; KEEP.
- **Recommendation:** now that AI briefing is free for ALL users, confirm the cap is **per-user/day** (not global) and generous-but-bounded; add a global daily spend ceiling + alert if not present. (Anthropic spend is the #1 runaway-cost risk.)

## External-API guardrails — KEEP caching + throttles
Each costs money or has upstream quotas; keep their caching/timeouts/limits:
- Maps: **Geoapify static map** (`/api/maps/static`) — LRU cache + rate limit + timeout + non-image guard. KEEP. `imgproxy` ([storage/imgproxy.ts](apps/web/src/lib/storage/imgproxy.ts)).
- Dossier lookups: `census-acs.ts`, `airnow.ts`, `nws-weather.ts`, `fcc-isp.ts`, `electric-utility.ts`, `usps-address-validation.ts`, `zip-centroid.ts`. KEEP their caching; **dossier is now free for all → these fire more** — ensure results are cached per address and consider a per-user/day dossier-refresh cap.
- Runtime config gating: `getRuntimeConfigValue` ([runtime-config.ts](apps/web/src/lib/runtime-config.ts)) — keep "feature unconfigured → hidden" behavior (not a paywall).

## Caching layers — PRESERVE (never strip/bypass)
**Web**
- Maps/static LRU; dossier per-address caching; `service-worker-cache.ts`; Next.js `revalidate` / `Cache-Control` on public pages, blog, sitemap, llms.txt; React Query `staleTime` ([components/query-provider.tsx](apps/web/src/components/query-provider.tsx), [hooks/use-providers.ts](apps/web/src/hooks/use-providers.ts)).

**Mobile** ([apps/mobile/src/lib](apps/mobile/src/lib))
- `offline-cache.ts`, `home-dossier-cache.ts` (memory + disk peek/read), `last-plan-cache.ts`, `use-detail-offline-cache.ts`. These power instant cold-start + offline. **Do not remove or bypass** when flipping entitlement — the dossier/briefing/services screens read cache-first then reconcile. The all-free change must keep the same cache-first read paths (just with non-gated payloads).

## Analytics volume control — KEEP · sampling + retention
- `user-event-sampling.ts` (`shouldPersistUserEvent`) + `user-event-retention.ts` + retention cron. New events ([10](10-ANALYTICS-FLAGS.md)) **inherit** sampling/retention — don't bypass. Consent gate stays.

## Abuse / security guardrails — KEEP
- `login-lockout.ts`, `cron-guard.ts`, webhook signature verification, admin step-up + audit, `ip-rules.ts`. None are plan-based; all stay.

## Net rule for implementation
1. Flip **entitlement** (plan/feature limits) → unlimited/full for all. ([01](01-ENTITLEMENTS-AND-GATES.md))
2. **Touch nothing** in rate-limit-policy, AI cap, external-API throttles, caches, sampling, security.
3. Because cost-bearing features (AI briefing, full dossier, exports/PDF) are now open to everyone, **verify per-user/day caps exist** on: AI generation, dossier external lookups, export/PDF (export already capped). Add generous per-user/day ceilings + a global spend alert where missing. This is the "boku çıkmasın" safety margin.
4. Add a checklist verification: prove the `getUserPlan`/entitlement override path does **not** grant any rate-limit/AI-cap bypass.
5. **"Unlimited" = a sane high FINITE abuse cap, not `MAX_SAFE_INTEGER`** (so `count>=limit` still trips for pathological accounts) — and **add a per-owner count check to custom providers** (currently none on the active path). Also keep `concurrentPlanLimit` from dead-ending the base. Full detail + numbers: [16-LOGIC-HOLES-AND-EDGE-CASES](16-LOGIC-HOLES-AND-EDGE-CASES.md) H4/H6/H8.
