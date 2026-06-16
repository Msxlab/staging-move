# Current verified product capability

- Verified current capabilities include addresses, moving plans, move tasks, services, budgets, notifications, exports, workspaces, mobile deep-link support, and provider-related flows.
- The system has enough move-state primitives to represent a timeline, but the memory does not verify a dedicated Address Timeline product surface.
- Existing notification and export capabilities could support timeline reminders and records, subject to future implementation review.
- No verified evidence shows customer demand for timeline visualization or address history retention.

# Hypotheses

- Hypothesis: Address Timeline is the core Move Memory artifact: a durable chronological record of where the household lived, what changed, and what proof exists.
- Hypothesis: a timeline reduces anxiety by turning the move into dated commitments, deadlines, confirmations, and evidence.
- Hypothesis: Address Timeline can extend beyond a single move into recurring Address Life OS value for future moves, insurance, taxes, schools, and household admin.
- Hypothesis: timeline completeness can become a key activation metric.

# Recommended next decisions

- Decide the canonical event types: address added, move date set, provider selected, provider updated, task completed, export generated, document uploaded, risk resolved, subscription changed.
- Decide whether timeline entries are user-created, system-created, or both.
- Define privacy rules for household members, children/read-only members, and shared exports.
- Decide which timeline entries can become proof artifacts and which are only internal reminders.

# Open questions for Claude Product Review

- Which address timeline events are already derivable from current models?
- What legal or privacy concerns arise from retaining address history and proof packets?
- What event granularity is useful to customers without becoming noisy?
- How should timeline value differ for renters, homeowners, and relocation partners?

# Possible Codex implementation tasks

- Draft an Address Timeline event taxonomy and retention policy.
- Map existing routes/models to proposed timeline events.
- Create a UI information architecture proposal for timeline, upcoming, blocked, and proof views.
- Propose tests for timeline permission rules, export redaction, and household visibility.
