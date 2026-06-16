# Household Experience

## Current verified experience

- LocateFlow has workspace/household primitives in the technical memory baseline and visible invitation flows in the web app.
- The web dashboard includes a pending invitations banner that lets a signed-in user accept or decline household/workspace invitations.
- Invitation acceptance has a dedicated token page and routes accepted users into the app.
- Move tasks support assignment to active workspace members, and the moving plan UI exposes assignee controls for task ownership.
- Billing memory and product docs identify Family/Pro plan concepts and household collaboration as a current monetization surface.

## User goal

Coordinate a move with a partner, family member, roommate, or helper without losing track of who owns each provider, task, document, or follow-up.

## Emotional job

Turn "I have to remember everything myself" into "we have a shared command center and everyone can see what matters."

## Current friction

- Household value appears mainly when invitations or task assignment are encountered, not as a first-class mission-control experience.
- There is no verified dedicated household dashboard that summarizes owners, blocked tasks, pending invitations, and completion by person.
- The strongest household value may require a user to create enough addresses, services, or move tasks before collaboration feels necessary.
- Family/Pro upgrade value may be clear in entitlements but not yet tied to the exact moment a household needs coordination.

## Aha opportunity

"LocateFlow turned our move into shared responsibilities instead of a private checklist."

The best household aha is a screen where the move owner sees each member, assigned provider transitions, overdue tasks, and proof-ready items in one place.

## Revenue opportunity

- Family plan upgrade at the first high-intent invite or second-member assignment moment.
- Pro upgrade for households that need proof packets, advanced exports, or richer monitoring.
- Retention lift if invited members become future move owners.

## Data moat opportunity

- Consented, coarse signals: invite accepted, task assigned, task completed by role, blocker category, household size bucket, transition outcome.
- Do not store or use names, emails, phone numbers, raw addresses, account numbers, or private notes as moat signals.

## Hypotheses

- Hypothesis: household invites convert better when attached to an assigned task than when shown as a generic collaboration feature.
- Hypothesis: shared accountability increases move-task completion and reduces forgotten provider transitions.
- Hypothesis: household collaboration is a better growth loop than SEO until the core value loop is validated.

## Recommended experiments

1. Household invite prompt at the first assignment-worthy task.
2. Household mission-control summary over existing workspace members, pending invitations, assigned tasks, and blocked tasks.
3. Family upgrade teaser when a user tries to invite beyond free/individual limits.

## Possible Codex implementation tasks

- Draft a docs-only household mission-control spec linked to [[product/FEATURE_BACKLOG]].
- Map existing invitation, workspace member, task assignment, and plan entitlement surfaces before proposing source changes.
- Create a privacy-safe household event taxonomy for invite sent, invite accepted, task assigned, and task resolved.
