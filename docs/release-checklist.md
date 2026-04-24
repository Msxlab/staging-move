# Release Checklist

Use this before merging or deploying current-system changes.

## Scope

- Confirm the change stabilizes existing product behavior.
- Do not include future roadmap features without explicit product approval.
- Confirm no new paid tier, KYC, Plaid, USPS, connector, partner API, or speculative schema work is included.

## Security

- Review diff for secrets, token values, password/MFA material, reset/verification tokens, OAuth subject IDs, push tokens, and backup archives.
- Run or confirm CI secret scanning with gitleaks.
- Confirm new API routes require the intended auth method.
- Confirm server-side boundaries enforce unsupported/disabled states, not just UI copy.

## Data And Backup

- If backup/import code changed, run route tests and `DRY_RUN` restore checks where feasible.
- Confirm backup catalog labels match actual supported tables.
- Confirm destructive admin operations have confirmation or step-up auth where supported.

## Verification Commands

```bash
pnpm --filter @locateflow/web test
pnpm --filter @locateflow/admin test
pnpm verify:typecheck
git diff --check
```

If repo-wide typecheck fails on known pre-existing debt, list the exact failing files in the PR notes.

## Operational

- Update implementation notes or runbooks when behavior changes.
- Record migrations, new routes, feature flags, env keys, and changed runtime config requirements.
- Include rollback instructions for risky changes.

## Merge Notes

- Include `git diff --stat`.
- List new files explicitly.
- State whether tests passed, failed, or were blocked by pre-existing failures.
