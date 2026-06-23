# Adversarial Verification — admin-auth-security-02

**Finding:** Default 'compat' proxy mode trusts client-supplied IP headers (IP-rule / rate-limit / fingerprint integrity)
**Original severity:** High
**Category:** Security
**Verdict:** CONFIRMED
**Adjusted severity:** High (unchanged)

## What the original finding claimed
`resolveTrustedClientIpFromHeaders` in `packages/shared/src/trusted-client-ip.ts` returns the first parseable
`cf-connecting-ip` / `x-real-ip` / `x-forwarded-for` value with NO trusted-proxy allowlist when
`TRUSTED_PROXY_HEADERS` is unset or set to `compat`, and that this value drives admin IP rules, login
rate-limiting / per-IP lockout, session fingerprint, adaptive known-network MFA suppression, and audit IP.

## Code I read and what it proves

### 1. Resolver has no trusted-proxy verification (packages/shared/src/trusted-client-ip.ts)
- `normalizeTrustedProxyHeaderMode` (lines 18-28): when `raw` is empty/`undefined`/`auto`/`compat` it returns
  `"compat"` — so **the default with the env var unset is `compat`** (line 22).
- `resolveTrustedClientIpFromHeaders` (lines 67-99): for `compat` (the fall-through after the `none`/`vercel`/
  `cloudflare`/`standard` branches), it returns
  `firstHeaderIp("cf-connecting-ip") || firstHeaderIp("x-real-ip") || firstHeaderIp("x-forwarded-for") || fallback`
  (lines 93-98), optionally preceded by `x-vercel-forwarded-for` only when `options.vercelEnv` is set.
- `firstHeaderValue` (lines 30-37) and `isValidIpCandidate` (lines 63-65) only validate that the header value
  is a **syntactically valid IPv4/IPv6 string** (length ≤ 45, no whitespace, hex/dot/colon charset, parseable).
  There is **no allowlist of trusted proxy source IPs, no hop-count check, and no `socket.remoteAddress`
  cross-check.** A grep for `trustedProxy|allowlist|remoteAddress|stripHeader|TRUSTED_PROXY_IPS` in this file
  returned no matches. The resolver trusts whatever IP-shaped string the client puts in the header.

### 2. `TRUSTED_PROXY_HEADERS` is absent from every `.env.example`
- grep for `TRUSTED_PROXY_HEADERS` across the repo matches source/test/docs but **none of the four
  `.env.example` files** (`/.env.example`, `apps/admin/.env.example`, `apps/mobile/.env.example`,
  `docker/.env.example`) contain it. So the default-deploy contract leaves it unset → `compat`.
- It *is* present in `packages/shared/src/env-catalog.ts:448` as `classification: "optional"`, but that is an
  internal config registry, not the `.env.example` env contract, so the finding's specific claim still holds.

### 3. Consumers all feed the resolved IP into security decisions
- **Middleware** `apps/admin/src/middleware.ts:83-89` `resolveClientIP` → used for:
  - IP rule enforcement `checkIPAccess(ip, ...)` at line 632-634 (allow/deny gate that returns 403).
  - Per-route rate-limit key `${policy.group}:${resolveClientIP(req)}:${routeKey}` at line 559.
  - Session fingerprint at lines 766-774: `ip` is passed into `generateAdminSessionFingerprint`. Per
    `apps/admin/src/lib/session-fingerprint.ts:42-49`, the fingerprint material includes `ip:${bucketClientIp(ip)}`
    (a /24 or /64 bucket).
- **Login route** `apps/admin/src/app/api/auth/login/route.ts:198-204` `resolveClientIP` → used at line 340 for:
  - Login rate-limit / per-IP lockout key `buildAdminLoginRateKey(email, ip)` (line 342, 216-218) feeding the
    5-attempt Redis lockout (`checkLoginRateLimitRedis`, lines 224-294).
  - `isKnownAdminLoginIp(adminId, ip)` (imported line 6) which, per `apps/admin/src/lib/admin-known-ip.ts:21-37`,
    buckets the IP to /24-or-/64 and decides whether the login is from a "known network." The doc comment
    (lines 11-13) states this is used to FORCE a fresh MFA challenge / email the operator when the network is
    new — so an attacker who can match a known bucket suppresses that adaptive friction.
- **Audit** `apps/admin/src/lib/audit.ts:152-159` `getAuditRequestMeta` uses the same resolver, so the
  `ipAddress` written to `adminAuditLog` / login audit is attacker-controllable in `compat` mode.

## Abuse scenario (high level, defensive framing)
If the admin app is reachable by any path that does **not** terminate at a single proxy that strips and rewrites
these IP headers (e.g. direct origin exposure, a misconfigured/leaky load balancer, or a multi-proxy chain), a
client can set `cf-connecting-ip` / `x-real-ip` / `x-forwarded-for` to a value of their choosing. The resolver
accepts it as the source IP. Consequences:
- Rotate the spoofed IP per request to evade the per-IP login lockout / per-route rate limits.
- Present an IP outside any deny rule (or inside an allow rule) to defeat IP-based access control.
- Match a victim's network /24 bucket to keep a stolen session's fingerprint valid and to mark a login as
  "known," suppressing the adaptive new-location MFA challenge and alert email.
- Forge the IP recorded in admin audit logs, degrading forensic accuracy.

## Caveats / boundary of the finding
- This is a **deployment-coupled** risk: if the admin app is, as intended, only ever reachable behind exactly one
  header-normalizing proxy (e.g. Cloudflare or Vercel that overwrites these headers), the practical exposure is
  reduced — but the code provides no enforcement of that and the safe modes (`cloudflare`/`vercel`/`standard`)
  are not the default and are not surfaced in `.env.example`. The secure posture depends entirely on operator
  configuration that the shipped env contract does not prompt for. This matches the original High rating for an
  admin/auth surface.

## Conclusion
The cited code matches the claim exactly: no trusted-proxy allowlist in `compat` (the unset default), the env var
missing from `.env.example`, and the resolved IP wired into IP rules, login lockout, fingerprint, adaptive MFA,
and audit. **Verdict: confirmed. Severity unchanged (High).**
