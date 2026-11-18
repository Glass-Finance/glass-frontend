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

## Remaining changes

1. **Stop requesting optional payment-link metrics.** Remove `includeMetrics` from
   `src/hooks/usePaymentPlans.js` and
   `src/pages/dashboard/platform-admin/PaymentLinksSection.jsx`, and update their
   comments/tests. Admin lists now always include each link's `metrics`. Keep
   payer-facing `/payment-links` separate: it does not expose admin metrics.

2. **Restrict admin obligation-list filters.** In
   `src/pages/dashboard/platform-admin/ObligationsSection.jsx`, allow only DUE,
   OVERDUE, PAID, WAIVED and CANCELLED, plus the unfiltered option. Remove PENDING,
   PARTIAL, FAILED and REFUNDED from list filters and clear unsupported saved filter
   values wherever present. Apply the same list contract to any community finance
   obligation filter. Do not globally remove lifecycle statuses: personal lists,
   single-obligation views, exports and payment-link member summaries are unaffected.

3. **Handle asynchronous expiry/exemption cancellation.** Refresh affected links,
   obligations and member list/detail stats after expiry or a billing-exemption
   change. A successful PATCH confirms the action, not cancellation completion.
   Add bounded refresh behavior where the UI currently assumes immediate completion;
   preserve PAID/WAIVED history and let the backend determine the cancellation scope.
   Reversing exemption must not imply that cancelled cycles regenerate.

4. **Distinguish captured money from fulfilled payments.** Audit
   `src/pages/memberApp/PaymentSuccess.jsx`, payment callbacks, background
   verification and transaction displays. They currently interpret success from
   transaction status without checking `paymentSucceededButValidationFailed`.
   Such transactions can remain SUCCESSFUL while the obligation stays unsettled.
   Preserve the validation-failure flag and `refundStatus` through shaping; show the
   refund/manual-resolution outcome and avoid optimistic settlement or a fulfilled
   payment message. Refund acceptance does not mean completion or a full refund.

5. **Align payable-obligation checks with DUE/OVERDUE.** Audit payment entry points
   and local status helpers for PARTIAL being offered as payable. The backend now
   accepts only DUE/OVERDUE for initialization. Do not change waiver or due-date
   extension eligibility, which still includes PARTIAL. Pricing validation belongs
   to the backend: do not assume configured fixed pricing is reduced by prior paid
   amounts, and surface server validation/refund outcomes.

6. **Preserve the server-defaulted start date.** `shapePlan` in
   `src/hooks/usePaymentPlans.js` currently drops root-level `startAt`, although
   `EditPlanModal.jsx` reads it. Retain the returned date so a create without
   `startAt` subsequently edits/displays the server's UTC default rather than an
   empty or invented date.

## Separate member-statistics change

The member-statistics work is on `fix/member-payment-statistics`. Integrate that
branch as a separate change: list/detail `stats`, paid/total obligation-plan counts,
explicit `0/0 Paid`, unavailable missing stats, and member-cache refresh behavior.
The deletion work does not replace that change.

No new auth flow, request flag or permission is required by the remaining changes.
The DELETE operation uses the existing delete permission. Existing session handling
and unrelated event checkout contracts stay governed by their current guides.
