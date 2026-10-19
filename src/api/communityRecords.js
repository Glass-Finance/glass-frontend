import client from "./client";

export const getCommunityRecords = (id, params = {}) =>
  client.get(`/communities/${id}/records`, { params });
export const getCommunityRecord = (id, recordId) =>
  client.get(`/communities/${id}/records/${recordId}`);
export const createCommunityRecord = (id, payload) =>
  client.post(`/communities/${id}/records`, payload);
export const updateCommunityRecord = (id, recordId, payload) =>
  client.patch(`/communities/${id}/records/${recordId}`, payload);
export const deleteCommunityRecord = (id, recordId) =>
  client.delete(`/communities/${id}/records/${recordId}`);

// Platform-admin read-only mirror. Requires platform.recordbook.read and does
// NOT require community membership — a platform admin who is not a member of
// this community still gets the data. Carried over from the earlier record-book
// contracts so these two routes stay visible to `npm run audit:endpoints`; no
// admin screen consumes them yet.
export const getAdminCommunityRecords = (id, params = {}) =>
  client.get(`/admin/communities/${id}/records`, { params });
export const getAdminCommunityRecord = (id, recordId) =>
  client.get(`/admin/communities/${id}/records/${recordId}`);
