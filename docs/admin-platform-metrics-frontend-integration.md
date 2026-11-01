# Admin platform metrics — frontend integration

The platform overview (platform-admin panel) uses `GET /api/v1/admin/metrics` for its six overview cards. Send a bearer token with `platform.reports.read`. Community membership is not required. The endpoint is available in the API runtime, not the worker runtime.

Review evidence: 2026-10-26 — Admin Platform Metrics.

## Request

No request body is needed. Optional `createdFrom` and `createdTo` query parameters accept ISO date-time timestamps with a timezone, for example `2026-10-01T00:00:00Z`. Both bounds are inclusive. Either can be supplied independently; omitting both returns all-time counts of current statuses.

```
GET /api/v1/admin/metrics?createdFrom=2026-10-01T00:00:00Z&createdTo=2026-10-26T00:00:00Z
Authorization: Bearer <access-token>
```

These are current-state counts filtered by record creation time, not historical snapshots. For example, an expired link created within the range counts as expired even if it expired later. For a calendar-day selection, the frontend must convert the intended timezone and day boundaries into timestamps.

## Response

HTTP 200 uses the existing `ApiResponse` wrapper:

```json
{
  "success": true,
  "message": "success",
  "data": {
    "communities": 10,
    "users": 60,
    "paymentLinks": { "total": 6, "active": 2, "expired": 4 },
    "transactions": 18,
    "obligations": { "total": 16, "due": 6, "paid": 5, "overdue": 3, "waived": 2 },
    "kycInReview": 0
  },
  "description": null,
  "status": "OK"
}
```

Every counter is an integer backed by Java `long`. Empty results return zero, with the same nested objects present.

## Counting rules

- `communities`: All statuses except `DELETING` and `DELETED`
- `users`: Accounts with platform role `USER`, excluding `PENDING_DELETION` and `DELETED`
- `paymentLinks.total`: All statuses, including draft, paused, archived, and activation states
- `paymentLinks.active`: Stored status `ACTIVE`
- `paymentLinks.expired`: Stored status `EXPIRED`
- `transactions`: All statuses, including unsuccessful and pending transactions
- `obligations.total`: Sum of the four displayed obligation subcounts
- `obligations.due/paid/overdue/waived`: Matching `DUE`, `PAID`, `OVERDUE`, or `WAIVED` status
- `kycInReview`: Eligible `USER` accounts whose current profile KYC status is `IN_REVIEW`

User counts exclude all platform staff roles and accounts without a platform role. Community owners/admins whose platform role is `USER` remain eligible. Other obligation statuses, including `PARTIAL`, are excluded from this endpoint's obligation total; their existing behavior elsewhere is unchanged. Payment-link total may exceed active plus expired.

Dates use each record's `createdAt`, except KYC, which uses the creation time of the current attempt referenced by `userProfile.kycVerificationId`. That attempt must belong to the counted user. With either date bound, a missing, dangling, or foreign attempt link excludes the user. With neither bound, an eligible `IN_REVIEW` user counts even without a valid linked attempt. Historical attempts do not add to the count, and attempt status does not replace the profile's current KYC status condition.

Financial counts retain records belonging to deleting/deleted communities. User/community deletion exclusions apply to their own totals and to eligible KYC users, not to historical financial records.

Counts run directly against the database on every request without caching. Separate count queries do not promise a single historical snapshot during concurrent writes.

## Errors and frontend actions

- HTTP 400: malformed timestamps or `createdFrom` later than `createdTo`. Equal bounds are valid. Reversed ranges use the existing error envelope, with `description` set to `createdFrom must not be after createdTo` and `status` set to `BAD_REQUEST`.
- HTTP 401: missing or invalid authentication under existing security handling.
- HTTP 403: the authenticated caller lacks `platform.reports.read`.
- Database failures follow existing global error handling; they are not converted into zero counts or partial success.

Fetch once to populate the six overview cards and fetch again on Refresh or date-range changes. Use the payment-link and obligation subcounts directly. The endpoint is synchronous, with no new SSE event or polling contract.

This is an additive endpoint. No existing endpoint changes, new permission, migration, configuration variable, or dependency is required. Existing grants of `platform.reports.read` control access.
