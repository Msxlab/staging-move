# Current verified product capability

- Verified current capabilities include user services, provider catalog flows, saved/compared/recommended providers, provider feedback, partner consents, connector dispatch, provider admin governance, and exports.
- Admin surfaces include provider management, connector control, logo governance, coverage, movers, sponsored placements, and acquisition campaigns according to the technical memory.
- The Claude Product Strategy Council reports source-verified `MoveTask` fields for transition classification: action type, status lifecycle, origin/destination provider and address links, assignee, reason, caveats, and confidence.
- Billing, workspace, assignment, provider recommendation, and export foundations support a premium provider-transition workflow.
- Current technical memory verifies guarded connector mechanics, but does not verify live provider partnerships, live carrier integrations, or successful provider account changes.

# Hypotheses

- Hypothesis: Provider Transition Workspace can become the operational core of the Move Command Center by showing every provider to keep, cancel, switch, transfer, or update.
- Hypothesis: customers will pay for confidence that utilities, internet, insurance, subscriptions, mail, government records, and local services have been handled.
- Hypothesis: partner/provider revenue may emerge from verified transition intent, but no partner claims should be made until agreements are verified.
- Hypothesis: the strongest short-term version is a guided workspace with statuses and proof, not fully automated provider account changes.

# Recommended next decisions

- Accepted MVP: surface the existing `MoveTask` classifier as a Provider Transition board.
- Week-1 slice: read-only board grouping existing `MoveTask` rows by action-type lane with status badges and progress rollup.
- Use lanes derived from action type: Keep, Cancel, Switch, Transfer, Update, and Needs-decision.
- Link switch/find-replacement cards into existing recommendations and provider comparison surfaces.
- Hard copy guardrail: say "guided - you take the action"; do not say auto-sync, verified sync, marketplace, partner offer, or account change.
- No connector/provider account-change calls in v1.
- Family/Pro can later emphasize household assignment and proof export; Pro can later emphasize bulk/proof PDF through existing dossier/export capabilities.

# First MVP spec

- Goal: the move-owner opens one board and sees provider/service transition work organized by lane, status, assignee, and progress.
- Inputs: existing `MoveTask`, `Service`, `ServiceProvider`, saved/compared provider, workspace, membership, and assignment data.
- Board cards show provider, action, status badge, assignee when present, reason/caveat/confidence where safe, and deep-link actions.
- Read-only v1 uses existing data and avoids new mutations beyond what already exists.
- Permission rules must mirror existing workspace visibility: VIEW_ONLY cannot mutate, CHILD sees only allowed/self-scoped work, assignments validate membership.
- Progress rollup should report handled vs total using existing task status.
- Proof v1 is limited to existing notes/export/dossier posture; a dedicated proof attachment/document vault is deferred.

# Open questions for Claude Product Review

- Which board lanes and status labels are clearest without implying automation?
- What is the first safe proof artifact: confirmation note, dossier snapshot, PDF export, or all three?
- What compliance or customer-support risks arise from tracking provider statuses and proof artifacts?
- What support-ticket guardrail should catch "I thought LocateFlow cancelled it for me" confusion?

# Possible Codex implementation tasks

- Build a read-only Provider Transition board over existing `MoveTask` rows.
- Add tests for action-type-to-lane mapping, status badge rendering, workspace scoping, membership visibility, and empty state.
- Add progress rollup and recommendation deep-links for switch/find-replacement tasks.
- Draft copy checks that prohibit autonomous-provider-action language.
