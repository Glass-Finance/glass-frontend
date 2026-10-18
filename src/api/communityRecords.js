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
