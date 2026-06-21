# 13 · Risks & Rollback

## Rollback (the safety net)
Everything sits behind **`CONSUMER_FREE`**:
- Flip the DB flag off (web async gates) and unset the env constant (shared pure code) → `getUserPlan`, `planFeatures`, `getEffectiveEntitlement` fall back to the tiered ladder; teasers/onboarding paywalls re-render; paid model returns.
- Because nothing is deleted (Stripe/IAP/admin/emails/acquisition all dormant-but-intact), rollback is config, not a revert. Copy/SEO/store-listing changes are the only parts not behind the flag — those are reversible by re-editing copy + console.

## Risks

| Risk | Detail | Mitigation |
|---|---|---|
| **Tests** | gating-policy tests break by design | Update per [12-TESTS](12-TESTS.md); parametrize on flag; keep engine/security tests intact |
| **Override masks real payers** | if the `getEffectiveEntitlement` override is too broad it could mark a refunded/canceled payer as premium → wrong admin view | Apply override **only to free/unknown** outcomes, after provider-paid resolution; add tests; admin reads RAW (`fullAccess:false`) |
| **LLM cost** 💸 | AI briefing free for all → Anthropic spend | Preserve the 3/day `DAILY_AI_GENERATION_CAP` + rule-based fallback; monitor; consider per-user/day rate limit |
| **Email/cron cost** | weatherDigest free → more digest emails; trial-check must stop "you'll be charged" notices | Gate trial-expiring email + free-access-ending + annual-renewal notices behind billing-dormant; confirm digest volume acceptable |
| **App review rejection** | in-app tier names ≠ store sheet; advertising a sub with no IAP | Ship with store flags false (commerce hidden); App Review notes "purchases not offered"; coordinate in-app copy release with console listing edits |
| **Store/privacy labels** | "Offers IAP"/financial-data labels stale for a free build | Update App Store privacy + Play data-safety while purchases disabled |
| **SEO stale rich results** | Google keeps showing `$24`/free-trial snippets | Re-crawl `/`,`/pricing`,`/faq` in Search Console; resubmit sitemap; verify via Rich Results test |
| **Legal/consent copy** | acquisition disclosure/consent strings have evidentiary value | Legal sign-off; keep disclosure structure; check `TERMS_VERSION` |
| **DB key rename** | renaming INDIVIDUAL/FAMILY/PRO breaks Stripe map + persisted `Subscription.plan` | Only change **display names/copy**, never keys |
| **Client flag gap (RN)** | `isFeatureEnabled` is server-only | Prop-drill resolved flags from server; offer stubs fail-closed |
| **Analytics funnels** | upgrade/teaser events go quiet | Update dashboards so the drop isn't read as a regression |
| **Worktree has no node_modules** | can't typecheck/test in this worktree | Run `pnpm verify:typecheck` + tests in a checkout with deps / CI before merge |
| **Strategy drift** | reverses the recent annual-first pricing / Product Brain | Update `docs/ai` Product Brain to record the pivot (phase 7) |

## Decisions (resolved 2026-06-19)
- **Everyone = PRO** → mobile shows the Pro accent theme for all (accepted).
- **apiConnectors (automatic OAuth account sync)** — ON for everyone (part of PRO). It is the **highest recurring external-API cost** feature, so it must run under cost guardrails: keep/raise a per-user connector-count + sync-frequency cap and a global spend alert. ([15-COST-CACHE-LIMITS](15-COST-CACHE-LIMITS.md)) — confirm the cap numbers before enabling at scale.
- **Everything free but cost-bounded**: per [15-COST-CACHE-LIMITS](15-COST-CACHE-LIMITS.md), caching is preserved and rate/AI/export/external-API limits stay; consider per-user/day caps on AI generation + dossier external lookups.
