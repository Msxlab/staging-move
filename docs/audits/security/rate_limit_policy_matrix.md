# Rate-Limit / Auth-Limit Policy Matrix

Status: implementation matrix
Branch: fix/rate-limit-auth-protection
Date: 2026-05-07

This matrix documents the central route groups used by
`apps/web/src/lib/rate-limit-policy.ts`. The goal is balanced protection:
auth and sensitive operations remain protected, normal app usage stays
generous, and high-false-positive areas start in shadow or warn mode.

| group | mode | limit | key strategy | user impact posture | notes |
|---|---:|---:|---|---|---|
| `public_read` | enforce | 240 / 60s | IP + user-agent + route | generous | Middleware read protection. |
| `user_read` | shadow | 240 / 60s | user + route | measurement only | Disabled unless `RATE_LIMIT_SHADOW_USER_KEYED_ENABLED=true`. |
| `auth_login` | enforce | 12 / 15m | normalized email + IP + user-agent | focused | Existing login flow still returns generic errors. |
| `auth_register` | enforce | 6 / 10m | normalized email + IP + user-agent | focused | Policy foundation only in this PR. |
| `password_reset` | enforce | 5 / 15m | normalized email + IP + user-agent | enumeration-safe | Policy foundation only in this PR. |
| `password_reset_request` | enforce | 5 / 15m | normalized email + IP + user-agent | enumeration-safe | Request route should keep generic success. |
| `password_reset_confirm` | enforce | 5 / 10m | IP + user-agent + route | moderate | Token TTL remains primary control. |
| `mfa_verify` | enforce | 5 / 5m | user + session + route | stricter | Policy foundation and login telemetry. |
| `mobile_oauth_exchange` | enforce | 60 / 60s | mobile client + IP + user-agent | retry-tolerant | Policy foundation only in this PR. |
| `user_write` | enforce | 120 / 60s | user + session + route | generous | Middleware write protection. |
| `provider_recommendations` | enforce | 120 / 60s | user + route | generous | Policy foundation only in this PR. |
| `export_data` | enforce | 3 / 15m | user + session + route | sensitive | Export attempt telemetry only in this PR. |
| `export_pdf` | enforce | 3 / 60s | user + route | sensitive | Policy foundation only in this PR. |
| `account_delete` | enforce | 3 / 15m | user + session + route | sensitive | Account-delete attempt telemetry only in this PR. |
| `admin_login` | enforce | 5 / 15m | normalized email + IP + user-agent | strict | Policy foundation only in this PR. |
| `admin_sensitive_action` | warn | 10 / 5m | user + session + route | no hard block | Step-up and audit should remain primary controls. |
| `webhook` | warn | 0 | service secret/signature | no IP hard block | Signature verification is primary control. |
| `cron` | enforce | 0 | service secret | secret-gated | Middleware skips cron; auth remains secret-based. |
| `internal` | enforce | 0 | service secret | secret-gated | Middleware skips internal; auth remains secret-based. |

## Keying Guidance

- Avoid IP-only keys for authenticated user flows where a user or session key
  is available.
- Keep auth errors generic to avoid email enumeration.
- Prefer step-up and audit for destructive account actions.
- Prefer warn/shadow before enforcing limits on admin sensitive actions,
  webhooks, and high-volume normal app usage.
- Never log passwords, MFA codes, backup codes, raw tokens, DB URLs, Redis
  URLs, Stripe secrets, or raw webhook signatures.
