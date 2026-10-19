import client from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY RECORD BOOK — visible records (manual, imported, platform)
// ─────────────────────────────────────────────────────────────────────────────
//
// Shapes verified against the live backend OpenAPI (api.glasspay.app/v3/api-docs)
// and the backend's own integration guide, docs/new/community-record-book-
// frontend-api.md in glass-backend.
//
// The record book records historical activity. Creating or importing an entry
// does NOT move money and does NOT touch a wallet balance — which is the one
// thing this API is easy to misread as.
//
// Paths are spelled out inline rather than composed through a helper, for the
// same reason as src/api/groups.js: scripts/endpoint-audit.mjs extracts call
// paths with a regex that only matches a template literal sitting directly in
// the call, so an indirection makes these routes look like frontend calls to
// routes that don't exist. `npm run audit:endpoints` is the only check that
// catches that class of bug, so keep these inline.
//
// `{communityIdentifier}` accepts a slug or an id, same as the rest of the
// community APIs, so callers pass whatever useActiveCommunityId() resolved.
//
// Amounts are JSON decimals in MAJOR currency units (1250.50), not minor
// units. The list sort key is `amountMinor` while the returned value stays
// major-unit — do not divide, and do not do float arithmetic on the way to a
// displayed total.

// GET /api/v1/communities/{communityIdentifier}/records
// query: CommunityRecordQueryDto — source, type, direction, memberId, currency,
// occurredOnFrom, occurredOnTo (inclusive bounds), importJobId, search,
// pageNumber, pageSize, sortBy, dir.
// sortBy is an endpoint allowlist (createdAt | occurredOn | amountMinor | id) and
// an unsupported value fails 400 rather than falling back, so never interpolate
// a user-controlled string into it. Search is a normalized literal substring —
// %, _ and ! are literal characters, NOT wildcards, and need no client escaping.
export const getCommunityRecords = (communityId, params = {}) =>
  client.get(`/communities/${communityId}/records`, { params });

// GET /api/v1/communities/{communityIdentifier}/records/{recordId}
export const getCommunityRecord = (communityId, recordId) =>
  client.get(`/communities/${communityId}/records/${recordId}`);

// POST /api/v1/communities/{communityIdentifier}/records
// CreateCommunityRecordRequest — recordType, direction, occurredOn, amount and
// currency are required for a valid record; occurredOn cannot be in the future.
// Resolves 201 with the created CommunityRecord.
//
// duplicateAccepted is explicit duplicate consent, not a validation bypass.
// A previously committed same-community duplicate answers 409 unless it is
// sent true — ask the user before resending it.
export const createCommunityRecord = (communityId, payload) =>
  client.post(`/communities/${communityId}/records`, payload);

// PATCH /api/v1/communities/{communityIdentifier}/records/{recordId}
// Omitted fields are preserved; an explicit null CLEARS that field. `{}` clears
// nothing. Editing a financial or descriptive field can reset duplicate
// consent, which then has to be re-accepted deliberately.
//
// Do not send expectedVersion, source, provenance, issues or status — they are
// not editable and PLATFORM records reject the write outright.
export const updateCommunityRecord = (communityId, recordId, payload) =>
  client.patch(`/communities/${communityId}/records/${recordId}`, payload);

// DELETE /api/v1/communities/{communityIdentifier}/records/{recordId}
// Returns ApiResponse<String> ("Community record deleted"), 200 — not 204.
export const deleteCommunityRecord = (communityId, recordId) =>
  client.delete(`/communities/${communityId}/records/${recordId}`);

// GET /api/v1/admin/communities/{communityIdentifier}/records
// Platform-admin read-only mirror. Requires platform.recordbook.read and does
// NOT require community membership — a platform admin who is not a member of
// this community still gets the data.
export const getAdminCommunityRecords = (communityId, params = {}) =>
  client.get(`/admin/communities/${communityId}/records`, { params });

// GET /api/v1/admin/communities/{communityIdentifier}/records/{recordId}
export const getAdminCommunityRecord = (communityId, recordId) =>
  client.get(`/admin/communities/${communityId}/records/${recordId}`);
