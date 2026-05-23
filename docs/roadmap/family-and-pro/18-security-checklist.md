# Security Checklist — Cross-Cutting

- **Status**: Proposed (Family/Pro launch, all sprints)
- **Tier**: Infrastructure (applies to every feature doc)
- **Related decisions**: D5 (rol matris), D9 (token hashed), D10 (step-up), D17 (migration), D19 (event-level auth)
- **Related docs**: tüm 02–67

## Amaç

Her feature doc'unun "Güvenlik" bölümünün karşılaması gereken çapraz kesen güvenlik gereksinimleri matrisi. Bu doc tek-feature spec'i değil; **review aracıdır**. Bir doc reject edilirken bu matrise referansla "X satırı eksik" denir.

Aynı zamanda lansman öncesi production readiness checklist: her requirement işaretlenmeden go-live yapılmaz.

## Yapı

Aşağıdaki tablo her topic için:
- **Requirement** — ne sağlanmalı
- **MVP/Faz 2** — lansman blocker mı sonraya mı
- **Enforced where** — kod/dosya/sistem
- **Verify how** — test veya manual kontrol

## 1. Authentication

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 1.1 | Tüm authenticated route'lar `requireWorkspaceContext` çağırır | MVP | `apps/web/src/lib/workspace-context.ts` (→ 07) | Integration test: middleware mock unauth → 401 |
| 1.2 | Session cookie httpOnly + secure + sameSite=lax | MVP | NextAuth config `apps/web/src/lib/auth.ts` | Manual cookie inspect prod |
| 1.3 | Step-up auth challenge yaratımı + verify endpoint çalışır | MVP | `/api/auth/challenge*` (→ 15, 16) | E2E: address change wizard submit |
| 1.4 | Step-up tek-kullanım enforce | MVP | service layer transaction (→ 15) | Integration: aynı challenge 2x consume → 409 |
| 1.5 | MFA enabled user TOTP zorunlu step-up'ta | MVP | `detectChallengeMethods` (→ 16) | E2E with TOTP user |
| 1.6 | OAuth-only user fallback EMAIL_OTP | MVP | step-up flow (→ 16) | E2E with Google-only user |
| 1.7 | Mobile biometric LOCAL unlock + server verify | MVP | `expo-secure-store` + verify endpoint (→ 16) | Detox test biometric mock |
| 1.8 | Password reset token hashed in DB (SHA-256) | MVP | mevcut `PasswordResetToken` model | Code audit |
| 1.9 | Workspace invitation token hashed (D9) | MVP | `WorkspaceInvitation.tokenHash` (→ 04) | Code audit |
| 1.10 | Session refresh on step-up success | MVP | session helper | Integration: lastActivityAt updated |
| 1.11 | SSO/SAML enterprise | Faz 2 | — | — |

## 2. Authorization (workspace role matrix)

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 2.1 | 5 sabit rol (OWNER/ADMIN/MEMBER/CHILD/VIEW_ONLY) — JSON permission yok (D5) | MVP | `WorkspaceMember.role` enum + `apps/web/src/lib/permissions.ts` (yeni dosya) | Unit: matrix test 5 rol × 30+ action |
| 2.2 | Owner-only operations: workspace delete, owner transfer, billing change | MVP | route handlers + permission helper | Integration: ADMIN delete attempt → 403 |
| 2.3 | CHILD role: finansal alanları görmez (`Service.paidByUserId` decryptable değil, billing UI hidden) | MVP | UI + API filter (→ 22) | Manual: CHILD login UI screenshot |
| 2.4 | VIEW_ONLY: hiçbir mutation route'una geçemez | MVP | permission helper guard | Integration: VIEW_ONLY POST → 403 |
| 2.5 | ALL_WORKSPACE scope: OWNER/ADMIN only (→ 11) | MVP | event create handler | Integration |
| 2.6 | Member remove: OWNER (admins removable by owner only) | MVP | DELETE /api/workspaces/:id/members | Integration |
| 2.7 | Cross-workspace data leak: workspaceId filter her query'de | MVP | Prisma helpers + integration tests | Test suite: 2 workspace setup, cross-fetch → empty |
| 2.8 | Resource ownership check: address/service/event workspaceId === ctx.workspaceId | MVP | route guard | Integration |
| 2.9 | Custom roles | Faz 3 | — | — |

## 3. Data protection

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 3.1 | Encryption at rest: `Service.accountNumber`, `Service.username`, `Subscription.stripeCustomerId` | MVP | `packages/shared/src/encryption.ts` | Code audit + unit test encrypt/decrypt |
| 3.2 | MFA secret encrypted | MVP | `User.mfaSecret @db.Text` encrypted | Code audit |
| 3.3 | Step-up challenge hash (bcrypt EMAIL_OTP) | MVP | `WorkspaceAuthChallenge.challengeHash` (→ 15) | Code audit |
| 3.4 | Address fields encryption at rest | Faz 2 (UX cost) | — | — |
| 3.5 | Backup encryption (DB snapshots) | MVP | infra: managed DB encryption-at-rest | Provider config |
| 3.6 | PII redaction in logs: email, address.street, phone, ssn | MVP | `apps/web/src/lib/logger.ts` middleware (yeni dosya) | Unit: log fixture → redacted string |
| 3.7 | Notes/freeform field hash log instead of plaintext | MVP | logger middleware | Unit |
| 3.8 | GDPR DSAR (data export) endpoint | MVP | `/api/account/export` (mevcut) extend Workspace data | Integration: full export includes Workspace entities |
| 3.9 | GDPR erase (account deletion) cascade — User + Workspace owned + memberships | MVP | `apps/web/src/lib/account-deletion.ts` extend | Integration: delete user → DB query verify 0 rows |
| 3.10 | CCPA do-not-sell signal | MVP | mevcut `apps/web/src/lib/ccpa.ts` extend | Manual |
| 3.11 | Data residency (EU users) | Faz 2 | — | — |
| 3.12 | PII access audit (sensitive read logging) | MVP | route handler + audit helper | Integration: read service.accountNumber decrypt → audit row |

## 4. Rate limiting

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 4.1 | Per-user, per-endpoint limits | MVP | `apps/web/src/lib/rate-limit.ts` (mevcut) | Unit |
| 4.2 | Step-up create: 10/saat per user | MVP | → 16 | Integration |
| 4.3 | EMAIL_OTP create: 3/saat per user | MVP | → 16 | Integration |
| 4.4 | AddressChange event POST: 10/saat per user, 30/saat per workspace | MVP | → 11 | Integration |
| 4.5 | Partner sync attempt PATCH: 60/min per user | MVP | → 35 | Integration |
| 4.6 | Login attempts: 5 per IP per 15 min, account lock after 10 fail | MVP | mevcut auth | Integration |
| 4.7 | Per-IP global fallback: 100 req/min anonymous, 600 req/min authenticated | MVP | edge middleware | Manual load test |
| 4.8 | Workspace invitation create: 20/saat per workspace | MVP | → 04 | Integration |
| 4.9 | Billing checkout: 10/min per user | MVP | mevcut | Integration |
| 4.10 | Adaptive rate limit (suspicious pattern) | Faz 2 | — | — |

## 5. Audit logging

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 5.1 | `AuditLog` row per create/update/delete sensitive entity | MVP | `apps/web/src/lib/audit.ts` (mevcut, extend) | Integration: action → DB row |
| 5.2 | Sensitive reads (Service decrypt, PII export) audit'li | MVP | route handler | Integration |
| 5.3 | Auth challenge create/verify/consume → audit (→ 15) | MVP | → 15 | Integration |
| 5.4 | Address change lifecycle → audit (→ 11) | MVP | → 11 | Integration |
| 5.5 | Member add/remove/role change → audit | MVP | → 03 | Integration |
| 5.6 | Billing change (sub create/cancel/upgrade) → audit | MVP | mevcut + extend | Integration |
| 5.7 | Failed authorization (403) → audit `unauthorized_attempt` | MVP | middleware | Integration |
| 5.8 | IP + UA in every audit row | MVP | audit helper | Code audit |
| 5.9 | Audit log immutable (no UPDATE/DELETE) | MVP | DB role permissions + code | Code audit |
| 5.10 | Audit log retention 1 year (90 day hot, 1y cold) | MVP | cron archive | Manual |
| 5.11 | Audit log export (admin) | MVP | `/admin/audit-logs/export` | Manual |
| 5.12 | Real-time SIEM ingestion | Faz 2 | — | — |

## 6. Input validation

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 6.1 | Tüm POST/PATCH body Zod schema ile parse | MVP | `apps/web/src/lib/validators/*` | Code audit |
| 6.2 | Query params Zod | MVP | route handlers | Code audit |
| 6.3 | Path params validated (cuid format) | MVP | route handlers | Unit |
| 6.4 | String length limits (notes 2000, label 120, email RFC 5321) | MVP | Zod | Unit |
| 6.5 | Email canonicalization before DB write | MVP | mevcut | Unit |
| 6.6 | URL fields validated http(s) only, no javascript: | MVP | Zod `.url()` + custom refine | Unit |
| 6.7 | File upload MIME + size + magic bytes | MVP | upload route | Integration |
| 6.8 | Webhook payloads strict schema | MVP | webhook handlers | Unit |

## 7. Output sanitization

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 7.1 | API responses no internal IDs/tokens leak (Stripe sk_, AWS keys) | MVP | response serialization layer | Snapshot tests |
| 7.2 | Error messages user-safe (no stack traces in prod) | MVP | `apps/web/src/app/error.tsx` + API error handler | Manual prod check |
| 7.3 | React XSS: dangerouslySetInnerHTML banned without sanitize | MVP | ESLint rule | Lint |
| 7.4 | Markdown rendering: DOMPurify | MVP | mevcut blog | Code audit |
| 7.5 | CSV/PDF export: escape formula injection (= + - @ prefixes) | MVP | `apps/web/src/lib/csv-export.ts` | Unit |

## 8. CSRF

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 8.1 | Next.js Server Actions: built-in CSRF | MVP | App Router | Code audit |
| 8.2 | API routes: SameSite cookie + origin check | MVP | route handlers | Integration: cross-origin POST → 403 |
| 8.3 | Mutating GET endpoints — yok | MVP | route audit | Code audit |
| 8.4 | Double-submit token for legacy forms (if any) | MVP if legacy | — | — |

## 9. CORS

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 9.1 | Default same-origin, no public CORS | MVP | next.config.js | Manual: OPTIONS req |
| 9.2 | Mobile API: explicit allowed origins (app scheme + dev tunnel) | MVP | CORS middleware | Manual |
| 9.3 | `X-Workspace-Id` header allowed (→ 08) | MVP | CORS allow-list extend | Integration |
| 9.4 | Preflight cache 24h | MVP | response header | Manual |

## 10. Webhook signatures

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 10.1 | Stripe: `stripe-signature` HMAC verify | MVP | `/api/webhooks/stripe/route.ts` (mevcut) | Integration: invalid sig → 400 |
| 10.2 | App Store Server Notifications V2: JWS verify | MVP | `/api/webhooks/app-store/route.ts` | Integration |
| 10.3 | Play Store RTDN: pub/sub message validation | MVP | `/api/webhooks/play-store/route.ts` | Integration |
| 10.4 | Webhook idempotency (replay): event ID dedupe | MVP | DB unique constraint on event_id | Integration: same event 2x → 1 processed |
| 10.5 | Webhook secrets in env vars, never logged | MVP | env config + logger redaction | Code audit |

## 11. Token storage

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 11.1 | Workspace invitation token: SHA-256 hash, plaintext only in email (D9) | MVP | → 04 | Code audit |
| 11.2 | Password reset token: hash | MVP | mevcut | Code audit |
| 11.3 | API tokens (if any) hashed | MVP | — (no public API tokens MVP) | — |
| 11.4 | OAuth provider tokens (PartnerConsent) encrypted at rest | MVP (D8 skeleton) | `PartnerConsent.tokenEncrypted` (→ 45) | Code audit |
| 11.5 | Mobile refresh token: `expo-secure-store` | MVP | mobile auth | Manual |
| 11.6 | Mobile biometric password: secure store + opt-in | MVP | → 16 | Code audit |

## 12. Revocation

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 12.1 | User logout → all UserLoginSession invalidated | MVP | mevcut | Integration |
| 12.2 | Password change → all sessions invalidated except current | MVP | mevcut auth | Integration |
| 12.3 | Member remove → member's session for that workspace invalidated | MVP | session helper (yeni) | Integration |
| 12.4 | Workspace delete → all members logged out from that workspace | MVP | cascade | Integration |
| 12.5 | Step-up challenge invalidation (admin force) | MVP | → 15 | Integration |
| 12.6 | Invitation revoke (D9) | MVP | → 04 | Integration |
| 12.7 | PartnerConsent revoke (skeleton) | MVP (D8) | → 45 | Code audit (no real action) |

## 13. Monitoring/alerting

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 13.1 | Sentry: all unhandled errors | MVP | mevcut | Manual: trigger error |
| 13.2 | Failed step-up challenges >10 in 1 hour per user → Slack alert | MVP | cron-based check → Slack webhook | Manual test fire |
| 13.3 | Rapid address changes >5 per user per day → flag for review | MVP | nightly query | Manual |
| 13.4 | Workspace member adds >20 per workspace per day → alert | MVP | nightly | Manual |
| 13.5 | Webhook signature failures >5/hour → alert | MVP | log-based alert | Manual |
| 13.6 | Auth challenge invalidation spike → alert | MVP | log-based alert | Manual |
| 13.7 | Database slow queries (>1s) → log + alert | MVP | DB slow query log + Sentry perf | Manual |
| 13.8 | Anomaly detection ML | Faz 2 | — | — |
| 13.9 | Uptime monitoring per endpoint (StatusGator/UptimeRobot) | MVP | external | Manual |
| 13.10 | Subscription webhook lag >5min → alert | MVP | timestamp comparison cron | Manual |

## 14. Secrets management

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 14.1 | Tüm sırlar env var (no hardcoded) | MVP | code audit + gitleaks pre-commit | Manual gitleaks scan |
| 14.2 | FIELD_ENCRYPTION_KEY rotation plan (yıllık) | MVP | infra doc | Manual |
| 14.3 | Stripe webhook secret in env, not DB | MVP | env config | Code audit |
| 14.4 | Production secrets vs. staging separate | MVP | infra | Manual |
| 14.5 | Vault/KMS integration | Faz 2 | — | — |

## 15. Frontend security

| # | Requirement | MVP/Faz 2 | Enforced where | Verify how |
|---|---|---|---|---|
| 15.1 | CSP header strict (script-src self + Stripe + analytics) | MVP | next.config.js headers | Manual: observatory.mozilla.org |
| 15.2 | X-Frame-Options DENY | MVP | next.config.js | Manual |
| 15.3 | HSTS preload | MVP | next.config.js | Manual |
| 15.4 | localStorage no PII beyond wizard draft (→ 13) | MVP | code audit | Code audit |
| 15.5 | LCP < 2.5s on dashboard | MVP-stretch | perf monitoring | Lighthouse |

## Sign-off matrix

Lansman öncesi her bir item bir owner tarafından check edilir:

```
Auth         [ ] mustafa@axtrasolutions.com  date: ______
Authz        [ ] ___________________________ date: ______
Data         [ ] ___________________________ date: ______
RateLimit    [ ] ___________________________ date: ______
Audit        [ ] ___________________________ date: ______
Input        [ ] ___________________________ date: ______
Output       [ ] ___________________________ date: ______
CSRF         [ ] ___________________________ date: ______
CORS         [ ] ___________________________ date: ______
Webhooks     [ ] ___________________________ date: ______
Tokens       [ ] ___________________________ date: ______
Revocation   [ ] ___________________________ date: ______
Monitoring   [ ] ___________________________ date: ______
Secrets      [ ] ___________________________ date: ______
Frontend     [ ] ___________________________ date: ______
```

## Açık sorular

1. Pen-test lansman öncesi mi sonrası mı? **Karar önerisi**: Öncesi (Sprint 4 son hafta), bulgular Faz 2'ye refactor için backlog'a.
2. Bug bounty programı? **Karar önerisi**: Lansman+1 ay sonra HackerOne private (kapasite stabil olduktan sonra).
3. SOC 2 readiness — bu checklist yeterli mi? **Karar önerisi**: Hayır, SOC 2 ayrı discipline; bu checklist application security odaklı; SOC 2 process+infra+org.
4. Mobil-only güvenlik check (jailbreak detection, certificate pinning) MVP'de var mı? **Karar önerisi**: Cert pinning evet, jailbreak detection hayır (FP riski yüksek).
5. CSP `'unsafe-inline'` style için kaçınılmaz mı? **Karar önerisi**: Nonce-based; Next.js 15 destekliyor.
