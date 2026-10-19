import client from "./client";

export const getCommunityAiUsage = (id, params = {}) =>
  client.get(`/communities/${id}/ai/usage`, { params });
// Keep the feature as a path parameter so the endpoint audit can match the
// backend's {feature} route; this consumer requests only RECORD_IMPORT.
export const getRecordImportUsage = (id, feature = "RECORD_IMPORT") =>
  client.get(`/communities/${id}/ai/usage/${feature}`);
