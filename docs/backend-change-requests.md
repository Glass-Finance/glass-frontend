# Backend change requests

Requests the frontend is blocked on. Each entry states what is missing on the
backend, what the frontend currently does instead, and what becomes possible
once the change ships.

**Status: nothing here has been implemented.** `glass-backend` is owned by the
backend team; the frontend works around each gap rather than editing it. Remove
an entry once the contract lands.

---

## CR-1 — Serialize the user lifecycle status in `UserDto`

**Blocks:** accurate status badges, the "Anonymized" state, and hiding
anonymized users from the platform-admin user list.

### The gap

`auth.users` carries the lifecycle in three columns added by
`V57__community_delete_and_user_deletion.sql`:

| column                  | values                                      |
| ----------------------- | ------------------------------------------- |
| `status`                | `ACTIVE` \| `PENDING_DELETION` \| `DELETED` |
| `deletion_requested_at` | timestamp of the mark-for-deletion request  |
| `anonymized_at`         | set when the anonymization job runs         |

`UserMapper.toUserDto()` (`service/user/UserMapper.java:32-78`) maps 22 fields
and **none of these three**. `UserDto` (`model/dto/UserDto.java`) has no such
fields either. So every `UserDto` the API returns is silent about whether the
account is pending deletion or already anonymized.

`accountNonLocked` _is_ mapped, and that is what suspension uses — CR-1 is only
about the deletion/anonymization half of the lifecycle.

### What the frontend does today

`userStatus()` in `src/pages/dashboard/platform-admin/shared.js` derives a
badge from `status`, `anonymizedAt` and `accountNonLocked`, falling back to
`enabled === false` for pending deletion. That fallback is sound **today**
because the only `setEnabled(false)` in the backend is the deletion flow
(`UserDeletionServiceImpl`, mark-for-deletion and self-service delete) —
registration and email verification only ever set it `true`.

It leaves two things wrong until `status` ships:

1. An anonymized account also has `enabled = false`, so it renders as
   **"Pending Deletion"** instead of **"Anonymized"**.
2. Pending-deletion and anonymized rows are indistinguishable, so anonymized
   users **cannot be removed from the list**. This was a requested feature and
   is blocked here, not in the frontend.

### Requested change

Add to `UserDto` and populate in `toUserDto()`:

```java
private String status;              // UserStatus.name(): ACTIVE | PENDING_DELETION | DELETED
private Instant deletionRequestedAt; // user.getDeletionRequestedAt()
private Instant anonymizedAt;        // user.getAnonymizedAt()
```

`anonymizedAt` is already used inside `toUserDto()` (lines 57 and 66) to gate
the KYC profile, so the column and getter exist — it is only missing from the
response object.

Once this ships the frontend needs **no further change**: the `status` branch in
`userStatus()` already takes precedence over the `enabled` fallback, and the
"Pending Deletion" label, the contextual **Restore** button and the
`Anonymize…` gating all key off it already.

### Verification

`GET /api/v1/admin/users` on a user with `status = PENDING_DELETION` should
return `"status": "PENDING_DELETION"` and a non-null `deletionRequestedAt`.

---

## CR-2 — Filter users by `accountNonLocked`

**Blocks:** reinstating the "Suspended" filter tab in the platform-admin user
list.

### The gap

`AdminUserQueryDto` (`model/dto/AdminUserQueryDto.java`) filters on `enabled`,
`emailVerified`, `platformRole` and the date ranges. It has **no**
`accountNonLocked` field, so "show me suspended users" cannot be expressed as a
query.

### What the frontend does today

The tab was removed. It used to send `{ enabled: false }`, which is the
**deletion** flag — so a tab labelled "Suspended" returned accounts pending
deletion and returned **no suspended users at all**. Removing it was better than
leaving a filter that answers a different question.

The same mismatch makes the remaining "Active" tab approximate: it sends
`enabled: true`, which also includes suspended accounts (suspension never
touches `enabled`). Each row's badge is accurate, so those rows read correctly
inside the tab.

### Requested change

```java
private Boolean accountNonLocked; // null = no filter
```

Honouring it in the admin user repository query is enough; the frontend will
send `accountNonLocked: false` for a "Suspended" tab and `true` for "Active".

### Verification

`GET /api/v1/admin/users?accountNonLocked=false` should return only users whose
`accountNonLocked` is `false`.

---

## Not requested

- **An `enabled`-only filter is not the same as suspension.** Do not "fix" the
  deleted Suspended tab by re-adding `{ enabled: false }` — see CR-2.
- **A fifth "Inactive" state.** The lifecycle is exactly four: Active,
  Suspended, Pending Deletion, Anonymized. An `INACTIVE` badge colour remains in
  `STATUS_COLORS` for other sections but no user state maps to it.
