# Adversarial Verification: dashboard-web-app-01

**Finding under review:** "Inline /settings account-delete never sends MFA code; MFA users hit a dead end"
**Claimed severity:** High | **Category:** Logic
**Verdict:** CONFIRMED (with scope correction) | **Adjusted severity:** Medium

## What the original finding claimed

`apps/web/src/app/(app)/settings/page.tsx` `handleDeleteAccount` posts only
`{ confirmText, confirmPassword | confirmAccountDeletion }` and never
`mfaCode`/`backupCode`. For an MFA-enabled user the server requires the second
factor and returns `STEP_UP_REQUIRED` (403). The inline UI has no MFA input,
only a generic toast, so the flow loops with no way to supply the code.

## Code I read and what it proves

### 1. Inline settings flow does NOT send an MFA code — confirmed
`apps/web/src/app/(app)/settings/page.tsx`:
- `handleDeleteAccount` (lines 179-210) builds the request body at lines 187-190:
  `{ confirmText, ...(oauthOnly ? { confirmAccountDeletion: true } : { confirmPassword }) }`.
  No `mfaCode` / `backupCode` is ever sent.
- The render block (lines 295-345) has only a "type DELETE" input and a password
  input (lines 315-327, shown only when `hasPasswordLogin !== false`). There is
  no MFA / two-factor input anywhere on the page.
- A repo-scoped grep for `mfaCode|backupCode|mfaRequired|two-factor` in
  `settings/page.tsx` returns **no matches** — the page has zero MFA awareness.
- On a non-OK response, lines 202-204 only call `toast.error(data.error)` and
  `setDeleteStep("confirm")`. There is no `STEP_UP_REQUIRED` branch and no way to
  reveal an MFA field. The user loops on the confirm step. **Confirmed.**

### 2. Server requires the second factor for MFA users — confirmed
`apps/web/src/lib/user-step-up.ts`:
- The password-only success branch (lines 52-59) is gated on `!user.mfaEnabled`,
  so a correct password alone is NOT accepted for an MFA user.
- With no `mfaCode`/`backupCode` supplied, the MFA (61-67) and backup-code
  (69-90) branches are skipped.
- The OAuth-only bypass (96-102) requires `!user.passwordHash && !user.mfaEnabled`,
  so it does not apply to an MFA user.
- Lines 116-122 then return `{ ok:false, code:"STEP_UP_REQUIRED" }` for any
  `user.mfaEnabled && !mfaCode && !backupCode`.

`apps/web/src/app/api/account/delete/route.ts` line 114-138 calls
`verifyUserStepUp` and, on `STEP_UP_REQUIRED`, returns HTTP **403** (line 136).
So an MFA user posting from the inline settings flow always gets a 403 the inline
UI cannot recover from. **Confirmed.**

### 3. Scope correction — a working MFA delete path EXISTS elsewhere
The original finding's broad impact ("MFA users cannot delete their account") is
too strong. The **documented** deletion path is not the inline settings block:

- `apps/web/src/app/account/delete/page.tsx` (public docs) directs users to
  "Settings -> Privacy -> Delete account" (line 24) and links to
  `/settings/privacy` ("Open privacy settings", lines 125-130).
- `apps/web/src/app/(app)/settings/privacy/page.tsx` renders the real flow via
  `DeleteAccountDialog` (import line 13; usage lines 747-753), passing
  `mfaEnabled`.
- `apps/web/src/components/settings/delete-account-dialog.tsx` handles MFA
  correctly: `mfaCode`/`mfaRequired` state (lines 35-36), `showMfa = mfaEnabled || mfaRequired`
  (line 58), sends `mfaCode` (line 76), and on `STEP_UP_REQUIRED` sets
  `mfaRequired=true` and reveals a two-factor input (lines 82-84, 209-227).

So MFA users **can** delete their account via the privacy page dialog. The dead
end is specific to the legacy inline danger-zone block on `/settings`.

## Assessment

The reported defect is **real on the file cited**: the inline `/settings`
danger-zone delete flow cannot complete for an MFA-enabled user with a password
and has no MFA field, producing a loop on the confirm step. Evidence, server
behavior, and the missing UI are all confirmed in source.

However, the impact is narrower than stated: a fully working MFA-aware deletion
path exists on `/settings/privacy` (`DeleteAccountDialog`), which is the path the
product's own deletion docs point users to. The inline block is a redundant,
MFA-unaware duplicate. This is a genuine UX/logic dead end and a duplicate-flow
maintenance hazard, but it does not block account deletion for MFA users at the
application level. I therefore confirm the finding but lower severity from
**High to Medium**.

## Recommendation
Either route the inline `/settings` "Delete Account" block to the same
`DeleteAccountDialog` used on `/settings/privacy`, or add MFA handling
(`STEP_UP_REQUIRED` retry + two-factor input) to `handleDeleteAccount`. Removing
the duplicate inline flow in favor of the shared dialog is the cleaner fix.

## Related files
- apps/web/src/app/(app)/settings/page.tsx (lines 179-210, 295-345)
- apps/web/src/app/api/account/delete/route.ts (lines 114-138)
- apps/web/src/lib/user-step-up.ts (lines 52-59, 116-122)
- apps/web/src/components/settings/delete-account-dialog.tsx (lines 35-36, 58, 76, 82-84, 209-227)
- apps/web/src/app/(app)/settings/privacy/page.tsx (lines 13, 747-753)
- apps/web/src/app/account/delete/page.tsx (lines 24, 125-130)
