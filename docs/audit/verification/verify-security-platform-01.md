# Adversarial Verification — security-platform-01

**Finding under review:** Default `compat` client-IP trust takes left-most forwarded header, enabling IP spoofing of every IP-keyed control
**Claimed severity:** High
**Category:** Security
**Verdict:** REFUTED (in the self-hosted production topology; Vercel path also not exploitable)

---

## What the prior auditor claimed

In `compat` mode (the default when `TRUSTED_PROXY_HEADERS` is unset), the resolver returns
`cf-connecting-ip || x-real-ip || x-forwarded-for` and takes `value.split(",")[0]` (the left-most,
client-controllable entry). Because `.env.example` does not set the var, compat ships by default,
and `production-readiness.ts` only WARNs (not fails). The resolved IP feeds `checkIPAccess`
(IP BLACKLIST/WHITELIST), the rate limiter, abuse counters, and audit/alert IPs — so a client could
forge its apparent IP.

## What the code actually shows

### The resolver mechanics are described accurately
- `packages/shared/src/trusted-client-ip.ts:30-37` — `firstHeaderValue` does `value?.split(",")[0]` — left-most entry. True.
- `:93-98` — compat branch returns `cf-connecting-ip || x-real-ip || x-forwarded-for`. True.
- `:89-92` — when `vercelEnv` is set, compat first prefers `x-vercel-forwarded-for`.
- `apps/web/src/lib/client-ip.ts:12-18` — passes `process.env.TRUSTED_PROXY_HEADERS` and `VERCEL_ENV`; fallback `"anonymous"`. True.
- No `.env.example` in the repo sets `TRUSTED_PROXY_HEADERS` (grep across all `.env.example` — no matches), so compat is the shipped default. True.
- `apps/web/src/lib/production-readiness.ts:183-185, 450-456` — `warn()` always emits severity `"warn"`; readiness is `ready = failCount === 0` (`:539-543,76`-style), so compat in prod is non-blocking. True.

### The consumers are wired as claimed
- `apps/web/src/middleware.ts:792` → `checkIPAccess(ip, ...)`; `apps/web/src/lib/ip-rules.ts:96-124` matches `r.ipAddress === ip` for BLACKLIST/WHITELIST. True.
- `apps/web/src/lib/rate-limit.ts:296` keys the rate limiter on `resolveClientIpFromHeaders`. True.
- `apps/web/src/lib/audit.ts:38` uses the same resolver for `ipAddress`. True.

### Why the attack is NOT realizable — the production edge strips the spoofable headers
The decisive evidence is the actual production reverse proxy, wired in `docker-compose.prod.yml:254-276`
(service `caddy`, mounting `./docker/Caddyfile`). The Caddyfile (`docker/Caddyfile`) does precisely what
the prior finding's own caveat ("If the prod edge does not overwrite/strip these headers") requires to
NOT hold:

- `docker/Caddyfile:35-38` (web), `:63-66` (admin), `:93-96`, `:124-127` — the edge explicitly **strips**
  every client-supplied forwarding header on ingress:
  `request_header -CF-Connecting-IP`, `-X-Real-IP`, `-X-Forwarded-For`, `-X-Vercel-Forwarded-For`.
- `:41-42`, `:69-70` — it then re-injects a single trusted value:
  `header_up X-Real-IP {client_ip}` and `header_up X-Forwarded-For {client_ip}`.
- `:22-24` — `trusted_proxies static <Cloudflare ranges>` + `trusted_proxies_strict` +
  `client_ip_headers CF-Connecting-IP X-Forwarded-For`, so Caddy only derives `{client_ip}` from those
  headers when the immediate peer is a trusted Cloudflare IP; otherwise it uses the real TCP peer.

Net effect: by the time the request reaches the Next.js app, `x-forwarded-for` contains exactly one
edge-authored entry. There is no attacker-controlled left-most entry for `split(",")[0]` to pick up.
`cf-connecting-ip` (compat's first preference) is stripped from the client and only present if injected
by trusted Cloudflare. So the spoofing primitive the finding relies on does not exist in this topology.

### Vercel path
`apps/web/vercel.json` exists (cron defs only). On Vercel, `VERCEL_ENV` is set, so the compat resolver
takes the `x-vercel-forwarded-for` branch first (`trusted-client-ip.ts:89-92`). That header is set
server-side by Vercel's edge and is not client-spoofable; `x-forwarded-for` is also normalized by Vercel.
So the Vercel deployment is likewise not exploitable via the claimed left-most-XFF primitive.

## Residual / honest caveats
- The defense is **deployment-config dependent**, not code-enforced. If LocateFlow were ever deployed
  behind an edge that does NOT strip/overwrite these headers (a bare Node host, or a misconfigured proxy),
  compat's left-most behavior would become exploitable. That is a real hardening consideration and the
  prior auditor's instinct to set `TRUSTED_PROXY_HEADERS` explicitly is reasonable defense-in-depth.
- But "default compat ships, therefore IP spoofing of every IP-keyed control" overstates the case: in the
  repo's actual production edge the headers are sanitized before they reach the resolver. The claimed
  High-severity exploit is not demonstrable from the code as configured.

## Conclusion
**REFUTED.** The mechanics the finding cites are real, but its impact hinges on the edge passing through a
client-controlled `X-Forwarded-For`, which the repo's production Caddy edge explicitly prevents by stripping
all forwarding headers and re-injecting a single trusted `{client_ip}` validated against Cloudflare ranges
with `trusted_proxies_strict`. The Vercel path prefers the non-spoofable `x-vercel-forwarded-for`. The
spoofing primitive is not realizable as deployed.

If retained at all, this should be downgraded to **Low / Info** as a defense-in-depth hardening note
(make `TRUSTED_PROXY_HEADERS` explicit / fail-closed in prod), not a High exploitable vulnerability.
