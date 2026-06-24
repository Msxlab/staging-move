# Design QA - 2026-06-24 Light Theme + Dossier Scenes

Final result: blocked

Reason: local component-level visual QA passed, including a second light-shell check for the dashboard color regression, but full authenticated staging/browser verification still depends on Dokploy rebuilding the latest PR commit before the user-facing page can be judged.

## Checked

- Source prototype rendered from `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Move.dc.html`.
- Web dossier ambient harness rendered from the real `DossierAmbient` component and `source-dossier-scene.css`.
- Harness screenshot: `docs/ai/audits/2026-06-24-source-dossier-qa/01-web-dossier-ambient-harness.png`.
- Light shell screenshot: `docs/ai/audits/2026-06-24-source-dossier-qa/02-web-light-shell-harness.png`.
- Source screenshot: `docs/ai/audits/2026-06-24-source-dossier-qa/00-source-move-prototype.png`.
- Metrics file: `docs/ai/audits/2026-06-24-source-dossier-qa/01-web-dossier-ambient-harness.metrics.json`.
- Light shell metrics: `docs/ai/audits/2026-06-24-source-dossier-qa/02-web-light-shell-harness.metrics.json`.

## Local Pass Criteria Met

- Light canvas is now the source warm paper `#EFEADF`, with a much lighter app-shell overlay.
- Light glass/card utilities are forced toward clean paper surfaces instead of muddy translucent ink.
- Dossier rows use brighter light surfaces.
- Rain umbrella scene is visible.
- Flood maps to water scenes.
- Radon maps to air scenes.
- School and low-walkability neighborhood do not render the area chase/crime scene.
- QA metrics confirm visible dimensions for umbrella, lightning, mask, glass, vehicle, and lamp glow.

## Still Needs Staging QA

- Reload `https://staging.locateflow.com/dashboard` after Dokploy deploys the latest PR commit.
- Verify dashboard light mode no longer appears dark/grey-brown.
- Verify `/dashboard` and home dossier rows on real account data.
- Re-test PDF export endpoint on staging because this pass focused on light theme and dossier scene regressions.
