# 2026-06-22 Theme Source Integration Pass

## Active Context

Target repo: `C:\Users\Kutay\Documents\staging-move`.

Do not continue work in `C:\Users\Kutay\Desktop\move-main\move-main`; that folder may be inspected for accidental prior edits only.

Staging runs in Dokploy from branch `codex/staging-audit-2026-06-21` for:

- Web: `https://staging.locateflow.com`
- Admin: `https://admin-staging.locateflow.com`
- Imgproxy: `https://img-staging.locateflow.com`

Use the already-open Chrome session with the Mustafa@axtra account for live Dokploy/staging checks.

## Source Theme Bundle

Current source of truth is the local HTML theme bundle:

- Root: `C:\Users\Kutay\Downloads\tema-20260621T192823Z-3-001\tema`
- Homepage: `Initial check requested-handoff (7)\initial-check-requested\project\Move Web.dc.html`
- Mobile: `Initial check requested-handoff (9)\initial-check-requested\project\Move.dc.html`
- Admin/public/auth sources are also under `Initial check requested-handoff (7)\initial-check-requested\project`.

Important product decision:

- Product name is `LocateFlow`, not `Move`.
- `Move` may appear only as a domain noun such as move date, move command center, or move plan.
- Dark mode should use the bundle's Gold accent: `#CBA45E`, `#DCBC7C`, `#B0852F`.
- Light mode should use Sapphire/blue: `#2E5FB0`, `#3D74C8`, `#244C90`.
- Emerald is not the selected staging theme.

## Work Applied In This Pass

- Shared theme tokens, web CSS, admin CSS, and mobile runtime theme were updated toward the dark-Gold/light-Sapphire split.
- Homepage hero copy was aligned to the source bundle direction: `Relocation Intelligence`, `Your entire move, handled.`, LocateFlow copy, and source-style trust row.
- The homepage phone mockup was rebuilt as an interactive mobile surface with mode pills, bottom tabs, and navigable Home/Moving/Services/Addresses/More screens.
- Public page shell styling was moved toward the source bundle's open hero and section treatment instead of card-in-card framing.
- Premium stickers, medallions, route-map accents, OG fallbacks, manifest/icon SVG color surfaces, and several mobile cards/buttons/widgets were aligned with the current brand split.
- Stale docs that described all-Sapphire runtime theming were corrected in `docs/ai/03_NEXT_AGENT_TASKS.md` and the broad staging audit prompt.
- Source bundle inventory confirms the standalone mobile module concepts exist in the repo as routes: reminders, help/tickets, search, providers/compare, custom providers, invitations, notifications, blog, and settings surfaces. The More tab links the key standalone modules; live mobile/emulator QA is still required.

## Local Validation

- `git diff --check` passed with CRLF warnings only.
- `pnpm verify:typecheck` passed on local Node `v24.12.0` with engine warnings because the repo targets Node `22.x`.
- `pnpm verify:tests` passed: web 2760, admin 779, mobile 325, shared 388, connectors 105 tests.
- `DATABASE_URL=mysql://user:pass@localhost:3306/locateflow pnpm --filter @locateflow/db exec prisma validate` passed.
- `pnpm --filter @locateflow/web build` passed.
- `pnpm --filter @locateflow/admin build` passed.
- Web/admin builds still emit existing follow-up warnings: Next middleware convention should move to `proxy`, and Turbopack warns about `@prisma/client` CommonJS `export *` usage in route import traces.

## Live Staging Deploy / QA

- Commit `8fb63c5b` (`Integrate source theme across staging surfaces`) was pushed to `origin/codex/staging-audit-2026-06-21`.
- Dokploy manual compose deploy was triggered from the existing Chrome session. The first webhook refresh icon opened a token-rotation modal; it was canceled without confirming. The safe `General -> Deploy -> Confirm` path was then used.
- Web and admin `/api/build-info` both reported commit `8fb63c5b` on branch `codex/staging-audit-2026-06-21` after polling.
- Public smoke with `curl.exe` returned `200` for `/`, `/features`, `/why-free`, `/pricing`, `/help`, `/blog`, `/faq`, `/sign-in`, `/sign-up`, and `/onboarding`; all scanned HTML contained `LocateFlow` and no `>Move<`, `Move Admin`, or `LocateFlow Move` wordmark drift.
- Admin smoke returned `200` for `/login`, `/api/healthz`, and `/api/ready`; admin login title is `LocateFlow Admin` and no `Move Admin` drift was found.
- Chrome visual QA on `https://staging.locateflow.com/?qa=8fb63c5b` confirmed the new homepage: header includes Features, Why free, Pricing, Help, Blog, FAQ; hero reads `Relocation Intelligence` and `Your entire move, handled.`; interactive phone shows Rough/Dream controls. Dark mode renders Gold; light mode renders Sapphire/blue.
- Chrome visual QA on `https://admin-staging.locateflow.com/login?qa=8fb63c5b` confirmed the admin login shell uses LocateFlow/Admin Command copy and dark Gold accents.
- Authenticated admin dashboard QA did not proceed because the password manager popup opened and the password field was empty. Do not automate the password manager. User must fill/submit admin credentials or provide explicit next-step direction.

## Known Remaining Checks

- Run authenticated web app dashboard QA after confirming a QA user session.
- Run authenticated admin dashboard QA after the user fills/submits admin credentials.
- Run a deeper source-vs-live visual comparison against the listed HTML files for mobile, admin dashboard, blog, features, auth/login, and onboarding. Record every missing component, button, icon, animation, and copy mismatch before fixing.
- Real mobile/emulator QA remains required for native tabs, onboarding progress, services, provider cards, subscription screen, OAuth handoff, offline/cache, app lock, and reduced motion.

## Watch Items

- Older memory in `2026-06-21-staging-audit-prep.md` contains historical Sapphire-only decisions. Treat those as superseded by this handoff.
- Some Sapphire hex values are intentionally retained for light mode, PDF output, and tests that validate invalid color parsing. Do not remove them mechanically.
- Warning amber/brown should remain only for semantic warning/caution states.
- Do not reveal or record Dokploy webhooks, copied env values, session secrets, or staging credentials.
