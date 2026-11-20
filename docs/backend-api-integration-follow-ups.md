# Backend API integration follow-ups

Source: [2026-11-17 — Consolidated API Changes](https://app.notion.com/p/41c9a22eb2a981ed86a2e6b149fe6de8).
Reviewed against the frontend on 2026-11-18. This is a work list, not a claim that
the remaining behavior has been implemented or verified against live payments.

## Payment-plan deletion

Implemented in this change:

- Replace Archive with confirmed, draft-only Delete using
  `DELETE /communities/{communityIdentifier}/payment-links/{paymentLinkIdentifier}`.
- Require `community.payment_links.delete` for the menu action; the backend remains
  authoritative for permissions, status and financial-history eligibility.
- Keep rejection messages in the dialog and refresh stale plans after HTTP 409.
- Refresh payment-link and member-statistics caches after successful mutations.
- Replace payment-link ARCHIVED with DELETED in plan badges, dashboard visibility,
  platform-admin filters and endpoint auditing. Group and notification ARCHIVED
  statuses, and historical activity names, are separate contracts.

## Approved follow-up changes

- Removed `includeMetrics` from community-admin and platform-admin payment-link
  list requests. Both lists read the metrics returned automatically by the API.
- Restricted platform-admin obligation-list filters to DUE, OVERDUE, PAID, WAIVED
  and CANCELLED, plus the unfiltered option. This screen keeps its filter in local
  component state, so there are no persisted filter values to migrate. Other
  lifecycle status catalogs, personal lists and exports remain unchanged.
- Added a single refresh of existing billing queries after a successful expiry or
  billing-exemption response, covering community metrics, plan lists, obligations,
  member list/detail statistics and personal membership/payment views. Failed
  mutations do not trigger this refresh. There is no new polling: asynchronous
  cancellation may still be in progress when the refreshed data arrives.

## Scope decisions

Confirmed by the user on 2026-11-18:

- Leave payment-success handling, including its current treatment of
  `paymentSucceededButValidationFailed`, unchanged in this task.
- Leave payment initialization and payable-status interpretation unchanged; the
  backend response determines whether the payment can proceed.
- No start-date change is requested. One-off creation already supports omitting
  `startAt`, with the backend defaulting it to the current server date/time. The
  response does include the date. The previous follow-up list overstated this as
  required work.

## Member statistics and obligation-backed plans

The combined work is on `fix/community-payment-plans`, based on the latest `dev`.
Member list/detail statistics use server aggregates, with paid/total obligation-plan
counts, explicit `0/0 Paid`, unavailable missing stats, and member-cache refreshes.
The member-detail All Plans tab uses only member-targeted payment links. Personal
upcoming payments and amounts owed use only the member's obligations.

No new auth flow, request flag or permission is required by these follow-ups.
The DELETE operation uses the existing delete permission. Existing session handling
and unrelated event checkout contracts stay governed by their current guides.
