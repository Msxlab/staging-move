# LocateFlow Rate Limit and Auth Protection Audit

Source reviewed: `apps/web/src/lib/rate-limit.ts`, `apps/web/src/lib/login-lockout.ts`, `apps/web/src/middleware.ts`, web auth/password/MFA/mobile/export/delete/provider routes, webhook/cron/internal secret helpers, `apps/admin/src/app/api/auth/login/route.ts`, admin middleware/auth/MFA routes, and relevant tests.

## Summary

The prior implementation had useful primitives, but several protections were too IP-centered or unevenly applied. Web middleware used broad read/write buckets, user login lockout was effectively IP keyed, mobile OAuth exchange used one IP key, provider recommendations were tighter than normal app usage needs, and data export had no step-up. Admin login was stricter than user login but also IP keyed.

## Route Group Matrix

| route group | current limit before change | key used before change | user impact risk | abuse risk | recommended change |
|---|---:|---|---|---|---|
| public_read | 120/min middleware | IP | Medium for shared networks | Low/Medium scraping | Keep generous, include UA/client route key. |
| user_write | 30/min middleware plus route limits | IP | Medium for mobile reconnects/tabs | Medium write spam | Raise middleware write ceiling; rely on route-specific limits for risky writes. |
| auth_login | 10/15min IP plus 5 failed IP lockout | IP | High for office/VPN/carrier NAT | High credential attacks | Use normalized email + IP + UA bucket, generic errors, temporary cooldown. |
| auth_register | 5/min IP | IP | Medium for shared networks | Medium signup abuse | Use normalized email + IP + UA, 6/10min. |
| password_reset | 3/min IP, recipient 5min | IP plus user token check | Medium for shared networks | Medium email abuse/enumeration | Use normalized email + IP + UA; always return generic success. |
| mfa_verify | setup/confirm/disable had mixed IP/user caps; login MFA used login failure counter only | mixed | Medium if too strict | High backup-code guessing | Use user/session/route keyed 5/5min for MFA and backup-code paths, audit failures. |
| mobile_oauth_exchange | 20/min IP | IP | High for mobile retries/carrier NAT | Medium code replay/abuse | 60/min mobile client + IP + UA and code-bucket signal; tolerate retries. |
| provider_recommendations | 30/min user+IP prefix | IP with user in prefix | Medium for dashboard refresh/multiple tabs | Medium scraping | Raise to 120/min user route key; graceful 429 only for high frequency. |
| export_data | no route-specific limit, no step-up | session auth only | Low friction, high data risk | High account data exfiltration | Require step-up and 3/15min user/session cooldown with audit. |
| account_delete | 3/min IP plus step-up | IP | Medium for shared networks | High destructive action | Use user/session key, keep step-up, add MFA attempt limit and audit on failures. |
| admin_login | 5/15min IP, 30min lock | IP | Medium for shared admin network | High admin brute force | Keep stricter threshold but key by normalized email + IP + UA; add MFA sub-limit. |
| admin_sensitive_action | password confirm on many routes, no central limiter | admin/session in route auth | Low | High privilege abuse | Prefer step-up and audit; warn/shadow policy before hard blocking. |
| webhook | signature checks, body size caps, middleware global limit | provider signature, plus old middleware IP cap | Medium risk of blocking provider retries | High forged webhook | Skip global IP limiter; log signature failures without secrets. |
| cron | CRON_SECRET checks, old middleware could rate-limit | bearer secret plus IP cap | Low/Medium scheduler false positive | High secret misuse | Skip global IP limiter; log malformed/mismatched secret attempts. |
| internal | INTERNAL_WEBHOOK_SECRET checks | bearer secret | Low | High lateral misuse | Keep fail-closed secret boundary; log malformed/mismatched attempts. |

## Key Findings

1. User login was protected, but the hard lockout key was IP oriented. That can punish unrelated users on shared Wi-Fi/VPN/carrier NAT.
2. Password reset correctly avoided account enumeration, but the limiter was IP only and fairly tight.
3. Backup-code guesses during login had no dedicated MFA bucket; they only contributed to the broader login failure counter.
4. Mobile OAuth exchange was replay-safe at the code layer, but the rate limiter was too IP centric for mobile retry behavior.
5. Provider recommendations were protected, but 30/min is easy to hit with dashboard refreshes and multiple tabs.
6. Export data lacked step-up and route-specific cooldown despite returning sensitive account data.
7. Account deletion had step-up but used an IP-only rate key and did not separately limit MFA/backup-code step-up attempts.
8. Admin login was strict enough, but IP-only. It needed email + IP + UA bucketing.
9. Webhooks and cron/internal routes should rely on signature/secret verification, not the global IP write limiter.
10. Observability existed in places, but malformed cron/internal secret attempts and webhook signature failures needed safer, structured signals.

## Implementation Guidance

Use risk-based policy groups, avoid global tightening, keep normal app usage generous, and prefer step-up plus audit for sensitive actions. Avoid logging raw emails, tokens, passwords, MFA codes, backup codes, webhook signatures, cookies, DB URLs, or secrets.
