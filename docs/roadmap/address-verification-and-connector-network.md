# Address Verification & Connector Network — Strategic Plan

- **Date**: 2026-04-23
- **Author**: Strategy draft for Mustafa
- **Status**: Proposal — not yet committed to quarter

This document covers three interlocking initiatives, in the order they should
ship:

1. **One-time address verification** (bank-backed + driver's license)
2. **Outbound API** — third parties consume LocateFlow as source-of-truth
3. **Address Connector Network** — LocateFlow becomes the "Plaid for addresses,"
   propagating a user's verified address to every partner they've connected

The three build on each other. You cannot sell connectors until partners trust
the address is real (verification). You cannot sell the connector network
until the outbound API is stable. But every earlier piece delivers value on
its own, so this is a staged ramp, not a big-bang launch.

---

## 1. One-Time Address Verification

### Why this comes first

Today a user types an address and we trust them. That's fine for personal
service tracking — but every downstream ambition (Pro plan, connector
network, partner integrations) collapses if LocateFlow can't answer the
question:

> Is this person actually living at the address they entered?

Two independent verification rails are enough for ~99% of US consumers:

| Rail | Strength | Weakness | Cost per verification |
| --- | --- | --- | --- |
| **Bank statement (Plaid Identity)** | High — banks already KYC'd the user. Address on the statement is current and verified. | Only US/CA. Some users won't link a bank. | ~$0.30–$1.00 |
| **Driver's license scan** | High — government-issued. Works without a bank. | Requires OCR + liveness. Out-of-state DLs sometimes stale. | ~$0.75–$2.50 |

Offer both, let the user pick. One success is enough.

### Bank-backed verification — implementation

**Vendor: Plaid Identity Verification** (also consider MX, Finicity, Yodlee)

Plaid's `identity/get` endpoint returns the user's name + address as the
bank has it on file. We do not store transactions, only the identity payload.

**Flow**:

```
User: "Verify this address"
  → LocateFlow creates Plaid Link token (server-side, user scoped)
  → User opens Plaid Link modal (Plaid-hosted UI, handles consent + bank login)
  → Plaid returns public_token to our client
  → Client posts public_token to /api/verification/bank/exchange
  → Server exchanges for access_token, immediately calls /identity/get
  → Server stores: { bankName, addressOnFile, matchScore, verifiedAt }
  → Server DROPS access_token (no ongoing access needed — one-shot)
  → User sees "Verified via Chase Bank on 23 Apr 2026"
```

**Match scoring** (we compute, not Plaid):

```ts
function scoreAddressMatch(entered: Address, bank: BankAddress): number {
  // Normalize: USPS-formatted, lowercase, strip unit/apt noise
  // Return 0–100
  // 100 = exact match
  // 85–99 = same street + city, unit differs
  // 70–84 = same city + zip, street number differs
  // <70 = fail (show user, offer re-entry or DL fallback)
}
```

**Schema additions** (new tables):

```prisma
model AddressVerification {
  id              String   @id @default(cuid())
  addressId       String
  address         Address  @relation(...)

  method          String   // BANK_PLAID, DL_SCAN, MANUAL_ADMIN
  status          String   // PENDING, VERIFIED, MISMATCH, FAILED, EXPIRED

  // What the source told us (snapshot — we do NOT re-query)
  sourceName      String?  // "Chase Bank" or "CA DMV"
  sourceAddress   String?  @db.Text
  matchScore      Int?     // 0–100

  // Never store raw bank tokens or full DL image.
  sourceRef       String?  // opaque receipt: last4 of Plaid item_id, DL back-scan hash

  verifiedAt      DateTime?
  expiresAt       DateTime? // 12 months for DL, 6 months for bank
  createdAt       DateTime  @default(now())

  @@index([addressId, status])
}
```

**Expiration policy**: Bank verifications expire at **6 months** (statements
change), DL verifications at **12 months** or DL expiration date, whichever
comes first. A user can re-verify anytime from the address detail screen.

**Pricing/positioning**: Free for Individual users, 3/month. Unlimited for
Family. Pro/connector partners require every address to be verified, so
it's bundled.

### Driver's license verification — implementation

**Vendor: Persona** (also Stripe Identity, Onfido, Jumio)

Persona does the hard parts: OCR + PDF417 barcode parse + selfie liveness +
NIST 800-63 IAL2 compliance. We pay per successful verification.

**Flow**:

```
User: "Verify with DL"
  → LocateFlow creates Persona inquiry (user-scoped)
  → User opens Persona flow (Persona-hosted, works on iOS/Android/web)
  → Persona runs: DL front scan + DL back scan + selfie liveness
  → Webhook posts completion to /api/verification/dl/webhook
  → Server reads address from Persona report, scores vs entered address
  → Server stores: { verifiedName, verifiedAddress, dlExpiresAt, matchScore }
  → Server DROPS the full report (we only retain the extracted fields)
```

**What we persist** (minimum viable):
- First + last name
- Address (street, city, state, zip)
- DL expiration date (for our re-verification timer)
- Persona `inquiry_id` as opaque receipt
- Match score vs entered address

**What we do NOT persist**:
- DL image, selfie image, barcode raw data
- DL number (we don't need it)
- Date of birth (unless we later need age-gating)

**Why this matters**: If we get breached, the attacker gets the same data
the user could have typed into any web form. Not a DL image dump.

### Cost model

Assume 10k verifications/month by year 2:

| Item | Monthly | Notes |
| --- | --- | --- |
| Plaid Identity (~50% split) | $1,500–$5,000 | Per successful call |
| Persona DL (~50% split) | $3,750–$12,500 | Per successful inquiry |
| Infra overhead | $200 | Webhook processing, storage |
| **Total** | **$5,450–$17,700** | |

At Family ($14.99/mo) with 1 free verification, this is already profitable.
At Pro ($19.99/mo) it's a margin item — Pro users verify 5–20 addresses.

### Ship plan

| Week | Work |
| --- | --- |
| 1 | Schema migration + `AddressVerification` model + admin index view |
| 2 | Plaid integration (sandbox), exchange endpoint, match scoring, UI for status |
| 3 | Persona integration (sandbox), webhook, status UI |
| 4 | Production keys, rate limits, per-plan quotas, admin analytics |
| 5 | Soft launch to Individual users (3 free), watch cost/conversion |
| 6 | Family/Pro bundling, upsell copy on pricing page |

---

## 2. Outbound API — Third Parties Consume LocateFlow

### Why

Pro plan promises "API access." Today that's vaporware. Until we ship this,
do NOT put it on the pricing page as a bullet — mark it "coming Q3".

But this is also the foundation for the connector network. Without a stable
outbound API, partners cannot subscribe to address changes.

### The minimum viable API

Four endpoints, scoped to an API key's tenant (the Pro user's account):

```
GET  /v1/addresses                 # list, paginated
GET  /v1/addresses/:id             # single address + verification status
GET  /v1/addresses/:id/services    # services tied to that address
GET  /v1/webhooks/events?since=... # event replay (address.updated, address.verified, address.moved)
```

Write endpoints **later**. Start read-only. Every partner first wants "tell
me when my customer's address changes" — that is the point.

### Security floor (non-negotiable)

- API keys generated per user, shown once, revocable from settings
- HMAC-SHA256 signature on every request (prevents replay + MITM)
- Per-key rate limits (1k req/min default, raised on request)
- IP allowlist optional (partners can lock to their infra)
- Every request logged to `ApiAccessLog` with key hash + endpoint + response code
- Webhook endpoints require `Svix`-style signed payloads (HMAC + timestamp)
- All tokens rotatable without downtime

### Schema additions

```prisma
model ApiKey {
  id           String   @id @default(cuid())
  userId       String
  name         String   // "Acme Integration"

  // Store ONLY the hash — user sees the raw key exactly once on creation
  keyHash      String   @unique
  keyPrefix    String   // first 8 chars ("lf_live_ab12cd34"), shown in UI

  scopes       String   @db.Text // JSON array: ["addresses:read", "webhooks:read"]
  rateLimit    Int      @default(1000) // req/min

  lastUsedAt   DateTime?
  expiresAt    DateTime?
  revokedAt    DateTime?

  createdAt    DateTime @default(now())

  @@index([userId])
}

model WebhookEndpoint {
  id           String   @id @default(cuid())
  userId       String
  url          String   @db.VarChar(500)
  secret       String   // HMAC signing key
  events       String   @db.Text // JSON array of event types
  isActive     Boolean  @default(true)
  lastFailedAt DateTime?
  failureCount Int      @default(0) // auto-disable after 10 consecutive failures
  createdAt    DateTime @default(now())
}
```

### Admin visibility

New admin page `/api-access`:
- API keys in flight (per user)
- Top consumers by request volume
- 4xx/5xx heatmap
- Webhook delivery success rate
- Revoke any key, disable any endpoint, force-rotate secrets

### Ship plan

Ship the outbound API only after Pro plan is live in checkout. Prerequisite:
Stripe product mapping for Pro (not done today).

---

## 3. Address Connector Network ("Plaid for Addresses")

### The thesis

Every American updates their address 15+ times when they move:

- 4–6 utilities (power, water, gas, internet)
- 2–3 financial (bank, credit cards, retirement)
- 2–3 insurance (auto, home, health)
- USPS, DMV, voter registration
- Amazon, Netflix, gym, etc.

**Today**: They do this manually, missing half of them, paying for services
they can't access for months.

**What LocateFlow becomes**: The **single place** they update their address.
Every connected service receives the update automatically.

This is exactly the Plaid model: users authorize Plaid once, and 10,000
fintech apps get ongoing bank data. We would be the address equivalent.

### Two-sided marketplace

| Side | Who they are | Value they get | How they pay |
| --- | --- | --- | --- |
| **Users** | Anyone who moves | One-click move, zero forgotten services | Free or included in Pro |
| **Partners** | Utility companies, banks, insurers, gyms, SaaS | Reduced mail-return cost, better deliverability, lower churn | Per-update fee ($0.05–$0.25) or flat SaaS tier |

**Partner economics reality check**: USPS charges ~$0.07 per change-of-address
notification. We need to be at or below that. Margin comes from bundling
(an insurer saves the change-of-address cost + gets a *verified* address).

### Technical architecture

```
      User moves
          │
          ▼
  [LocateFlow address edit]
          │
          ▼
  [Verification check: bank or DL re-verify]
          │
          ▼
  [Publish address.updated event]
          │
     ┌────┼────┬────┬────┐
     ▼    ▼    ▼    ▼    ▼
  [Chase] [GEICO] [Netflix] [Water Co.] [Gym]
    webhook  webhook  webhook   webhook   webhook
```

**The user's consent model** matters as much as the tech:

- Partner connections require explicit per-partner opt-in ("Sync my address
  with Chase? Yes / No")
- Each partner sees only the addresses the user granted
- User can revoke any partner at any time (kills future webhooks)
- Every event has an audit trail

### Partner onboarding — the hard part

The tech is not the bottleneck. Partner sales is. Three tactics:

1. **Start with partners who already have LocateFlow users**. Look at our
   top 100 service providers (utilities, banks) and approach the ones with
   ≥1000 of our users.
2. **Offer the first 10 partners free for 12 months** in exchange for a
   case study + logo placement.
3. **Target SMB SaaS first, not Fortune 500 banks**. Banks take 18 months
   to sign. A regional water utility or a gym chain takes 6 weeks.

### Regulatory / legal floor

- **GLBA** (banking): If banks become partners, we're in GLBA territory.
  Need a signed data-processing agreement per partner.
- **SOC 2 Type II**: Table stakes. Partners will ask on day one. Plan ~9
  months and ~$30–60k to get there.
- **State AG scrutiny**: Address-change fraud is a known ACH scam vector.
  Every address update must be tied to a fresh verification OR a
  step-up auth (password + MFA).
- **GDPR/CCPA**: Address is PII. Consent must be granular (per-partner) and
  revocable.

### Ship plan (this is a 2-year arc, not a sprint)

| Quarter | Milestone |
| --- | --- |
| Q3 2026 | Outbound API (read + webhooks). First 2 paying API customers (not connectors yet). |
| Q4 2026 | Partner portal MVP: partners can register, get API keys, consume webhooks. 5 beta partners. |
| Q1 2027 | Consent UI for users. Per-partner toggle. 20 partners live. |
| Q2 2027 | Billing infra for per-update partner fees. SOC 2 Type I done. |
| Q3 2027 | Marketing push: "move your address once, everywhere." |
| Q4 2027 | SOC 2 Type II. Target: 100 partners, 50k users syncing. |

### Revenue model

Conservative scenario, Year 2 at scale:

- **Users**: 50k paying Pro or included in partner-sponsored tier
- **Partners**: 100, average 2k users each synced, 1.5 updates/year per user
- **Updates**: 100 × 2k × 1.5 = 300k/year
- **Per-update price**: $0.12 average
- **Partner revenue**: ~$36k/year from updates alone

This is thin at first. The real leverage is partners paying a flat $500–
$2,500/mo to *subscribe* to the webhook firehose regardless of volume.
100 partners × $1k/mo = $1.2M/year. That's the model.

---

## How the three pieces reinforce each other

```
  [Bank/DL verification]  ←─ users trust LocateFlow addresses
           │
           ▼
    [Outbound API]        ←─ partners trust LocateFlow addresses
           │
           ▼
  [Connector network]     ←─ network effect on both sides
           │
           ▼
  [Pro plan defensible]   ←─ no one can copy this without 100 partners
```

Without verification, partners won't pay. Without API, partners can't consume.
Without the connector network, users stay price-sensitive.

---

## What to decide this week

1. **Verification vendors**: Plaid vs Finicity vs MX? Persona vs Stripe
   Identity? Let's pick one of each and start with sandbox. My default:
   **Plaid + Persona** — both have solid docs, fair pricing, and US-first
   coverage.
2. **API roadmap marketing**: Remove "API access" from the Pro bullet list
   until Q3, OR keep it with a "coming Q3" inline tag. Current: it's on
   the list without a tag, which is misleading.
3. **SOC 2 start date**: Everything above requires it. Start the audit
   engagement now (9-month lead). A good Type I report is ~$30k, a Type II
   is ~$60k with 6 months of observation.
4. **Partner sales capacity**: Who sells to partners? This is a full-time
   role. If we don't have anyone, the 2027 dates slip.

---

## What NOT to build

- **In-house identity stack**: Do not try to OCR driver's licenses yourself.
  Persona/Jumio exist for a reason. The fraud surface is too wide.
- **Screen-scraping partner systems**: If a partner doesn't offer a webhook,
  we do not build browser automation to log in as the user and update the
  address. That's a Plaid-Yodlee-era mistake. Wait for them to expose an API
  or skip that partner.
- **SSO-as-LocateFlow**: Tempting, but "log into Netflix with LocateFlow"
  makes us a consumer identity provider. Out of scope. We're an address
  propagation layer, not an identity layer.
- **Consumer credit-pull for verification**: Adds compliance burden (FCRA)
  without meaningful uplift over bank/DL.
