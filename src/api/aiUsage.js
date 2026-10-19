import client from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED AI USAGE — per-community quotas + platform administration
// ─────────────────────────────────────────────────────────────────────────────
//
// Shapes verified against the live backend OpenAPI (api.glasspay.app/v3/api-docs)
// and the backend's own integration guide, docs/new/community-record-book-
// frontend-api.md in glass-backend.
//
// The frontend never calls an AI provider. Mapping, repair, row assistance and
// an eligible retry all share the IMPORT JOB's uuid as one operation, so a
// rerun creates another operation. Consumption is durable: an uncertain
// provider dispatch can still have counted.
//
// Two display traps, both in utils/recordBook.js:
//   • UNLIMITED returns null allowance and null remaining — render "Unlimited",
//     never 0.
//   • totalInputTokens / totalOutputTokens are nullable and "can be unknown".
//     They must not be rendered as 0; absence of data is not zero usage.
//
// Paths stay inline for the endpoint audit; see src/api/groups.js.

// GET /api/v1/communities/{communityIdentifier}/ai/usage
// query: feature, mode, pageNumber, pageSize, sortBy (feature | mode | id), dir.
export const getCommunityAiUsage = (communityId, params = {}) =>
  client.get(`/communities/${communityId}/ai/usage`, { params });

// GET /api/v1/communities/{communityIdentifier}/ai/usage/{feature}
// feature is currently RECORD_IMPORT only. Path segment, not a query param.
export const getCommunityAiUsageByFeature = (communityId, feature) =>
  client.get(`/communities/${communityId}/ai/usage/${feature}`);

// GET /api/v1/admin/communities/{communityIdentifier}/ai/policies/{feature}
// Platform admin. Requires platform.ai.usage.read and does NOT require
// community membership.
export const getAdminAiPolicy = (communityId, feature) =>
  client.get(`/admin/communities/${communityId}/ai/policies/${feature}`);

// PUT /api/v1/admin/communities/{communityIdentifier}/ai/policies/{feature}
// Requires platform.ai.policy.manage. Every field in the body is required:
// { mode, periodType, allowanceUnits }.
export const updateAdminAiPolicy = (communityId, feature, payload) =>
  client.put(`/admin/communities/${communityId}/ai/policies/${feature}`, payload);

// GET /api/v1/admin/communities/{communityIdentifier}/ai/usage/{feature}/periods
// query: periodType, periodStartsFrom, periodStartsTo, pageNumber, pageSize.
// These bounds are inclusive on BOTH ends (unlike the import job's createdTo)
// and are UTC instants.
export const getAdminAiPeriods = (communityId, feature, params = {}) =>
  client.get(`/admin/communities/${communityId}/ai/usage/${feature}/periods`, { params });

// GET /api/v1/admin/communities/{communityIdentifier}/ai/usage/{feature}/operations
// query: periodId, state, provider, model, createdFrom, createdTo, pageNumber,
// pageSize. Inclusive date bounds.
export const getAdminAiOperations = (communityId, feature, params = {}) =>
  client.get(`/admin/communities/${communityId}/ai/usage/${feature}/operations`, { params });

// GET /api/v1/admin/communities/{communityIdentifier}/ai/usage/{feature}/adjustments
// query: periodId, actorId, createdFrom, createdTo, pageNumber, pageSize.
export const getAdminAiAdjustments = (communityId, feature, params = {}) =>
  client.get(`/admin/communities/${communityId}/ai/usage/${feature}/adjustments`, { params });

// POST /api/v1/admin/communities/{communityIdentifier}/ai/usage/{feature}/adjustments
// Requires platform.ai.usage.adjust. { deltaUnits, reason } — deltaUnits is a
// nonzero signed integer and reason is required (max 2000 chars). Targets the
// current period.
//
// Adjustments are APPEND-ONLY. To correct one, post a compensating entry of the
// opposite sign; there is no edit or delete, so never build a UI that implies
// either.
export const createAdminAiAdjustment = (communityId, feature, payload) =>
  client.post(`/admin/communities/${communityId}/ai/usage/${feature}/adjustments`, payload);
