# Sponsored Placements — Design & Operating Model

Status: **built, flag-gated OFF** (`SPONSORED_ENABLED` runtime flag, default off).
Owner surfaces: licensed-movers list (live), provider catalog (planned).
Admin UI: `/sponsored` (admin app). Public reader: `apps/web/src/lib/movers.ts`.

This document is the single reference for how LocateFlow sells, renders,
measures, and legally frames sponsored slots. If a future change conflicts
with this document, update the document in the same PR or don't ship the
change.

---

## 1. What a placement is

A `SponsoredPlacement` row is a manually administered, fixed-fee, time-boxed
reservation of **one labeled ad slot** on a directory surface:

| Field | Meaning |
| --- | --- |
| `kind` | Surface: `mover` (movers list) or `provider` (provider catalog) |
| `targetId` | Loose ref to `MovingCompany.id` or `ServiceProvider.id` (no FK — a placement may never block catalog maintenance) |
| `label` | FTC disclosure label rendered on the card. Default `"Sponsored"`. Can be renamed (e.g. `"Ad"`), can **never** be blank |
| `categoryScope` | Provider-kind only; null = all categories |
| `stateScope` | 2-letter state or null = national |
| `startsAt` / `endsAt` | Flight window. Outside it the placement is inert regardless of `active` |
| `active` | Operator kill switch per placement |
| `impressions` / `clicks` | Denormalized fire-and-forget counters (see §5) |
| `createdByAdminId` | Loose audit-style ref to the creating admin |

## 2. Inventory model — manual fixed-fee first, no auction

- **One slot per surface.** Each surface renders at most one placement.
  There is no second position, no carousel, no rotation.
- **Fixed fee, sold manually.** The owner negotiates a flat fee per flight
  window directly with the advertiser. No bidding, no auction, no
  self-serve advertiser portal. This keeps pricing decoupled from ranking
  and keeps the integrity story simple ("we sold a clearly-labeled box,
  not a position in the list").
- **Admin-only creation.** Placements are created in the admin panel by
  an ADMIN+ operator behind password + MFA step-up; every mutation writes
  an audit row (`SPONSORED_PLACEMENT_CREATE/UPDATE/DELETE`).
- **Conflicts are refused, not raced.** Two active placements with the
  same kind + same state scope and overlapping windows are rejected with
  a 409 at create/edit time, because the surface would silently render
  only one of them. A national (null-scope) and a state-targeted placement
  may coexist; the reader prefers the state-targeted one.

## 3. Eligibility gate — applies even to paying advertisers

Money does not buy past the gate. Enforced server-side at create, at every
edit that changes the target, and at (re)activation; the public reader
independently re-checks at render time and fails closed.

**Movers (`kind: mover`):**
- Must exist in the FMCSA census import (`MovingCompany`), be `active`
  in the registry, and hold household-goods authorization
  (`hhgAuthorization = true`).
- Complaint ceiling: more than **10 FMCSA complaints in the trailing two
  years** (`complaintCount2y > 10`) disqualifies the carrier. The constant
  lives in the admin API routes (`MOVER_MAX_COMPLAINTS_2Y`); change it
  there and update this doc together.
- If a sponsored carrier later drops out of the registry or loses HHG
  authorization, the reader stops rendering the placement automatically
  (target re-check) — no admin action required, though the row should be
  deactivated and the advertiser notified.

**Providers (`kind: provider`):**
- Must be an `isActive` row in the curated `ServiceProvider` catalog.
  (The catalog itself is already curated; inactive providers cannot be
  sponsored.)

## 4. Render rules

- **Separate labeled slot, never inside organic rankings.** The sponsored
  card renders in its own slot ABOVE (and visually distinct from) the
  organic list. Organic ordering is never affected by payment — see
  non-goals (§8).
- **Max one placement per surface** (per request). The reader resolves a
  single placement: exact-state scope preferred over national, then most
  recently started.
- **FTC clear-and-conspicuous labeling is mandatory.** Every rendered
  placement carries its `label`. A surface that drops the label must not
  ship; the API refuses to persist a blank label.
- **"Why this?" link.** The sponsored card includes a "Why this?"
  affordance explaining: this business paid for this placement; it does
  not affect the ranking below; eligibility screening still applies.
  (Web surface work — keep this rule when building the provider-catalog
  slot.)
- **Runtime flag.** Nothing renders unless the `SPONSORED_ENABLED`
  runtime-config flag is `true`. The flag is the launch/kill switch for
  the whole feature; per-placement `active` is the per-deal switch.
- **Graceful degradation.** Placement resolution and counter bumps are
  wrapped so any failure returns "no sponsored slot" — a placement can
  never break or slow the organic list.

## 5. Measurement

- `impressions` increments when the surface serves the placement;
  `clicks` increments on click-through. Both are fire-and-forget
  (detached promise, all failures swallowed) — they may **never** add
  latency or failures to user paths.
- Counters are **read-only in the admin UI and API** — an edit cannot
  zero or inflate them. They are the proof-of-delivery record advertisers
  are billed against.
- Because counters are the billing record, a placement with any recorded
  traffic cannot be hard-deleted (409 `PLACEMENT_HAS_TRAFFIC`) —
  deactivate it instead. Untouched mis-creates delete freely.
- Counters are best-effort, not an ad-server SLA. Sell on flat fee per
  flight, report counters as indicative delivery, and say so in the
  advertiser agreement.

## 6. Billing — out-of-band initially

- Invoicing happens outside the product (manual invoice / payment link).
  No Stripe objects, no self-serve checkout, no proration logic in v1.
- The placement row's flight window + counters are the delivery record
  attached to the invoice.
- Revisit only if there are enough concurrent advertisers that manual
  invoicing becomes the bottleneck. Do not build advertiser billing
  infrastructure speculatively.

## 7. Attorney checklist (before first paid placement goes live)

- [ ] **Ad disclosure section in Terms** — disclose that some directory
      results include clearly labeled paid placements, that paid
      placement never affects organic ranking, and that screening/
      eligibility criteria still apply to advertisers.
- [ ] **Advertiser agreement** (per deal, signature required): flight
      window, fee, the label that will be shown, eligibility conditions
      and automatic suspension (registry drop-out, complaint ceiling,
      kill switch), counters-as-indicative-delivery language, no
      guarantee of clicks/leads, termination for cause.
- [ ] **FTC review of the rendered card** — label visibility (contrast,
      proximity, "clear and conspicuous" per FTC Enforcement Policy on
      deceptively formatted ads) and the "Why this?" copy.
- [ ] Confirm no conflict with the connector legal posture and the
      public site's existing disclaimers.
- [ ] Sign-off recorded before `SPONSORED_ENABLED` is flipped on in
      production with a paid placement live.

## 8. Explicit non-goals

- **No selling organic rankings.** Payment never changes order, score,
  badge, or inclusion in the organic list. This is a hard integrity line,
  not a pricing tier to be added later.
- **No auction / programmatic anything.** No bidding, no second-price
  mechanics, no ad networks.
- **No third-party trackers.** No advertiser pixels, no external
  measurement scripts, no remarketing tags. First-party counters only.
- **No self-serve advertiser portal** in v1. Admin-managed only.
- **No sponsored slots in trust-critical surfaces** (safety information,
  complaint data, AI briefings/dossiers).

## 9. Admin workflow (how the owner runs this)

1. Deal agreed out-of-band → operator opens **Admin → Content →
   Sponsored**.
2. *New placement* → pick surface (mover/provider), search the target
   (movers by USDOT number or name; providers by name — ineligible
   results are marked and unselectable), set label, state/category
   scope, flight window. Leave **Active** off until the invoice is paid.
3. Activate (password + MFA step-up) when the flight starts. The slot
   renders only while `SPONSORED_ENABLED` is on.
4. Monitor impressions/clicks on the list page; deactivate at flight end
   (or let `endsAt` retire it automatically).
5. Never delete a flown placement — deactivate. The row is the delivery
   record.

## 10. Pointers

- Schema: `packages/db/prisma/schema.prisma` → `SponsoredPlacement`,
  `MovingCompany`.
- Public reader + counters: `apps/web/src/lib/movers.ts`,
  `apps/web/src/app/api/movers/route.ts`.
- Runtime flag registration: `packages/shared/src/runtime-config.ts`
  (`SPONSORED_ENABLED`).
- Admin CRUD: `apps/admin/src/app/api/sponsored/` and
  `apps/admin/src/app/(admin)/sponsored/`.
