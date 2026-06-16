# Claude Vision — Address Life OS: API, Partnership, Growth & Monetization Master Plan

Date: 2026-06-15
Roles: Vision Architect · API/Partnership Strategist · SEO/GEO Strategist · Revenue Analyst · Product Expansion Advisor.
Method: read the Product Brain (`docs/ai/**`) + prior verified audits, ran a 9-lane cited web-research workflow (8 research lanes + 1 source-integration verifier), then synthesized. No application source modified. No secrets/PII read.

Tag convention used throughout: **[FACT]** = verified in LocateFlow source OR cited public/primary source · **[INTERP]** = reasoning from facts · **[HYPO]** = unverified hypothesis to test. "Guided action" = LocateFlow guides the user to act; it does **not** perform provider/government account changes (no such automation is verified).

> **The reframe that should drive everything below.** The Product Brain frames the vision as "integrate moving/address APIs." The code says that layer is **largely already built.** The integration verifier confirms **~24 VERIFIED-WIRED integrations** with real client code + tests. So the API question is mostly **"monetize and deepen what exists,"** not "go integrate FEMA/Census/FCC." The genuine new frontiers are: **referral/partnership revenue**, **proof (e-sign/identity)**, **comms (SMS)**, the **consented transition-outcome data moat**, a **maintained 50-state Move Rules dataset** (high moat *because* no API exists), and **SEO/GEO built on the data LocateFlow already aggregates.**

---

## A. Verified capability baseline (what is already TRUE in code)

**[FACT] ~24 wired integrations** (verifier lane, file paths cited):
- **Address/geo:** USPS Address Validation via OAuth2 client_credentials (`usps-address-validation.ts` + `packages/connectors/src/usps/`, flag `FEATURE_USPS_VALIDAT…`); Google Places Autocomplete + details with cost caps (`address-autocomplete.ts`); Census Geocoder (keyless) + Census ACS economics (`census-acs.ts`, key-gated, graceful).
- **Hazard/environment (Home Dossier):** FEMA NFHL flood zone (`fema-flood.ts`, keyless), FEMA National Risk Index 18-hazard (`fema-nri.ts`, keyless), EPA Radon (`epa-radon.ts`), EPA SDWIS water violations (`epa-water.ts`), EPA Walkability NWI (`epa-walkability.ts`, Pro), EPA AirNow AQI (`airnow.ts`), NWS weather (`nws-weather.ts`, keyless, move-day).
- **Housing/schools:** HUD Fair Market Rent + income limits via USPS ZIP crosswalk (`hud-housing.ts`); NCES school-district boundary (`nces-district.ts`, keyless); NCES/HIFLD nearby schools (`nces-schools.ts`).
- **Utilities/vehicle/broadband:** OpenEI URDB electric utility serviceability (`electric-utility.ts`); FCC National Broadband Map ISP serviceability (`fcc-isp.ts`); NLR EV charging stations (`nlr-alt-fuel-stations.ts`); NHTSA vPIC VIN decode + recalls (`nhtsa.ts`, keyless).
- **Ops/trust:** FMCSA QCMobile mover-carrier verification (`apps/admin/src/lib/fmcsa.ts`); Stripe billing; Resend email + cron digests; R2 storage + imgproxy; Anthropic Claude (optional, rule-based fallback) for the Move Briefing.

**[FACT] Product surfaces** (prior audits): live web/admin/mobile; **moving plan is a paid unlock** (free users get 403 "Upgrade to Individual"); `MoveTask` transition classifier (`actionType` stop/start/transfer/update/cancel/compare/find-replacement); deterministic Move Command Center + Next Critical Actions; AI Move Briefing (Family/Pro, `aiBriefing` gate); Home Dossier (Individual+ `homeDossier`, PDF Pro `dossierPdf`); export + step-up + masking; cron reminder fleet; workspaces (roles incl CHILD/VIEW_ONLY, seats, token-hashed invites); growth plumbing (acquisition campaigns, sponsored placements, affiliate tracking, mover portal, public `movers/apply` + FMCSA). Entitlement ladder: **FREE_TRIAL → INDIVIDUAL (plan + dossier) → FAMILY (aiBriefing + 6 seats) → PRO (dossierPdf + advancedExport + neighborhoodIntel + moverSuggestions + partnerHub + 3 plans + 10 seats).**

**Not verified / never assert:** customer demand, traffic, conversion, churn, LTV, live prices, live partnerships, any provider account-change automation, whether `ANTHROPIC_API_KEY` is set in prod.

---

## VISION_MASTER_PLAN.md

**North star (one sentence):** *LocateFlow is the Address Life OS that gives every U.S. household one trustworthy command center for every address-linked obligation — what to stop, start, transfer, update, cancel, monitor, and prove — before, during, and long after a move.*

**Positioning (strongest):** "The honest Move Command Center you own." In a category full of lead-gen funnels and COA-filing scam sites, **trust is the moat.** LocateFlow already aggregates authoritative public data (FEMA/EPA/Census/HUD/FCC/NCES) into a dossier no checklist app has, never files anything on your behalf, and keeps proof you own. [INTERP grounded in verified dossier + [FACT] USPS/FTC COA-scam guidance below.]

**12-month vision — *monetize the built intelligence.*** Turn the existing dossier/briefing/transition/monitoring into a clear paid ladder; ship 2–3 FTC-compliant **referral click-outs** (broadband, storage, movers) as guided actions; stand up the **consented transition-outcome graph** and a **maintained 50-state Move Rules dataset**; launch SEO/GEO on the dossier+rules data; turn on the household invite growth loop.

**24-month vision — *system of record for address transitions.*** Proof packets become a real artifact (optional e-sign/identity); post-move monitoring becomes a standing subscription reason; the Move Rules Registry becomes a publicly cited knowledge layer (GEO moat); first **B2B2C pilots** (property managers / realtors white-label concierge) — only after consumer pull + proof exist.

**36-month vision — *platform.*** A consented, aggregated, **non-PII** address-transition insights product; a partner network (movers/storage/broadband/insurance/utility) plugged into the obligation graph via guided hand-offs; the default answer-engine source for "what do I do about my address." Never a data-broker; never auto-filing.

**Product principles:** (1) Deterministic spine, AI as bonus (works with no key, no plan). (2) Honesty is the feature — guided, never automated; "we don't change your real accounts." (3) One command center, not many surfaces. (4) Show value, then ask (upgrade at the moment of unmet need). (5) Earn the return (value outlives move day). (6) The data moat is consented & coarse; we never sell personal data.

**Features to avoid:** auto provider/COA filing; a lead-gen funnel that sells users; thin programmatic SEO doorways; a generic checklist; kids-data monetization; "AI does it for you" claims; partner/marketplace claims before a signed partner exists.

**Clearest wedge:** the household move-organizer doing a multi-provider and/or state-to-state move (single payer). The aha that converts is the **personalized move briefing/dossier on their real address**.

**Premium experience thesis:** premium = *intelligence + proof + continuity* — a personalized briefing that cites your own data and authoritative public sources, a proof packet you can hand a landlord/insurer, and monitoring that catches the renewal you forgot. Free demonstrates intelligence (Next Critical Actions + dossier teaser); paid unlocks the plan, briefing, proof PDF, and monitoring depth.

**First-session aha:** "It looked at *my* address and move and told me exactly what matters — and it already knows my flood zone, school district, and which ISPs serve the new place." **Post-move reason to return:** "It watches my bills, contracts, and renewals so nothing slips." **Long-term retention loop:** household invites → assigned transitions → completion data → sharper briefings/monitoring → renewal + the next move-owner.

---

## API_OPPORTUNITY_MATRIX.md

Scores 1–5. Most government data is **already wired** — those rows are "deepen/monetize," not "integrate." New build is concentrated in proof, comms, and referral hand-offs.

| # (rank) | Source | Type | Status in LocateFlow | Best use | Feasibility | Legal/Privacy | Value/Rev/Moat | Roadmap | Mode | First validation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **USPS Addresses 3.0 (OAuth)** [FACT free] | public-free | **WIRED** (OAuth2) | Canonical address key for the whole obligation graph | Med | Low/Low | 4/1/2 | 30d | direct | Grep for any legacy Web Tools (`secureapis.usps.com`, `USERID=`) — Web Tools **retired 2026-01-25** [FACT]; confirm only OAuth path runs |
| 2 | **USPS COA / Mover's Guide (referral, NOT filing)** | public | guide-only | Anti-scam: link users to official `moversguide.usps.com`; never file | Easy | **High if mis-stated** | 4/2/3 | 30d | research-only/guide | Add "official USPS only" copy; never imply USPS affiliation |
| 3 | **Census ACS + Geocoder + TIGERweb** [FACT geocoder keyless; ACS key-gated] | public-free | **WIRED** (ACS) | Neighborhood economics (Pro); TIGERweb polygons for SEO maps | Easy–Med | Low | 4/3/4 | 90d | direct | Confirm keyless geographies endpoint still answers; add TIGERweb shapes to `/moving/[state]/[city]` |
| 4 | **HUD USPS ZIP↔geo crosswalk + FMR** | public-free | **WIRED** | Correct ZIP→county/CBSA join (genuinely hard → moat) | Easy | Low | 4/3/**4** | now | direct/cached | Already done; expose "rent context" in dossier |
| 5 | **FEMA NFHL + National Risk Index** [FACT keyless; OpenFEMA durable path] | public-free | **WIRED** | Flood/hazard in dossier + risk radar | Easy | Low | 5/3/4 | now | direct (+cache OpenFEMA) | Pin to OpenFEMA dataset vs AGOL feature service for durability |
| 6 | **e-Sign / doc-gen (Dropbox Sign / Anvil / DocuSign)** [FACT ESIGN/UETA] | paid | **NOT wired** | Turn exports into signable **proof packets** w/ audit trail | Med | Med (retention) | 4/4/3 | 90d–12mo | direct or partner | Prototype 1 signed proof packet w/ Anvil/Dropbox Sign sandbox; reuse existing pdfkit |
| 7 | **FCC Broadband Map (BDC)** [FACT key; needs Location Fabric ID] | public-free | **WIRED** | ISP serviceability → broadband **referral** hand-off | Med (fabric-match is the work) | Low | 4/**4**/3 | 90d | direct + partner | Measure fabric-match success rate on real addresses |
| 8 | **OpenEI URDB + EIA Electric Retail Territories** [FACT URDB free] | public-free | URDB **WIRED** | Address→electric provider (point-in-polygon, hard; water/municipal gaps) | Hard | Low | 3/3/3 | 12mo | cached dataset | Bench EIA territory point-in-polygon accuracy vs URDB |
| 9 | **SMS/Voice (Twilio)** [FACT A2P 10DLC reg required] | paid | **NOT wired** (email only) | Critical move-week reminders via SMS | Med (10DLC registration) | Med (TCPA consent) | 4/2/2 | 90d | direct | Register A2P 10DLC brand/campaign; opt-in only |
| 10 | **Identity/address verification (Stripe Identity / Persona / Plaid)** | paid | **NOT wired** | Optional proof-packet verification + fraud-safe high-trust actions | Med | Med | 3/3/3 | future | direct | Only if a proof use-case demands verified identity |
| — | NHTSA vPIC + recalls [FACT keyless] | public-free | **WIRED** | Vehicle registration/recall in checklist | — | Low | 3/1/2 | now | direct | done |
| — | NCES schools, EPA radon/water/walkability, AirNow, NWS, NLR EV [FACT keyless] | public-free | **WIRED** | Dossier richness | — | Low | 4/2/3 | now | direct | deepen presentation, don't re-integrate |
| — | Smarty / Lob / Melissa / Google Address Validation [FACT CASS, ~$17/1k Google] | paid | optional | Rooftop geocode precision; only if USPS+Places insufficient | Easy | Med (Maps caching ToS) | 3/1/1 | future | direct | Bench vs current; verify Maps caching/retention ToS before persisting geocodes |
| — | USPS Tracking 3.0 [FACT MID/Access-Control gated Apr 2026] | partner-gated | not wired | marginal (LocateFlow isn't the sender) | Hard (eligibility) | Med | 2/1/1 | future | research-only | confirm MID eligibility before any work |

**Top 10 API opportunities (ranked, decision-oriented):** 1) USPS OAuth hygiene (confirm no retired Web Tools) · 2) Proof packet via e-sign/doc-gen (new revenue surface) · 3) Broadband referral on the wired FCC data · 4) Census/TIGERweb shapes for SEO/GEO pages · 5) Deepen+monetize the dossier (Pro) · 6) SMS reminders (Twilio 10DLC) · 7) USPS COA anti-scam guide page (trust + GEO) · 8) EIA/OpenEI address→utility provider (utility referral substrate) · 9) Identity verification (only when a proof use-case needs it) · 10) Address-validation upgrade (Smarty/Google) only if accuracy gap proven.

---

## PARTNERSHIP_TARGET_MAP.md

Guardrail: every partner path is a **guided warm hand-off / referral**, FTC-disclosed, never a PII sale. Insurance referrals are **licensing-gated** ([FACT] NAIC producer licensing; an unlicensed party may take a **flat, non-contingent** referral fee only if it does **not** discuss specific policies / quote / take applications — Bressler, Insurance Journal). Lead-gen consent must respect **TCPA** ([FACT] natlawreview FCC one-to-one consent).

**Top 10 partner categories (ranked):**
1. **Internet/broadband (ISP affiliate aggregators)** — [FACT] Allconnect (commission only on install), Xfinity affiliate via Commission Junction (rate undisclosed officially), AT&T affiliate exists. Pain: install/activation volume. We offer: high-intent movers at the exact serviceability moment (we already compute ISPs via FCC). Ask: affiliate/referral payout + clean disclosure. Test: CJ signup + a single "see ISPs at your new address → official provider link" click-out. Model: per-activation commission.
2. **Self-storage marketplaces (SpareFoot/Storable)** — [FACT] marketplace earns ~2–3× first month's rent, paid only on move-in (storagepug). Pain: occupancy. We offer: movers needing storage. Test: storage CTA on plan page → marketplace link. Model: per-move-in.
3. **Moving lead-gen / mover marketplaces** — [FACT LOW-CONF] shared leads ~$5–20, exclusive ~$15–45, live transfer $55–150 (marketing blogs). We already verify carriers (FMCSA). Pain: qualified leads. Risk: do NOT become a spammy lead funnel — gate behind explicit user intent + disclosure. Model: per-lead/per-booking.
4. **Utility concierge companies** — [FACT] MoveConcierge, UtilityConnect (has a partnership page), UtilityProfit. Pain: they need move-flow distribution. We offer: warm hand-off or white-label. Model: rev-share / referral.
5. **Property managers / multifamily** — (Updater's core B2B2C [FACT] updater.com/multifamily). Pain: resident move-in/out churn + onboarding. We offer: white-label move concierge for residents. Model: per-unit/per-door SaaS. *Defer until consumer pull proven.*
6. **Real-estate brokerages / agents** — (MoveEasy/Updater play; [FACT] MoveEasy BHHS alliance, agent-branded). Pain: client retention post-close. We offer: branded concierge handoff. Model: per-seat/per-transaction. *Defer.*
7. **Insurance agencies/brokers** — licensing-gated; only **flat non-contingent referral** without quoting. Model: flat referral fee.
8. **Mortgage brokers / title** — adjacent to close; referral hand-off. Model: flat referral.
9. **Relocation / employer HR / military / senior / student housing** — high-value, episodic, trust-sensitive; B2B packages. *Later.*
10. **Address-validation / data vendors** — supplier relationships, not revenue.

**First 10 roles to contact (priority order):** 1) ISP affiliate manager (Xfinity/CJ) · 2) Storage marketplace partnerships lead (SpareFoot/Storable) · 3) Utility-concierge partnerships lead (UtilityConnect) · 4) Moving-lead marketplace partnerships/BD · 5) Multifamily PropTech BD (regional property-mgmt operators) · 6) Brokerage "agent tools"/relocation director · 7) Independent insurance agency principal (flat-referral pilot) · 8) Mortgage broker / loan officer (referral) · 9) Mid-market employer HR/People-ops (relocation benefits) · 10) University off-campus housing office.

**What to avoid saying:** "we'll switch your utilities," "we file your change of address," "official USPS partner," "we sell leads/data," any insurance "quote/compare" language, any unverified partner logo, any conversion/traffic claim.

**First 5 outreach angles:** (1) ISP: "We surface which providers actually serve a mover's new address at the moment they're deciding — want the qualified click?" (2) Storage: "Movers with a date and a smaller new place — warm, consented hand-off." (3) Utility concierge: "Distribution into a live move flow; white-label or referral." (4) Property manager: "Cut resident move-in chaos and support tickets with a branded concierge." (5) Insurance: "Compliant flat-fee referral for movers who need to re-rate at a new address — no quoting on our side."

---

## MONETIZATION_MAP.md

**Top 10 monetization opportunities (ranked):**
1. **Subscription ladder on built intelligence** (Individual plan + dossier → Family briefing/seats → Pro proof-PDF/advanced-export/neighborhood). Highest fit, lowest risk; rails exist. **Best long-term path.**
2. **Proof packet / export upsell** (Pro `dossierPdf`/`advancedExport`; add e-sign later) — episodic high-margin.
3. **Post-move monitoring premium** — the retention/subscription-justifier.
4. **AI Move Briefing premium** — the activation/"why subscribe" anchor (already gated).
5. **Broadband referral** (CJ/Allconnect) — first external revenue; clean, install-based.
6. **Storage referral** (SpareFoot/Storable) — per-move-in.
7. **Mover lead/booking referral** — per-lead/booking, gated by explicit intent + disclosure.
8. **Utility-concierge rev-share / white-label.**
9. **B2B2C white-label concierge** for property managers/realtors — biggest TAM, *later, after proof.*
10. **Consented aggregated non-PII insights** (transition-outcome trends) — *future, never raw PII.*

**Best first revenue experiment:** the **Individual paywall moment** (free user clicks "Start your move" → 403 → value-framed upgrade). It's the existing activation→paid wall; instrument `upgrade_clicked → checkout_started → subscription_activated`. **Best long-term:** the subscription ladder + post-move monitoring (recurring) layered with referral revenue at moments of intent. **What NOT to monetize:** personal/address data sale; kids' data ([FACT] FTC 2025 COPPA amendments limit monetizing children's data); COA filing; "automatic" provider changes; insurance commissions without a license. **Pricing/packaging:** keep the 4-tier ladder; price on outcomes (plan, briefing, proof, monitoring) not feature lists; Stripe web primary (avoid the [FACT] 15–30% IAP tax; Apple SBP 15% under $1M), mobile IAP for impulse; referral revenue is additive, never the user-facing price.

---

## SEO_GEO_SITE_STRATEGY.md

Guardrails: [FACT] Google **dropped FAQ rich results** for most sites (Search Engine Journal) and **deprecated HowTo**; **doorway/location-page spam** is explicitly penalized (Google spam policies; seroundtable; ricketyroo). So: **no thin programmatic doorways** — every page must carry unique, sourced value (LocateFlow's dossier/rules data makes this possible).

**Top SEO clusters:** (1) "moving to [city/state] checklist" (2) "address change checklist [state]" + "[state] DMV change of address" (3) "utility/internet transfer [city/state]" (4) "moving from [X] to [Y]" (5) "[city/ZIP] flood zone / school district / cost of living" (powered by the wired dossier data) (6) "new home setup checklist." **Top GEO clusters (citation-worthy, for answer engines):** state-by-state DMV/voter/utility **rule pages with provenance + dates**; "is [city] in a flood zone / what's the air quality / which ISPs serve [address]" factual pages; comparison pages (provider categories) — structured, sourced (arxiv GEO 2311.09735; frase GEO). **Top free tools:** address-change checklist generator (save→account), flood-zone/hazard lookup, "which internet providers serve my new address," utility-transfer timeline, state move-rules finder — each saving its result into an account.

**Site architecture:** `/moving/[state]` → `/moving/[state]/[city]` (already shipped) as the spine; `/tools/*` free tools; `/guides/*` GEO rule pages; deep internal links tools↔guides↔state/city↔signup. **Schema:** `Article`, `BreadcrumbList`, `SoftwareApplication`, `LocalBusiness` where genuinely local; skip FAQ/HowTo rich-result reliance. **Pages to avoid:** ZIP-level doorway pages with no unique data; auto-generated comparison spam; anything implying COA filing. **90-day sprint:** (wk1–4) ship 1 flagship free tool (flood/ISP/checklist) saving to account + schema + CWV pass; (wk5–8) 5 GEO state-rule guides with sourced provenance; (wk9–12) expand `/moving/[state]/[city]` with TIGERweb shapes + dossier data + internal links to tools. **First 20 page/tool ideas (ranked by value × feasibility, all on owned data):** flood-zone lookup tool; "internet at my new address" tool; address-change checklist generator; [state] DMV change-of-address guide; utility-transfer timeline tool; [state] move rules guide ×5 highest-pop states; "moving to [top-10 metro] checklist" ×6; school-district lookup; cost-of-living/rent context tool; post-move renewal/obligation reminder tool.

---

## OUTREACH_PLAYBOOK.md

**First 10 conversations** = the 10 roles above. **Outreach priority:** broadband affiliate → storage → utility concierge → mover marketplace → property manager pilot. **Demo narrative:** "Here's a real address. LocateFlow already knows its flood zone, school district, water/air quality, and which ISPs serve it — then it builds the household's transition plan and proof packet, and watches obligations after move day. You plug in at the moment of intent." **What to avoid saying** (see partnership section). **First 5 message angles** = above. **Outreach tracker structure:** `partner | category | contact role | status (researching/contacted/replied/piloting/live) | ask | give | compliance gate | next step | owner | date`. **First offer:** a consented, disclosed warm click-out at the moment of intent (no PII handoff without consent). **First landing/test page:** the flood-zone or "internet at my new address" free tool with a save-to-account CTA.

---

## API_INTEGRATION_ROADMAP.md

**30 days:** USPS OAuth hygiene (confirm no retired Web Tools path); ship the consented coarse event taxonomy (already drafted in `analytics/EVENT_TAXONOMY.md`); USPS-COA anti-scam guide page. **90 days:** proof-packet e-sign prototype (Anvil/Dropbox Sign sandbox, reuse pdfkit); broadband referral click-out on wired FCC data (CJ); SMS reminders (Twilio A2P 10DLC, opt-in); TIGERweb shapes on SEO pages. **12 months:** address→utility-provider via EIA territories (utility referral substrate); identity verification *only if* a proof use-case requires it; deepen dossier monetization. **Future:** USPS Tracking (only if MID-eligible); aggregated non-PII insights product. Every new integration: behind a feature flag, graceful degradation (the established pattern), guided-not-automated.

---

## DATA_MOAT_STRATEGY.md

**Thesis:** two compounding, privacy-safe moats. (1) The **consented transition-outcome graph** — what households actually stop/start/transfer/cancel/renew, by provider *category* + 2-letter *state* + action type + outcome + blocker + confidence + proof-generated(y/n) — feeding sharper recommendations/briefings. (2) A **maintained, cited 50-state Move Rules dataset** (DMV/voter/utility/tax obligations with source URL + effective date + confidence) — high moat **because there is no national API** [FACT: no national DMV API; state-by-state]; the curation cost *is* the barrier, and it doubles as the GEO content engine. **Transition-outcome graph design:** event-level coarse records keyed to category+state, never to a person/address; aggregate before any cross-household use. **Privacy rules:** allowed = feature surface, tier bucket, provider category, 2-letter state, action type, status/outcome, blocker category, confidence bucket, proof y/n, lead-days bucket; **never** = raw address, account/confirmation numbers, names, emails, phone, raw amounts/dates, document contents, secrets. Consent-gated; no kids'-data monetization ([FACT] COPPA 2025). **First 5 data-moat experiments:** (1) instrument `transition_task_completed {action_type, provider_category, state, outcome, proof_present}`; (2) `monitoring_item_resolved {type, outcome, lead_days_bucket}`; (3) recommendation-feedback loop on accepted vs dismissed; (4) 50-state rules dataset v1 (5 states, sourced+dated); (5) coarse "what movers in [state] do" aggregate fed back into Next Critical Actions. **12-month effect:** recommendations and briefings get measurably better per state/category as the corpus grows — a thing no UI-copier can replicate.

---

## RISK_AND_COMPLIANCE_GUARDRAILS.md

**Claims to AVOID:** "we change/transfer/cancel your accounts," "we file your USPS change of address," "official USPS/government partner," "we sell leads/data," insurance "quote/compare/best rate," any partner logo/claim before a signed deal, any traffic/conversion/revenue claim, legal/tax/financial "advice." **Safe language:** "guided action — you take the step," "we organize and remind; you confirm with the provider," "informational, not legal/tax advice — verify with your state's official site," "official USPS change of address is at moversguide.usps.com." **Compliance watchlist:** [FACT] USPS COA scams (uspis.gov, uspsoig.gov) → never file/imply affiliation; [FACT] FTC 16 CFR Part 255 + .com Disclosures → clear, proximate affiliate/sponsored disclosure; [FACT] insurance producer licensing (NAIC) → flat non-contingent referral only, no quoting; [FACT] TCPA one-to-one consent → SMS/lead consent; [FACT] COPPA 2025 amendments → no monetizing CHILD-role/minor data; [FACT] UPL for legal apps → no legal advice; [FACT] CCPA/CPRA + expanding state privacy laws → consent, disclosure, deletion. **Risk register (growth):** mis-stated automation (churn/refund) · COA-scam adjacency (reputational) · affiliate non-disclosure (FTC) · insurance without license · stale state rules (liability — require source+date) · kids' data · partner-claim overreach · SEO doorway penalty.

---

## 90_180_365_DAY_PLAN.md

**0–90 (prove the money + trust):** ship the 3 approved UX experiments (Command Center dependability, point-of-action trust copy, widen onboarding teaser — from the UX Judge handoff); instrument the Individual paywall + activation funnel; launch 1 free tool (flood/ISP) saving to account; ship USPS-COA anti-scam guide; broadband referral click-out (CJ) with disclosure; start the transition-outcome graph + 5-state rules dataset. **GTM:** consumer-first, SEO tool + household invites; first 5 partner conversations (ISP/storage/utility). **90–180 (retention + first partners):** post-move monitoring hero; proof-packet preview + e-sign prototype; 5 GEO state-rule guides; storage + mover referral; first property-manager pilot conversation (no build). **180–365 (deepen + expand):** monitoring as standing subscription; Move Rules Registry public (GEO); utility referral substrate (EIA); evaluate B2B2C white-label only if consumer metrics + ≥1 partner pull are real; aggregated non-PII insights R&D. **Proof needed before scaling anything B2B/partner:** real activation→paid conversion, real D30 post-move return, ≥1 partner actively distributing.

---

# Required deliverables (the 11 asks)

**1) Top 10 strategic conclusions:** (i) The data/integration layer is largely **built** (~24 wired) — stop framing vision as "integrate APIs." (ii) **Trust is the moat** in a category of lead-funnels + COA scams. (iii) Monetize the **subscription ladder** first; referral revenue is additive. (iv) The **Individual paywall** is the highest-leverage first revenue test. (v) The two real moats are the **consented transition-outcome graph** + a **maintained 50-state rules dataset** (no API exists → curation is the barrier). (vi) SEO/GEO must ride **owned data** (dossier/rules), never thin doorways. (vii) Referrals are **legally gated** (insurance licensing, TCPA, FTC disclosure, COA) — design as flat, disclosed, consented click-outs. (viii) **Never** auto-file COA or imply USPS affiliation; be the anti-scam guide. (ix) B2B2C (Updater/MoveEasy territory) is the big TAM but **deferred** until consumer pull + a partner exist. (x) Post-move monitoring is the only structural answer to the episodic-move retention trap.

**2) Top 10 API opportunities:** USPS-OAuth hygiene · proof-packet e-sign · broadband referral (FCC data) · Census/TIGERweb SEO shapes · deepen+monetize dossier · SMS (Twilio 10DLC) · USPS-COA guide page · EIA/OpenEI address→utility · identity verification (on demand) · address-validation upgrade (only if accuracy gap).

**3) Top 10 partnership categories:** broadband · storage · mover marketplaces · utility concierge · property managers · brokerages · insurance (flat-fee) · mortgage/title · relocation/employer/military/senior/student · data vendors (supplier).

**4) Top 10 monetization:** subscription ladder · proof-packet upsell · monitoring premium · AI briefing premium · broadband referral · storage referral · mover referral · utility rev-share · B2B2C white-label (later) · aggregated non-PII insights (future).

**5) Top 10 SEO/GEO:** "moving to [city/state] checklist" · "address change checklist [state]" + DMV · utility/internet transfer pages · "moving from X to Y" · flood/school/ISP factual tools (owned data) · state move-rules GEO guides · `/moving/[state]/[city]` enrichment · address-change checklist generator tool · "internet at my new address" tool · USPS-COA anti-scam guide.

**6) First 10 roles to contact:** ISP affiliate manager (CJ/Xfinity) · storage marketplace partnerships lead · utility-concierge partnerships lead · mover-marketplace BD · multifamily PropTech BD · brokerage relocation director · independent insurance agency principal · mortgage broker · employer HR/People-ops · university off-campus housing office.

**7) First 5 outreach angles:** (see OUTREACH_PLAYBOOK) ISP serviceability click · storage warm hand-off · utility-concierge distribution/white-label · property-manager resident concierge · insurance compliant flat-fee referral.

**8) First 5 validation experiments:** (i) Individual paywall conversion funnel. (ii) Free tool (flood/ISP) → account save rate. (iii) Broadband referral click-out CTR + disclosure compliance. (iv) Post-move "What's coming" monitoring → D30 return. (v) Transition-outcome graph v1 (instrument 5 coarse events, 5-state rules dataset).

**9) First 3 things Codex should turn into implementation specs:** (i) USPS-OAuth hygiene audit + USPS-COA anti-scam guide page (docs-only spec → approval). (ii) Free-tool MVP (flood-zone or "internet at my new address") on the **already-wired** FEMA/FCC data with save-to-account + SEO schema. (iii) Consented transition-outcome event taxonomy + 5-state Move Rules dataset schema (no PII), extending `analytics/EVENT_TAXONOMY.md` + `product/MOVE_RULES_REGISTRY.md`.

**10) Exact Codex ingest prompt** — see below.

**11) Handoff** — this file.

---

## Codex ingest prompt (deliverable 10)

```
You are Codex operating on the LocateFlow Product Brain (docs/ai). Ingest the vision handoff at
docs/ai/handoffs/2026-06-15-155106-claude-vision-api-partnership-growth.md and split it into the
canonical vision files below. DOCS ONLY — do not modify application source code, do not enable any
integration, do not change billing copy, do not persist telemetry. Preserve every [FACT]/[INTERP]/[HYPO]
tag and every citation URL. Keep verified capability separate from hypothesis. Use "guided action"
language; never imply automated provider/COA changes or unverified partnerships.

Create/update:
- docs/ai/vision/VISION_MASTER_PLAN.md            <- "VISION_MASTER_PLAN.md" section (+ section A baseline)
- docs/ai/vision/API_OPPORTUNITY_MATRIX.md        <- "API_OPPORTUNITY_MATRIX.md" section (keep the table + ranks)
- docs/ai/vision/PARTNERSHIP_TARGET_MAP.md        <- "PARTNERSHIP_TARGET_MAP.md" section
- docs/ai/vision/MONETIZATION_MAP.md              <- "MONETIZATION_MAP.md" section
- docs/ai/vision/SEO_GEO_SITE_STRATEGY.md         <- "SEO_GEO_SITE_STRATEGY.md" section
- docs/ai/vision/OUTREACH_PLAYBOOK.md             <- "OUTREACH_PLAYBOOK.md" section
- docs/ai/vision/API_INTEGRATION_ROADMAP.md       <- "API_INTEGRATION_ROADMAP.md" section
- docs/ai/vision/DATA_MOAT_STRATEGY.md            <- "DATA_MOAT_STRATEGY.md" section
- docs/ai/vision/RISK_AND_COMPLIANCE_GUARDRAILS.md<- "RISK_AND_COMPLIANCE_GUARDRAILS.md" section
- docs/ai/vision/90_180_365_DAY_PLAN.md           <- "90_180_365_DAY_PLAN.md" section

Then: (a) add a "## Vision" block to docs/ai/00_PRODUCT_BRAIN_DASHBOARD.md linking the 10 new files;
(b) append the "First 3 things Codex should turn into implementation specs" as docs-only tasks in
docs/ai/03_NEXT_AGENT_TASKS.md under "Blocked Until Verified / Ready for Approval";
(c) add a one-line Obsidian backlink from each new vision file to [[00_PRODUCT_BRAIN_DASHBOARD]] and to
its nearest existing product/growth note. Do not invent demand/revenue/partnership/traffic. Write a short
handoff under docs/ai/handoffs/ noting changed files and that no source was modified. Stop for human
approval before any source-code, integration-enable, telemetry-persistence, or billing-copy work.
```

---

## Verification log & evidence boundaries

- **Verified in LocateFlow source (this + prior passes):** the ~24 integrations (verifier lane, file paths above); the entitlement ladder; the moving-plan paywall; the AI Briefing/MoveTask/cron/dossier facts.
- **Cited public/primary facts:** USPS Web Tools retirement 2026-01-25 (usps.com/developers.usps.com); NCOALink $175k + PAF/Privacy-Act licensing (postalpro/federalregister); USPS COA scam guidance (uspis.gov, uspsoig.gov); FTC 16 CFR 255 + .com Disclosures (ftc.gov, ecfr); COPPA 2025 amendments (ftc.gov, skadden); insurance referral/licensing (NAIC, Bressler, Insurance Journal); TCPA one-to-one (natlawreview); Google spam/page-experience/FAQ-drop/HowTo-deprecation (developers.google.com, SEJ); GEO (arxiv 2311.09735, frase); Census mover stats (census.gov); Updater/MoveEasy/HireAHelper/moveBuddha (builtinnyc, inman, rismedia, pitchbook, movebuddha); storage 2–3× rent (storagepug); Allconnect/Xfinity-CJ/AT&T affiliate (allconnect, xfinity, CJ); Apple SBP 15% (developer.apple.com); Stripe/Resend/Postmark/Twilio-10DLC/Expo/DocuSign/Dropbox-Sign/Anvil/Stripe-Identity/Persona/Plaid (first-party docs; some pricing LOW-CONFIDENCE vendor-comparison, flagged).
- **LOW-CONFIDENCE (flagged, do not treat as fact):** per-lead price ranges (marketing blogs); Xfinity/AT&T affiliate $ amounts (3rd-party directories); Persona/Plaid exact pricing; Google Maps caching/retention ToS clauses (verify before persisting geocodes).
- **Never asserted:** customer demand, traffic, conversion, churn, LTV, live partnerships, prod AI-key state, any account-change automation.
- **Process note:** an earlier session's subagent hit a prompt injection; this vision run saw none. No source modified.
