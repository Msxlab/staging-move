# Export Proof Packet Experience

## Current verified experience

- The web settings export page supports account data export for addresses, services, budget, and moving data.
- Export APIs require authentication, rate limiting, and step-up verification before producing sensitive exports.
- Export responses mask sensitive fields where appropriate.
- PDF exports exist for address monthly expense snapshots and full-account snapshots.
- Advanced tax/property reports and dossier PDF exports are Pro-gated.
- Home Dossier already includes source-backed sections and visible limitations/disclaimers.

## User goal

Create a trustworthy packet that can be saved, shared, or used as proof for a landlord, insurer, employer, school, accountant, or personal records.

## Emotional job

Replace "I hope I can prove what changed" with "I have a clean record of the move and the important confirmations."

## Current friction

- Export currently lives in settings rather than inside the move-completion or provider-transition flow.
- The verified exports are useful primitives, but there is no verified dedicated "move proof packet" surface.
- Users may not discover exports at the moment they most need proof.
- Step-up verification is a trust strength, but the UX must explain why it appears before sensitive export generation.

## Aha opportunity

"LocateFlow gave me the packet I needed without digging through provider emails, screenshots, and spreadsheets."

The strongest proof-packet aha is generated after key transitions are marked confirmed, with clear included sections and privacy warnings.

## Revenue opportunity

- Pro upgrade for advanced proof packets, dossier PDFs, tax/property reports, and complete move records.
- Family/Pro packaging for households that need shared proof and handoff documents.
- Natural upgrade moment after a user completes several provider transitions or tries to export a complete packet.

## Data moat opportunity

- Consented, coarse signals: packet type generated, sections included, proof generated yes/no, transition statuses included, blocker categories resolved.
- Do not use raw PDF content, documents, confirmation numbers, account numbers, names, emails, phone numbers, or raw addresses as moat signals.

## Hypotheses

- Hypothesis: proof packet generation creates stronger willingness to pay than generic "advanced export" language.
- Hypothesis: the highest-intent packet use cases are landlord, insurance, employer relocation, school, and tax/property records.
- Hypothesis: proof packets increase trust because they make LocateFlow feel like a record system, not only a task list.

## Recommended experiments

1. Docs-only proof packet spec using existing export and dossier primitives.
2. Proof-packet upgrade teaser on completed move tasks and export settings.
3. One-page proof packet preview that lists included sections without generating sensitive output.

## Possible Codex implementation tasks

- Draft a proof-packet MVP spec that maps current export APIs, home dossier PDFs, and move-task statuses.
- Draft copy guardrails for what a proof packet can and cannot claim.
- Prepare a source-change task plan for a proof-packet preview, then stop for human approval.
