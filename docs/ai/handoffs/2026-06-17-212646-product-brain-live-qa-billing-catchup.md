# 2026-06-17 21:26 - Product Brain Live QA + Billing Catch-Up

## Summary

This pass applied the next three recommended process steps:

1. Updated the Product Brain with the current production state.
2. Ran a limited live public QA pass.
3. Ran a billing-readiness consistency pass from live public surfaces and current `move-main/main` source.

No application source code was modified.

## Changed Files

- `docs/ai/00_PRODUCT_BRAIN_DASHBOARD.md`
- `docs/ai/02_ACTIVE_EXPERIMENTS.md`
- `docs/ai/03_NEXT_AGENT_TASKS.md`
- `docs/ai/04_WEEKLY_REVIEW.md`
- `docs/ai/handoffs/2026-06-17-212646-product-brain-live-qa-billing-catchup.md`

## Verified Current State

- Dokploy production compose latest deployment is `Done` at commit
  `c0fbf638dd35acd535e7a5e967df9d0ab50f94c9`.
- Dokploy containers shown running:
  - `locateflow-web` running, healthy
  - `locateflow-admin` running, healthy
  - `locateflow-mysql` running, healthy
  - `locateflow-imgproxy` running
  - `locateflow-cron` running
- Public acquisition endpoint returned:
  - `campaignCode: INDIVIDUAL90` as a compatibility code
  - `trialDays: 14`
  - annual offer `$24/year`
  - monthly offer `$4.99/month`
  - no public `90 days`, `3 months`, or `$3.99` offer text
- Current `move-main/main` source has canonical pricing:
  - Individual `$24/year` and `$4.99/month`
  - Family `$39/year` and `$7.99/month`
  - Pro `$59/year` and `$11.99/month`
- Current `move-main/main` source has checkout Stripe Price Guard logic before session creation.
- Mobile OTA production update was published earlier for runtime `sdk55-1.0.0`, update group
  `8303c581-4450-4ce0-9cc0-c78fdde17cf4`.

## Live Public QA Results

Checked through Chrome/rendered DOM:

- Home page rendered current annual-first pricing and 14-day trial copy.
- Pricing page rendered current annual-first pricing and 14-day trial copy.
- Pricing page rendered Pro-only Home Dossier PDF export.
- Checked rendered public pages had `0` invalid `a button` / nested anchor-button matches.
- `img.locateflow.com` returned the imgproxy landing response.

Checked through Node HTTPS GET:

- `https://locateflow.com/` returned `200`, current 14-day / `$24/year` copy, and no old `$39.99/year` or `3 months free` copy.
- `https://locateflow.com/pricing` returned `200`, current 14-day / `$24/year` copy, and no old `$39.99/year` or `3 months free` copy.
- `https://locateflow.com/api/acquisition/public-trial-campaign` returned `200` and current campaign JSON.
- `https://locateflow.com/api/health` returned `200`.

Blocked / not completed:

- Logged-in dashboard QA was not completed because no QA account flow was used in this pass.
- Free-tier enforcement network checks were not completed.
- On-device mobile OTA verification was not completed.
- Stripe Dashboard price objects were not fully verified; reading the open Stripe tab timed out.
- App Store Connect / Google Play Console price settings were not verified.

## Mustafa Report Check

Verdict: mostly correct, with one wording correction.

Confirmed:

- Site/admin/imgproxy are live enough from the checked surfaces.
- Dokploy containers are up as reported.
- Latest deployment is successful at `c0fbf638`.
- Older deployment errors are historical and do not appear to be the current serving deployment.
- `locateflow-cron` is currently producing real errors.
- Current cron log examples include:
  - `Job "blog-publish"` failing with `wget: missing URL`
  - `Job "checkout-cleanup"` failing with `wget: missing URL`
  - `Job "connector-dispatch"` failing with `wget: missing URL`
- Runtime logs show Ofelia starting commands as:
  - `sh -c wget -qO- --header="Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/blog-publish`
- Source commands in `docker/ofelia.ini` are written as:
  - `command = sh -c "wget -qO- --header=\"Authorization: Bearer $CRON_SECRET\" http://localhost:3000/api/cron/..."`

Correction:

- I did not re-check `CRON_SECRET` inside the container in this pass, so the statement "`CRON_SECRET` container içinde var" should be treated as previously observed by the reporter, not re-verified here. The current error shape strongly points to command parsing rather than missing secret.

Recommended wording for Mustafa:

- The current production issue is Ofelia command parsing/quoting in `docker/ofelia.ini`.
- Fix either by using a verified `/bin/sh -lc '...'` form or, more robustly, by adding a tiny cron runner script that receives the job name and builds the `wget` call internally.
- Verify in Dokploy logs that jobs actually hit the intended `/api/cron/*` endpoints before relying on production cron.

## Recommended Next Order

1. Source fix for Dokploy Ofelia cron command execution, then redeploy and verify logs.
2. Live logged-in QA with QA accounts: dashboard, free-tier enforcement, onboarding, pricing, and checkout smoke.
3. Billing readiness: Stripe Dashboard price objects, webhook delivery, App Store Connect and Google Play Console price tiers.
4. On-device mobile OTA verification on current runtime.
5. Only then start the next product build, with post-move monitoring still the best next candidate.

## Guardrails

- No source code modified.
- No production data inspected beyond operational Dokploy status/logs and public acquisition/pricing output.
- No secrets printed.
- No deploy, push, Stripe write, store write, migration, or flag enablement performed in this pass.
