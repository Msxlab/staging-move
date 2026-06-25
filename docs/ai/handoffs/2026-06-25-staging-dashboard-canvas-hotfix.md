# 2026-06-25 Staging Dashboard Canvas Hotfix

## Summary

Prepared a staging hotfix branch from latest `origin/staging` to reverse the muddy light dashboard canvas regression reported from staging.

## Changed

- Web light app canvas now uses neutral `#F8FAFC` instead of a warm radial beige gradient.
- Shared light surface tokens now use neutral app surfaces so generated web CSS does not reintroduce `#EFEADF` as the global app background.
- `#EFEADF` is retained as `--lf-source-paper-bg` for scoped source/dossier paper usage rather than global app shell usage.
- Aurora light override now uses neutral `--background: 210 40% 98%`.
- Pricing/free-tier contract test now guards against the beige/radial regression.

## Not Changed

- No mobile UI source was edited.
- No PDF/dossier export code was edited.
- No deployment or merge was performed.

## Validation Plan

- `pnpm tokens:emit`
- `pnpm tokens:check`
- targeted web contract test for `pricing-free-tier-contract.test.ts`
- `git diff --check`

