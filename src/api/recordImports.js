import client from "./client";

export const getRecordImports = (id, params = {}) =>
  client.get(`/communities/${id}/records/imports`, { params });
export const submitRecordImport = (id, payload) =>
  client.post(`/communities/${id}/records/imports`, payload);
export const getRecordImport = (id, jobId) =>
  client.get(`/communities/${id}/records/imports/${jobId}`);
export const getImportRows = (id, jobId, params = {}) =>
  client.get(`/communities/${id}/records/imports/${jobId}/rows`, { params });
export const createImportRow = (id, jobId, payload) =>
  client.post(`/communities/${id}/records/imports/${jobId}/rows`, payload);
export const updateImportRow = (id, jobId, rowId, payload) =>
  client.patch(`/communities/${id}/records/imports/${jobId}/rows/${rowId}`, payload);
export const deleteImportRow = (id, jobId, rowId) =>
  client.delete(`/communities/${id}/records/imports/${jobId}/rows/${rowId}`);
export const bulkUpdateImportRows = (id, jobId, payload) =>
  client.patch(`/communities/${id}/records/imports/${jobId}/rows/bulk`, payload);
export const commitRecordImport = (id, jobId) =>
  client.post(`/communities/${id}/records/imports/${jobId}/commit`);
export const discardRecordImport = (id, jobId) =>
  client.post(`/communities/${id}/records/imports/${jobId}/discard`);
export const retryRecordImport = (id, jobId) =>
  client.post(`/communities/${id}/records/imports/${jobId}/retry`);
export const rerunRecordImport = (id, jobId) =>
  client.post(`/communities/${id}/records/imports/${jobId}/rerun`);
