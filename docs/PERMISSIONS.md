# LocateFlow — Permission Matrix & Plan Features

## Subscription Plans

| Feature | FREE_TRIAL (7 days) | INDIVIDUAL |
|---------|---------------------|------------|
| Max Addresses | 2 | 10 |
| Max Services | 10 | 100 |
| QR Box Tracking | ❌ | ✅ |
| Moving Checklist | Basic | Full |

## Moving Plan State Machine

```
PLANNING ──→ IN_PROGRESS ──→ COMPLETED
    │              │
    └──→ CANCELED ←┘
```

### Valid Transitions
- `PLANNING` → `IN_PROGRESS` (start the move)
- `PLANNING` → `CANCELED` (cancel before starting)
- `IN_PROGRESS` → `COMPLETED` (move finished)
- `IN_PROGRESS` → `CANCELED` (cancel during move)

### Terminal States (no transitions out)
- `COMPLETED`
- `CANCELED`

## API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Services (create) | 30 req | 60 sec |
| Addresses (create) | 20 req | 60 sec |
| Moving Plans (create) | 10 req | 60 sec |
| Admin Login | 5 attempts | 15 min (30 min lockout) |

## Soft Delete Policy

The following entities support soft delete (set `deletedAt` timestamp instead of hard delete):
- **Address**
- **Service**
- **MovingPlan**

Soft-deleted records are excluded from all list queries via `deletedAt: null` filter.

## Data Retention

| Data Type | Retention Period |
|-----------|-----------------|
| User Sessions | 90 days |
| User Events | 90 days |
| Rate Limit Logs | 30 days |
| Email Logs | 180 days |
| Audit Logs | Permanent |
| Admin Audit Logs | Permanent |
