# Move Task And Provider Feedback Loop

This feedback loop is current-product telemetry for support, safety, and deterministic recommendation tuning. It does not add ML, external provider automation, connectors, account linking, partner APIs, or verified provider claims.

## Events Recorded Today

Server-side events are recorded in `UserEvent` when available:

- `MOVE_TASK_GENERATED`
- `MOVE_TASK_ACCEPT`
- `MOVE_TASK_START`
- `MOVE_TASK_COMPLETE`
- `MOVE_TASK_DISMISS`
- `MOVE_TASK_REOPEN`
- `CUSTOM_PROVIDER_CREATED`

Each event is local product telemetry. It should be interpreted as user interaction with LocateFlow guidance, not proof that an external provider action happened.

## Event Meaning

- Move task lifecycle events mean the user changed a LocateFlow task status.
- Completing a task means the local task is complete and any approved local service effect may have been applied.
- Custom provider creation means the user created a private provider record.
- Provider selection from a task means the user chose a local/listed/custom provider inside LocateFlow.

None of these events mean:

- Provider availability was source verified.
- A provider account was updated.
- Service was externally started, stopped, cancelled, or transferred.
- LocateFlow has an official provider relationship.

## Future Event Plan

If the existing analytics path remains sufficient, add the following only as product-safe telemetry:

- `PROVIDER_RECOMMENDATION_VIEWED`
- `PROVIDER_SELECTED`
- `PROVIDER_MARKED_UNAVAILABLE`
- `USER_CORRECTED_PROVIDER`
- `CUSTOM_PROVIDER_LINKED_TO_SERVICE`
- `ADMIN_REVIEWED_PROVIDER_ISSUE`
- `SUPPORT_TICKET_OPENED_FROM_MOVE_TASK`

## No ML Yet

Do not train or claim ML ranking until there is labeled outcome data such as:

- Provider served the destination address.
- User started service successfully.
- User rejected the recommendation as irrelevant.
- User reported stale contact information.
- Support confirmed a provider mismatch.

Until then, keep recommendations deterministic, explainable, and caveated.
