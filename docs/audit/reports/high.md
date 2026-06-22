# High Findings (10)

| ID | Area | Category | Finding | Evidence | Impact | Recommendation | Files | Verdict |
|---|---|---|---|---|---|---|---|---|

| account-deletion-export-01 | Account Deletion / Data Export (CCPA) | Data | Self-service Art. 17 erasure does not purge EmailLog (plaintext email survives) | processAccountDeletionRequest (account-deletion.ts:364-371) purges WaitlistSignup and NotificationQueue but never EmailLog; EmailLog.to plaintext VarChar(191) no User FK; admin hard-delete path deletes it (hard-delete-user.ts:316). | Deleted user plaintext email persists in EmailLog after GDPR/CCPA erasure until unrelated 180-day sweep; self-service erasure incomplete and inconsistent with admin path. | Add rawPrisma.emailLog.deleteMany({where:{to:deletedUserEmail}}) to processAccountDeletionRequest; audit other no-FK PII tables. | apps/web/src/lib/account-deletion.ts:364-371; apps/admin/src/lib/hard-delete-user.ts:309-316; packages/db/prisma/schema.prisma:1564-1585 | confirmed |

| account-deletion-export-04 | Account Deletion / Data Export (CCPA) | Security | CCPA Do-Not-Sell opt-out is recorded but never enforced (dead resolver) | hasCcpaOptOut/hasCcpaOptOutServer (ccpa.ts:32-68) referenced by no business code; sell/share surfaces (affiliate/click, sponsored/click, cron/lead-dispatch, affiliate/postback) contain no ccpa/optOut/DO_NOT_SELL check; opt-out persisted via /api/consent/ccpa to cookie + DataConsent but never consulted. | Consumer CPRA Do-Not-Sell/Share opt-out has no effect; data can still be shared after opt-out — compliance exposure and misleading privacy control. | Call hasCcpaOptOut() in every data-sharing path before transfer and skip when true, or document why each surface is exempt. | apps/web/src/lib/ccpa.ts:32-68; apps/web/src/app/api/affiliate/click/route.ts; apps/web/src/app/api/sponsored/click/route.ts; apps/web/src/app/api/cron/lead-dispatch/route.ts | confirmed |

| admin-auth-security-02 | Admin Auth & Security | Security | Default compat proxy mode trusts client-supplied IP headers (IP-rule / rate-limit / fingerprint integrity) | trusted-client-ip.ts:18-28,67-99 returns first cf-connecting-ip/x-real-ip/x-forwarded-for with NO trusted-proxy allowlist when TRUSTED_PROXY_HEADERS unset/compat; absent from .env.example; consumers middleware.ts, login/route.ts, audit.ts. | If not strictly behind a header-stripping proxy, clients forge source IP, defeating IP rules, per-IP login lockout, fingerprint IP bucket, adaptive known-network MFA suppression, audit accuracy. | Require explicit TRUSTED_PROXY_HEADERS in production; add to env contract; fail closed (IP=unknown) when prod-like and unset. | packages/shared/src/trusted-client-ip.ts; apps/admin/src/middleware.ts; apps/admin/src/app/api/auth/login/route.ts; apps/admin/src/lib/audit.ts | confirmed |

| admin-impersonation-02 | Admin Impersonation | Logic | Per-mutation impersonation audit (recordImpersonatedMutation) is never invoked | recordImpersonatedMutation in impersonation-audit.ts referenced only by its own test; no web route calls it; mutating routes (auth/security) write only their own user-scoped AuditLog. | Core forensic guarantee of impersonation absent; only START/HANDOFF logged; what admin did while acting as user not attributable, defeating GDPR/abuse-investigation. | Invoke recordImpersonatedMutation (or centralized wrapper checking session.impersonatedByAdminId) from all mutating web routes. | apps/web/src/lib/impersonation-audit.ts; apps/web/src/app/api/**/route.ts | confirmed |

| component-theme-system-02 | Component & Theme System | Accessibility | Accent-on-white CTAs fail dark-mode contrast (EmptyState button, AppShell skip-link) | EmptyState primary bg-tone-orange-fg text-white (empty-state.tsx:36) and AppShell skip-link bg-brand-orange text-white (app-shell.tsx:108); dark Gold #CBA45E; white-on-Gold 2.33:1; light Sapphire 6.21:1. | Primary empty-state CTA and keyboard skip link unreadable in default theme. | Use near-black ink (text-primary-foreground) on Gold, matching Button default (8.45:1). | apps/web/src/components/shared/empty-state.tsx:36; apps/web/src/components/layout/app-shell.tsx:108 | confirmed |

| external-data-integrations-01 | External Data Integrations | Reliability | EV-charging integration targets a likely-wrong upstream host (developer.nlr.gov vs NREL developer.nrel.gov) | nlr-alt-fuel-stations.ts:70 NLR_NEAREST_URL=https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json; AFDC nearest endpoint canonically at developer.nrel.gov; wrong NLR naming systemic in runtime-config and test. | When owner enables flag+key, lookup almost certainly fails DNS/host and returns error; dossier EV-charging section silently never appears; config effort wasted. | Verify host/path against NREL docs; correct NLR_NEAREST_URL/source URLs, rename key/flag, repoint host-pinning test. | apps/web/src/lib/nlr-alt-fuel-stations.ts:9,61,70,79; apps/web/src/lib/nlr-alt-fuel-stations.test.ts:75; packages/shared/src/runtime-config.ts:651-678 | confirmed |

| mobile-iap-billing-01 | Mobile IAP Billing (Apple/Google) | Security | No user-to-receipt binding; appAccountToken / obfuscatedExternalAccountId typed but never enforced | appAccountToken declared (iap-apple.ts:137) and obfuscatedExternalAccountId (iap-google.ts:230) but zero non-type usages; applyIapStateToUser relies solely on first-claim DB uniqueness of originalTransactionId/purchaseTokenHash. | Unclaimed signed transaction/token can be claimed by whichever account verifies it first; no cryptographic proof submitter is buyer. Entitlement theft / buyer lockout. | Set appAccountToken/obfuscatedAccountId to authenticated userId at purchase; require payload token === userId on server before granting; reject mismatches. | apps/web/src/lib/iap-apple.ts:137, apps/web/src/lib/iap-google.ts:230, apps/web/src/lib/iap-common.ts:582-598, apps/web/src/app/api/mobile/iap/verify/route.ts | confirmed |

| mobile-iap-purchase-01 | Mobile IAP Purchase flow | Security | IAP purchase not bound to the initiating account (appAccountToken / obfuscatedExternalAccountId unused) | appAccountToken (iap-apple.ts:137) and obfuscatedExternalAccountId (iap-google.ts:230) referenced only in type defs; never read in verify or applyIapStateToUser; client never sets them at requestPurchase. | Store receipt claimed by first authenticated account that verifies it; with restore/reconcile posting any owned transaction, enables receipt mis-attribution / claim abuse (cross-account guard triggers only after one account owns). | Set appAccountToken/obfuscatedAccountId to userId at requestPurchase; in verify and both webhooks assert payload token===session userId before granting; reject mismatch. | apps/web/src/lib/iap-apple.ts:137, apps/web/src/lib/iap-google.ts:230, apps/web/src/app/api/mobile/iap/verify/route.ts, apps/web/src/lib/iap-common.ts:574, apps/mobile/src/lib/iap.ts:184 | confirmed |

| marketing-seo-content-01 | marketing-seo-content | Data | Legal entity name and mailing address are unresolved placeholders on legal pages | legal-info.ts:1-15 defines placeholders; displayLegalEntityName returns product name LocateFlow when unset, displayCompanyAddress null; contact/page.tsx:124-130 shows product name; .env.example:138-139 ships literal placeholders. | Terms/Privacy/DPA/CCPA/Contact can go live without real legal entity or mailing address — compliance/legal-completeness gap. | Populate NEXT_PUBLIC_LEGAL_ENTITY_NAME/COMPANY_ADDRESS for production; add production-readiness guard failing build if placeholder remains. | apps/web/src/lib/legal-info.ts:1-15, apps/web/src/app/contact/page.tsx:124-130, .env.example:138-139 | confirmed |

| route-map-01 | route-map | Logic | Partner self-service pages (/partners/apply, /partners/portal) unreachable while logged out | middleware.ts:26-59 PUBLIC_PATHS includes /movers/apply,/movers/portal but NOT /partners/*; page branch 838-848 redirects non-session to /sign-in. | Partners cannot self-apply or sign into portal from clean browser; entire partner acquisition/self-serve surface dead. | Add /partners/apply and /partners/portal to PUBLIC_PATHS, keeping in-page partner-session gate. | apps/web/src/middleware.ts:26-59,838-848; apps/web/src/app/partners/portal/page.tsx; apps/web/src/app/partners/apply/page.tsx | confirmed |



## Details

### account-deletion-export-01 — Self-service Art. 17 erasure does not purge EmailLog (plaintext email survives)

- **Area:** Account Deletion / Data Export (CCPA)
- **Category:** Data
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** processAccountDeletionRequest (account-deletion.ts:364-371) purges WaitlistSignup and NotificationQueue but never EmailLog; EmailLog.to plaintext VarChar(191) no User FK; admin hard-delete path deletes it (hard-delete-user.ts:316).
- **Impact:** Deleted user plaintext email persists in EmailLog after GDPR/CCPA erasure until unrelated 180-day sweep; self-service erasure incomplete and inconsistent with admin path.
- **Recommendation:** Add rawPrisma.emailLog.deleteMany({where:{to:deletedUserEmail}}) to processAccountDeletionRequest; audit other no-FK PII tables.
- **Files:** apps/web/src/lib/account-deletion.ts:364-371; apps/admin/src/lib/hard-delete-user.ts:309-316; packages/db/prisma/schema.prisma:1564-1585

### account-deletion-export-04 — CCPA Do-Not-Sell opt-out is recorded but never enforced (dead resolver)

- **Area:** Account Deletion / Data Export (CCPA)
- **Category:** Security
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** hasCcpaOptOut/hasCcpaOptOutServer (ccpa.ts:32-68) referenced by no business code; sell/share surfaces (affiliate/click, sponsored/click, cron/lead-dispatch, affiliate/postback) contain no ccpa/optOut/DO_NOT_SELL check; opt-out persisted via /api/consent/ccpa to cookie + DataConsent but never consulted.
- **Impact:** Consumer CPRA Do-Not-Sell/Share opt-out has no effect; data can still be shared after opt-out — compliance exposure and misleading privacy control.
- **Recommendation:** Call hasCcpaOptOut() in every data-sharing path before transfer and skip when true, or document why each surface is exempt.
- **Files:** apps/web/src/lib/ccpa.ts:32-68; apps/web/src/app/api/affiliate/click/route.ts; apps/web/src/app/api/sponsored/click/route.ts; apps/web/src/app/api/cron/lead-dispatch/route.ts

### admin-auth-security-02 — Default compat proxy mode trusts client-supplied IP headers (IP-rule / rate-limit / fingerprint integrity)

- **Area:** Admin Auth & Security
- **Category:** Security
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** trusted-client-ip.ts:18-28,67-99 returns first cf-connecting-ip/x-real-ip/x-forwarded-for with NO trusted-proxy allowlist when TRUSTED_PROXY_HEADERS unset/compat; absent from .env.example; consumers middleware.ts, login/route.ts, audit.ts.
- **Impact:** If not strictly behind a header-stripping proxy, clients forge source IP, defeating IP rules, per-IP login lockout, fingerprint IP bucket, adaptive known-network MFA suppression, audit accuracy.
- **Recommendation:** Require explicit TRUSTED_PROXY_HEADERS in production; add to env contract; fail closed (IP=unknown) when prod-like and unset.
- **Files:** packages/shared/src/trusted-client-ip.ts; apps/admin/src/middleware.ts; apps/admin/src/app/api/auth/login/route.ts; apps/admin/src/lib/audit.ts

### admin-impersonation-02 — Per-mutation impersonation audit (recordImpersonatedMutation) is never invoked

- **Area:** Admin Impersonation
- **Category:** Logic
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** recordImpersonatedMutation in impersonation-audit.ts referenced only by its own test; no web route calls it; mutating routes (auth/security) write only their own user-scoped AuditLog.
- **Impact:** Core forensic guarantee of impersonation absent; only START/HANDOFF logged; what admin did while acting as user not attributable, defeating GDPR/abuse-investigation.
- **Recommendation:** Invoke recordImpersonatedMutation (or centralized wrapper checking session.impersonatedByAdminId) from all mutating web routes.
- **Files:** apps/web/src/lib/impersonation-audit.ts; apps/web/src/app/api/**/route.ts

### component-theme-system-02 — Accent-on-white CTAs fail dark-mode contrast (EmptyState button, AppShell skip-link)

- **Area:** Component & Theme System
- **Category:** Accessibility
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** EmptyState primary bg-tone-orange-fg text-white (empty-state.tsx:36) and AppShell skip-link bg-brand-orange text-white (app-shell.tsx:108); dark Gold #CBA45E; white-on-Gold 2.33:1; light Sapphire 6.21:1.
- **Impact:** Primary empty-state CTA and keyboard skip link unreadable in default theme.
- **Recommendation:** Use near-black ink (text-primary-foreground) on Gold, matching Button default (8.45:1).
- **Files:** apps/web/src/components/shared/empty-state.tsx:36; apps/web/src/components/layout/app-shell.tsx:108

### external-data-integrations-01 — EV-charging integration targets a likely-wrong upstream host (developer.nlr.gov vs NREL developer.nrel.gov)

- **Area:** External Data Integrations
- **Category:** Reliability
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** nlr-alt-fuel-stations.ts:70 NLR_NEAREST_URL=https://developer.nlr.gov/api/alt-fuel-stations/v1/nearest.json; AFDC nearest endpoint canonically at developer.nrel.gov; wrong NLR naming systemic in runtime-config and test.
- **Impact:** When owner enables flag+key, lookup almost certainly fails DNS/host and returns error; dossier EV-charging section silently never appears; config effort wasted.
- **Recommendation:** Verify host/path against NREL docs; correct NLR_NEAREST_URL/source URLs, rename key/flag, repoint host-pinning test.
- **Files:** apps/web/src/lib/nlr-alt-fuel-stations.ts:9,61,70,79; apps/web/src/lib/nlr-alt-fuel-stations.test.ts:75; packages/shared/src/runtime-config.ts:651-678
- **needsVerification:** true

### mobile-iap-billing-01 — No user-to-receipt binding; appAccountToken / obfuscatedExternalAccountId typed but never enforced

- **Area:** Mobile IAP Billing (Apple/Google)
- **Category:** Security
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** appAccountToken declared (iap-apple.ts:137) and obfuscatedExternalAccountId (iap-google.ts:230) but zero non-type usages; applyIapStateToUser relies solely on first-claim DB uniqueness of originalTransactionId/purchaseTokenHash.
- **Impact:** Unclaimed signed transaction/token can be claimed by whichever account verifies it first; no cryptographic proof submitter is buyer. Entitlement theft / buyer lockout.
- **Recommendation:** Set appAccountToken/obfuscatedAccountId to authenticated userId at purchase; require payload token === userId on server before granting; reject mismatches.
- **Files:** apps/web/src/lib/iap-apple.ts:137, apps/web/src/lib/iap-google.ts:230, apps/web/src/lib/iap-common.ts:582-598, apps/web/src/app/api/mobile/iap/verify/route.ts

### mobile-iap-purchase-01 — IAP purchase not bound to the initiating account (appAccountToken / obfuscatedExternalAccountId unused)

- **Area:** Mobile IAP Purchase flow
- **Category:** Security
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** appAccountToken (iap-apple.ts:137) and obfuscatedExternalAccountId (iap-google.ts:230) referenced only in type defs; never read in verify or applyIapStateToUser; client never sets them at requestPurchase.
- **Impact:** Store receipt claimed by first authenticated account that verifies it; with restore/reconcile posting any owned transaction, enables receipt mis-attribution / claim abuse (cross-account guard triggers only after one account owns).
- **Recommendation:** Set appAccountToken/obfuscatedAccountId to userId at requestPurchase; in verify and both webhooks assert payload token===session userId before granting; reject mismatch.
- **Files:** apps/web/src/lib/iap-apple.ts:137, apps/web/src/lib/iap-google.ts:230, apps/web/src/app/api/mobile/iap/verify/route.ts, apps/web/src/lib/iap-common.ts:574, apps/mobile/src/lib/iap.ts:184

### marketing-seo-content-01 — Legal entity name and mailing address are unresolved placeholders on legal pages

- **Area:** marketing-seo-content
- **Category:** Data
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** legal-info.ts:1-15 defines placeholders; displayLegalEntityName returns product name LocateFlow when unset, displayCompanyAddress null; contact/page.tsx:124-130 shows product name; .env.example:138-139 ships literal placeholders.
- **Impact:** Terms/Privacy/DPA/CCPA/Contact can go live without real legal entity or mailing address — compliance/legal-completeness gap.
- **Recommendation:** Populate NEXT_PUBLIC_LEGAL_ENTITY_NAME/COMPANY_ADDRESS for production; add production-readiness guard failing build if placeholder remains.
- **Files:** apps/web/src/lib/legal-info.ts:1-15, apps/web/src/app/contact/page.tsx:124-130, .env.example:138-139

### route-map-01 — Partner self-service pages (/partners/apply, /partners/portal) unreachable while logged out

- **Area:** route-map
- **Category:** Logic
- **Severity:** High
- **Verdict:** confirmed
- **Evidence:** middleware.ts:26-59 PUBLIC_PATHS includes /movers/apply,/movers/portal but NOT /partners/*; page branch 838-848 redirects non-session to /sign-in.
- **Impact:** Partners cannot self-apply or sign into portal from clean browser; entire partner acquisition/self-serve surface dead.
- **Recommendation:** Add /partners/apply and /partners/portal to PUBLIC_PATHS, keeping in-page partner-session gate.
- **Files:** apps/web/src/middleware.ts:26-59,838-848; apps/web/src/app/partners/portal/page.tsx; apps/web/src/app/partners/apply/page.tsx
- **needsVerification:** true


## Refuted / Downgraded (not active)
| ID | Area | Original Sev | Adjusted | Title | Why refuted |
|---|---|---|---|---|---|
| security-platform-01 | Security Platform | High | Low | Default compat client-IP trust takes left-most forwarded header, enabling IP spoofing | Resolver mechanics accurate but exploitability fully config-dependent; readiness warns and edge expected to strip; duplicate of admin-auth-security-02/security-surface-04 confirmed elsewhere. |
| repo-overview-01 | repo-overview | High | Low | Multiple cron schedulers target same /api/cron/* surface without shared interlock | Environment-partitioned by design; prod=DigitalOcean, ofelia=self-hosted, vercel=staging. |
