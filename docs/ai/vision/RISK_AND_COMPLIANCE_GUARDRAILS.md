# Risk And Compliance Guardrails

## Status

decision candidate

## Executive summary

Trust is a product feature. LocateFlow must avoid claims that it files government changes, performs provider account changes, has official partnerships, sells leads/data, or provides legal/insurance/tax advice unless independently verified and approved.

Dashboard backlink: [[00_PRODUCT_BRAIN_DASHBOARD]]
Nearest notes: [[experience/TRUST_AND_SAFETY_EXPERIENCE]], [[memory/RISK_REGISTER]], [[product/MOVE_RULES_REGISTRY]]

## Verified current LocateFlow capability

- Product Brain verifies trust copy exists around manual provider confirmation, AI limitations, dossier disclaimers, export step-up, and no autonomous provider changes.
- Product Brain verifies high-risk areas: billing, authentication, user data, provider integrations, webhooks, environment variables, and migrations.
- No live partnerships, provider account changes, or official affiliations are verified.

## Public-source facts

- Reported public-source fact; spot-check recommended: USPS COA scam guidance requires care around official USPS links and affiliation language.
- Reported public-source fact; spot-check recommended: FTC affiliate/sponsored disclosure rules apply to referral monetization.
- Reported public-source fact; spot-check recommended: insurance referral and quoting rules are licensing-sensitive.
- Reported public-source fact; spot-check recommended: TCPA, COPPA, UPL, CCPA/CPRA, and state privacy laws affect SMS, minors, legal guidance, data retention, and referral flows.

## Strategic interpretation

Avoid:

- "We change/transfer/cancel your accounts."
- "We file your USPS change of address."
- "Official USPS/government/provider partner."
- "We sell leads/data."
- Insurance quote/compare/best-rate language.
- Partner logos or claims before signed deals.
- Traffic, conversion, revenue, or customer-demand claims before verified.
- Legal, tax, or financial advice claims.

Prefer:

- "Guided action - you take the step."
- "We organize and remind; you confirm with the provider."
- "Informational, not legal/tax advice; verify with your state's official site."
- "Official USPS change of address is at moversguide.usps.com."

## Hypotheses

- Hypothesis: anti-scam and guided-action positioning improves trust and paid conversion.
- Hypothesis: precise disclosure reduces support and refund risk.
- Hypothesis: stale rules content is a major liability without source dates and confidence labels.

## Recommended decisions

- Make guided-action language mandatory for provider, USPS, insurance, and government-adjacent flows.
- Require source URL, last-verified date, and confidence labels for rules content.
- Require clear disclosure for affiliate, sponsored, or referral surfaces.
- Ban raw PII sale or partner data handoff without explicit consent and approved terms.

## Validation needed

- Legal/product review before public rules, referral, insurance, SMS, or COA content.
- Copy review for every partner/referral/free-tool page.
- Support monitoring for automation-confusion reports.

## Possible Codex tasks

- Draft a trust-copy rulebook for vision/growth work.
- Draft COA anti-scam guide acceptance criteria.
- Draft compliance QA checklist for referral click-outs and free tools.

## Claude review questions

- Which claims should be globally forbidden?
- Where does "guided action" need stronger wording?
- Which compliance risk should block the first selected lane?
