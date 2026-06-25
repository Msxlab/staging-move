# Design QA - Light Dashboard Shell Follow-up

final result: blocked

source visual truth path: `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html`

implementation screenshot path: `C:/Users/Windows/AppData/Local/Temp/codex-clipboard-9dbdcdd0-3602-412c-8ab7-ed161994ff13.png`

viewport: desktop browser screenshot from user, exact viewport not verified in tooling.

state: light-mode authenticated dashboard.

full-view comparison evidence: blocked. The user-provided staging screenshot shows the light dashboard shell looking too muddy/grey-beige after the previous raw `#EFEADF` app-shell change. This session could inspect the screenshot path and source/code, but the current toolset did not expose a controllable Chrome/browser capture for a fresh same-state side-by-side comparison.

focused region comparison evidence: blocked. The affected region is the dashboard shell/background behind the briefing, command center, and dashboard cards. A same-viewport rendered implementation capture is still needed before a pass can be claimed.

findings:

- [P1] Light dashboard background is over-tinted.
  Location: `apps/web/src/styles/globals.css`, `.light` and `.light .app-shell-backdrop`.
  Evidence: the source keeps `#EFEADF` as a warm paper token, but the user screenshot shows the full dashboard washed by a heavy beige/grey layer. The implementation was using raw `var(--bg)` as the full app shell background.
  Impact: dashboard readability and perceived polish drop sharply; cards feel low-contrast and dirty instead of clean warm-paper.
  Fix made: keep source token `#EFEADF`, but change `--lf-app-bg` to a white-to-warm-paper gradient using only 18% of the beige token, and reduce the light backdrop/grid opacity.

patches made since previous QA pass:

- `apps/web/src/styles/globals.css`: light app shell no longer uses raw `var(--bg)`; backdrop/grid opacity reduced.
- `apps/web/src/lib/pricing-free-tier-contract.test.ts`: guard changed so the source token remains, while raw beige flooding the shell is rejected.

remaining blockers:

- Fresh staging/browser screenshot after deploy.
- Same-state side-by-side comparison against source visual.
- Home dossier layout/motion parity remains a separate open P1: source `Move.dc.html` uses prominent dossier scene-card bands, while current production/web dossier still uses a data-row pattern.
