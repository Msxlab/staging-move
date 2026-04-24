# Move Task And Custom Provider Security Review

This review covers the current-product task tracking and user-created provider layer. It does not approve connectors, external account updates, account linking, official provider labels, or automatic address-change execution.

## Controls In Code

- User move tasks are queried by `userId` and `deletedAt: null`.
- Move task mutation requires the authenticated user to own the task.
- Task completion verifies referenced services and destination addresses belong to the same user before applying local effects.
- Custom provider list/detail/update/delete routes are scoped by `userId`.
- Custom provider create/update input is validated and simple HTML angle brackets are stripped from free-text fields.
- Custom provider creation and move task mutations are rate limited.
- Custom providers are private by default and carry `USER_CUSTOM` trust status.
- Admin provider governance actions require provider permissions and write admin audit logs.
- Task lifecycle and custom-provider changes write user audit/event records where repo-native.

## Local Effects Boundary

Completing a move task can update LocateFlow records only. It can mark local services inactive, create/link destination services, or record local completion metadata.

It must not:

- Update an external provider account.
- Submit a provider address change.
- Start, stop, cancel, or transfer external service.
- Mark provider data as source verified.

## Privacy Rules

- One user's custom providers must never be returned to another user.
- Admin list views should avoid exposing unnecessary user PII.
- Admin detail views may show custom-provider context for support and governance.
- User-entered notes/contact fields must not be logged beyond intended audit/support contexts.

## Remaining Review Items

- Add integration tests with mocked Prisma for custom-provider ownership and task local effects.
- Add UI-level tests for the local-only completion confirmation.
- Add abuse monitoring for repeated custom-provider creation once production telemetry exists.
- Decide whether custom-provider deletion should be blocked when attached to active services, or remain soft-delete with existing service context preserved.
