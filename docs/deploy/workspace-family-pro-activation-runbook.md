# Workspace (Family/Pro) Activation Runbook

How to turn on the multi-member Workspace/Household feature for Family & Pro in
production. The whole subsystem is built and tested but gated OFF behind the
`WORKSPACE_MODEL_ENABLED` master flag. Flipping the flag alone is **not enough** —
existing accounts must be backfilled first, or members see an empty household.

Do the steps **in order**. Steps 1–2 are safe and reversible; step 3 is the
user-visible go-live.

---

## What ships in this change

- **Flag is now operable from admin.** `WORKSPACE_MODEL_ENABLED` is registered in
  the Runtime Config catalog (`packages/shared/src/runtime-config.ts`), so an
  admin can toggle it from **Admin → Settings/Feature Flags** instead of only via
  an env var. Default stays OFF.
- **Surfacing.** When the flag is on and the user is a Family/Pro owner (or an
  invited member):
  - Mobile: a **Household card** on the dashboard (`apps/mobile/app/(tabs)/index.tsx`).
  - Web: a **Household entry** in the sidebar (`apps/web/.../layout.tsx` →
    `showWorkspace`). The full management screen already exists at
    `/settings/workspace` (web) and `app/settings/workspace.tsx` (mobile).
- **Admin visibility.** New **Workspaces** section
  (`apps/admin/.../(admin)/workspaces`): list (owner, plan, seats, member count)
  + detail (member roster with roles/status/joined/last-active **and per-member
  "who entered what"** — addresses/services/budgets each member created — plus
  pending invitations). Gated at `users:canRead`.
- **Robustness.** Mobile distinguishes "feature off" (`WORKSPACE_DISABLED` code)
  from a transient/network error (shows a retry instead of a permanent "coming
  soon"). Displayed seat count now matches invite enforcement (non-SUSPENDED).

The read/write scoping (members sharing addresses/services/budget) was already
wired into the 10 domain routes via `resolveWorkspaceDataScope` /
`scopedRecordWhere` — it activates automatically when the flag flips.

---

## Step 1 — Deploy the code

Deploy the branch to production as usual (merge to `main` → DigitalOcean deploy).
This adds the flag to the catalog, the surfacing, and the admin section. Nothing
changes for users yet because the flag is still OFF.

## Step 2 — Backfill existing accounts (REQUIRED before go-live)

Existing accounts created while the flag was off have **no** `Workspace` /
`WorkspaceMember` rows. Provision them and stamp their records with `workspaceId`:

```bash
# In a DigitalOcean console (or any shell with prod DATABASE_URL), from repo root:
DATABASE_URL="$MYSQL_DATABASE_URL" \
  pnpm --filter @locateflow/db exec tsx prisma/migrate-to-workspaces.ts
```

The script (`packages/db/prisma/migrate-to-workspaces.ts`) is **idempotent and
resumable** — re-running creates no duplicate workspaces and only fills rows
where `workspaceId IS NULL`. It logs a per-batch stats summary. Safe to run while
the flag is still OFF (the rows just sit there inertly).

New signups after this point are auto-provisioned by `ensureWorkspaceDefaults`
**once the flag is on**. To avoid a gap for users who sign up between the backfill
and the flag flip, run the backfill **again right after** step 3 (idempotent).

## Step 3 — Flip the flag (go-live)

Either:

- **Admin (preferred):** Admin → Feature Flags / Runtime Config → set
  `WORKSPACE_MODEL_ENABLED` = `true`. Takes effect without a redeploy.
- **Env:** set `WORKSPACE_MODEL_ENABLED=true` on the web component and redeploy.

Immediately after, re-run the step-2 backfill once more to provision anyone who
signed up during the window.

## Step 4 — Verify

- Mobile (a Family/Pro account): dashboard shows the **Household** card; tapping
  it opens member management; web shows the **Household** sidebar entry.
- Web `/settings/workspace`: owner can invite, change roles, transfer, rename.
- Admin → **Workspaces**: the household appears with owner/plan/seats; detail
  shows the roster and per-member "who entered what".
- An invited member sees the owner's shared addresses/services (workspace-scoped
  reads); a CHILD member does not see budget/financials.

## Rollback

Set `WORKSPACE_MODEL_ENABLED` back to `false` (admin toggle or env). Every
`/api/workspaces*` route returns 404 again, domain reads fall back to the
single-user path, and the surfaces hide. The backfilled `workspaceId` columns and
`Workspace`/`WorkspaceMember` rows are harmless when the flag is off and do not
need to be removed.

---

## Notes / follow-ups (not blockers)

- **i18n:** mobile `workspace.*` strings still use inline English defaults; add
  them to the mobile message catalogs for full localization.
- **Field-level visibility:** `Service.sensitiveVisibility` (OWNER_ONLY vs
  WORKSPACE) is not yet a column; CHILD financial-hiding for shared services
  relies on role-based query redaction. Add the column if per-field sharing
  control is needed.
- **Audit trail:** there is no `WorkspaceActivity` log; admin "who entered what"
  is current-owner attribution (record `userId` → member), not a change history.
  Add a `WorkspaceActivity` model if "who changed/removed what, when" is required.
