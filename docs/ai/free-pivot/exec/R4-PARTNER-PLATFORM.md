# R4 · Generic Partner platform (cleaning / junk first) — implementation plan

> Status: PLAN (awaiting approval — no code yet). Scope: generalize the proven,
> FMCSA-specific mover portal into a category-agnostic Partner so NON-mover local
> services (cleaning, junk removal) can register, get verified, receive leads, and
> see their own performance (docs/ai/free-pivot/19 §3 Layer 4, §5, §10.3). Cleaning
> /junk first because they need no FMCSA cross-check. Gated by
> `partner_registration_v1` + `offers_cleaning_junk_v1` (both fail-closed).

## Guiding decision — generalize alongside, don't migrate
Movers stay on their live, FMCSA-specialized portal (MoverApplication + usdot/fmcsa
review). R4 builds a NEW generic Partner registration/portal for non-mover
categories, modeled 1:1 on the mover portal. Lead routing (R3) becomes
category-aware so each category reaches the right recipient. A later unification
(movers → Partner) is a separate migration, explicitly deferred — it would touch a
live, working subsystem for no new revenue.

## Reuse map (the mover portal is the template)
| Need | Reuse / generalize |
|---|---|
| Application + review queue | `MoverApplication` + admin "Mover Applications" → generic `PartnerApplication`/`Partner` + admin "Partners" |
| Proof documents | `MoverDocument` → `PartnerDocument` (license / COI instead of USDOT cert) |
| Portal auth | `MoverPortalToken` + lib/mover-portal-auth.ts (magic-link, sha256, 14d TTL) → `PartnerPortalToken` + lib/partner-portal-auth.ts |
| Apply form / portal pages | components/movers/mover-apply-form.tsx + app/movers/portal/* → app/partners/* |
| Lead capture + routing + delivery | R3 Lead/LeadDispatch + match-movers + dispatch-leads + the quote form — generalize by category |
| Flags / RBAC / audit / email | FeatureFlag, admin RBAC, sendLoggedEmail, getRequestHashSnapshot |

## Data model (NEW — additive; remember the R3e governance step)
1. **`Partner`** — id, `category` (cleaning|junk|… VarChar), companyName, contactEmail,
   contactPhone, website, `serviceStates` (CSV), `status`
   (PENDING|IN_REVIEW|APPROVED|REJECTED|NEEDS_INFO), attestation, review fields
   (reviewNotes/decisionMessage/reviewedByAdminId/reviewedAt), `stripeCustomerId?`
   (dormant, for R5 billing), timestamps. (Generalizes MoverApplication MINUS the
   FMCSA-specific usdot/fmcsa* — those stay mover-only.)
2. **`PartnerDocument`** — FK Partner; docType (LICENSE|COI|OTHER), storage ref,
   status. Generalizes MoverDocument.
3. **`PartnerPortalToken`** — FK Partner; sha256 token, TTL. Generalizes MoverPortalToken.
- **LeadDispatch generalization:** add `partnerKind` ("mover_application" | "partner")
  alongside the existing ref so a dispatch can target either; the delivery worker
  resolves the email by kind. (Keeps R3 mover dispatches working unchanged.)
> GOVERNANCE (R3e lesson): every new model MUST be added to BACKUP_TABLES (or
> INTENTIONALLY_EXCLUDED) AND, if it has an encrypted column, to ENCRYPTED_MODELS —
> then run `pnpm --filter @locateflow/admin exec vitest run` to confirm the
> coverage guardrails pass. Partner/PartnerDocument → BACKUP_TABLES;
> PartnerPortalToken → INTENTIONALLY_EXCLUDED (session/token table).

## Build phases (each its own verified commit)
- **R4a — models + governance + routing core.** Partner/PartnerDocument/
  PartnerPortalToken + migration + prisma generate; backup/key-rotation
  registration; generalize lead routing: `lib/leads/match-partners.ts`
  matchPartnersForLead(category, route) → movers for "moving", approved Partners
  for "cleaning"/"junk"; thread partnerKind through createLead + dispatch-leads.
  Tests (incl. admin governance).
- **R4b — registration.** Generic POST /api/partners (zod, attestation, flag
  `partner_registration_v1`, rate-limit) + /partners/apply form (category param).
  Generalize mover-apply-form. Tests.
- **R4c — admin verification.** Admin Partners queue + approve/reject/needs-info
  (step-up + audit), mirroring the mover-applications admin; category-specific
  required docs (license/COI for cleaners; junk lighter). Tests.
- **R4d — partner portal.** lib/partner-portal-auth.ts magic-link + /partners/portal
  dashboard showing the partner's OWN leads + delivery status (generalize
  mover-portal-auth + portal pages). Tests.
- **R4e — surface cleaning/junk.** Quote/lead capture for cleaning + junk
  (generalize the R3c form by category) behind `offers_cleaning_junk_v1`; wire
  matchPartnersForLead so those leads route to approved Partners; lead_submitted
  with the right offer_key/category. Tests.

## Open decisions (flag for the user before/while coding)
- **Per-category verification bar:** cleaning = license + COI; junk often unlicensed
  → attestation only? Define the required-docs matrix per category.
- **One generic form vs per-category copy:** v1 can parameterize the R3c form by
  category (label/fields) rather than cloning it.
- **Partner billing (CPL/subscription):** R5. R4 leaves stripeCustomerId dormant.
- **Movers unification:** deferred — movers keep their FMCSA portal in R4.
- **Legal:** partner terms of service + the lead/data-sharing agreement a partner
  accepts at registration (consent snapshot, like the consumer side).

## Verification
Per phase: prisma migrate + generate; admin vitest (governance guardrails);
verify:typecheck (all packages); targeted vitest per lib/route/UI; full web + admin
suites for regressions. All flags OFF by default → the whole platform is dark until
ops enables it.
