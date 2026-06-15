\# AI Agent Rules for LocateFlow / move-main



\## Project



This repository powers LocateFlow / move-main.



The project may include:

\- Web app

\- Admin dashboard

\- Mobile app

\- Backend APIs

\- Database logic

\- Billing / IAP

\- Provider or address-change connector logic



\## Core Safety Rules



The AI agent must never:



\- Touch production data without explicit approval.

\- Commit secrets.

\- Print secrets.

\- Modify production environment files.

\- Run destructive database commands.

\- Run production migrations.

\- Access real customer PII unless explicitly approved.

\- Merge pull requests.

\- Deploy to production.

\- Use live Stripe, Apple, Google, USPS, carrier, or billing credentials.



\## Default Environment



Default to:

\- local

\- staging

\- QA accounts



Never assume production access is allowed.



\## High-Risk Areas



Extra caution is required for:



\- billing

\- Stripe

\- Apple IAP

\- Google Play IAP

\- authentication

\- account deletion

\- address-change connectors

\- user data

\- environment variables

\- database migrations

\- provider integrations

\- webhooks



\## Work Style



\- Read this AGENTS.md before doing work.

\- Inspect the repository before making assumptions.

\- Create a branch for code changes.

\- Make minimal focused changes.

\- Do not refactor unrelated code.

\- Do not change formatting across the whole repo unless requested.

\- Check package.json before assuming commands exist.

\- Run relevant lint, typecheck, tests, and build when available.

\- Do not install packages unless necessary and approved.

\- Do not run long-running commands unless approved.

\- Do not merge.

\- Do not deploy.



\## Expected Final Output



Every coding task must end with:



\- Summary

\- Changed files

\- Tests run

\- Risks

\- Manual QA steps

\- Recommended next action

