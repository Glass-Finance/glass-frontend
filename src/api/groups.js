import client from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// MEMBER GROUPS — community-scoped CRUD + membership
// ─────────────────────────────────────────────────────────────────────────────
//
// Shapes verified against the live backend OpenAPI (api.glasspay.app/v3/api-docs).
// Every route here is already deployed. Before this module the frontend called
// none of them, which is why PaymentAudience.GROUP was absent from the payments
// audience options: a GROUP-audience payment link needs groupIds, and there was
// no way to create or repair one. GROUP is offered now that the groups
// endpoints it depends on exist — see the note on AUDIENCE_OPTIONS in
// pages/dashboard/payments/constants.js before changing either side.
//
// `{communityIdentifier}` accepts a slug or an id, same as the rest of the
// community APIs, so callers pass whatever useActiveCommunityId() resolved.
//
// Paths are spelled out inline rather than composed through a helper on
// purpose: scripts/endpoint-audit.mjs extracts call paths with a regex that only
// matches a template literal sitting directly in the call, so a `groupsPath(id)`
// indirection makes all ten routes look like frontend calls to routes that
// don't exist. `npm run audit:endpoints` is the only check that catches that
// class of bug, so keep these inline.

// GET /api/v1/communities/{communityIdentifier}/groups
// query: CommunityMemberGroupQueryDto { search, pageNumber, pageSize, sortBy, dir, status }
// Returns the paginated envelope { content, pageNumber, pageSize, totalElements,
// totalPages, last }. The OpenAPI marks the `query` parameter required, but so
// does it on /communities/me, which the app already calls with an empty object
// — it's an annotation artifact, not a reason to always send a populated DTO.
export const getCommunityGroups = (communityId, params = {}) =>
  client.get(`/communities/${communityId}/groups`, { params });

// POST /api/v1/communities/{communityIdentifier}/groups
// CreateCommunityMemberGroupRequest — only `name` is required.
export const createCommunityGroup = (communityId, payload) =>
  client.post(`/communities/${communityId}/groups`, payload);

// GET /api/v1/communities/{communityIdentifier}/groups/{groupId}
export const getCommunityGroup = (communityId, groupId) =>
  client.get(`/communities/${communityId}/groups/${groupId}`);

// PATCH /api/v1/communities/{communityIdentifier}/groups/{groupId}
// UpdateCommunityMemberGroupRequest — nothing required, so a partial patch is legal.
export const updateCommunityGroup = (communityId, groupId, payload) =>
  client.patch(`/communities/${communityId}/groups/${groupId}`, payload);

// DELETE /api/v1/communities/{communityIdentifier}/groups/{groupId}
export const deleteCommunityGroup = (communityId, groupId) =>
  client.delete(`/communities/${communityId}/groups/${groupId}`);

// ─── Lifecycle ────────────────────────────────────────────────────────────────
// Archive / unarchive are PATCH state transitions on the same resource (the
// same shape the payment-link lifecycle uses), NOT a separate resource and NOT
// a delete — an archived group keeps its membership and can be brought back.

export const archiveCommunityGroup = (communityId, groupId) =>
  client.patch(`/communities/${communityId}/groups/${groupId}/archive`);

export const unarchiveCommunityGroup = (communityId, groupId) =>
  client.patch(`/communities/${communityId}/groups/${groupId}/unarchive`);

// ─── Membership ───────────────────────────────────────────────────────────────

// GET /api/v1/communities/{communityIdentifier}/groups/{groupId}/members
// Same paginated envelope as the group list.
export const getCommunityGroupMembers = (communityId, groupId, params = {}) =>
  client.get(`/communities/${communityId}/groups/${groupId}/members`, { params });

// POST + DELETE .../groups/{groupId}/members
// Both take the IDENTICAL body — AddGroupMembersRequest { memberIds }. Removal
// is by id in the body, not by a path segment, so it has to go in `data`:
// an axios DELETE without one sends no payload and the backend has nothing to
// match on.
export const addCommunityGroupMembers = (communityId, groupId, memberIds) =>
  client.post(`/communities/${communityId}/groups/${groupId}/members`, { memberIds });

export const removeCommunityGroupMembers = (communityId, groupId, memberIds) =>
  client.delete(`/communities/${communityId}/groups/${groupId}/members`, { data: { memberIds } });
