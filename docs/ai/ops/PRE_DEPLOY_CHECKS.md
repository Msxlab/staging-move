# Pre-Deploy Checks

GitHub Actions CI is intentionally disabled while GitHub billing blocks workflow
runs. Before deploying to Dokploy, run:

```bash
pnpm check
```

Also review the pending diff:

```bash
git diff
```

This local gate replaces the GitHub CI quality gate while Actions is disabled.
It runs the shared typecheck plus the web and admin test suites without adding
dependencies or consuming GitHub Actions minutes.
