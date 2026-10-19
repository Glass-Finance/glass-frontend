import client from "./client";

export const getCommunityAiUsage = (id, params = {}) =>
  client.get(`/communities/${id}/ai/usage`, { params });
// Keep the feature as a path parameter so the endpoint audit can match the
// backend's {feature} route; this consumer requests only RECORD_IMPORT.
export const getRecordImportUsage = (id, feature = "RECORD_IMPORT") =>
  client.get(`/communities/${id}/ai/usage/${feature}`);

// Platform administration of a community's AI policy and usage.
//
// These require platform.ai.usage.read / platform.ai.policy.manage /
// platform.ai.usage.adjust and do NOT require community membership. Carried
// over from the earlier record-book contracts so the routes stay visible to
// `npm run audit:endpoints`; no admin screen consumes them yet.
//
// Adjustments are APPEND-ONLY: to correct one, post a compensating entry of
// the opposite sign. There is no update or delete route, so nothing here
// should ever be built to imply one.
export const getAdminAiPolicy = (id, feature = "RECORD_IMPORT") =>
  client.get(`/admin/communities/${id}/ai/policies/${feature}`);
export const updateAdminAiPolicy = (id, feature, payload) =>
  client.put(`/admin/communities/${id}/ai/policies/${feature}`, payload);
export const getAdminAiPeriods = (id, feature = "RECORD_IMPORT", params = {}) =>
  client.get(`/admin/communities/${id}/ai/usage/${feature}/periods`, { params });
export const getAdminAiOperations = (id, feature = "RECORD_IMPORT", params = {}) =>
  client.get(`/admin/communities/${id}/ai/usage/${feature}/operations`, { params });
export const getAdminAiAdjustments = (id, feature = "RECORD_IMPORT", params = {}) =>
  client.get(`/admin/communities/${id}/ai/usage/${feature}/adjustments`, { params });
export const createAdminAiAdjustment = (id, feature, payload) =>
  client.post(`/admin/communities/${id}/ai/usage/${feature}/adjustments`, payload);
