// Canonical community UUIDs are used by all record-book hooks, so SSE payloads
// and routes with a slug converge on the same cache without alias guessing.
export const recordKeys = {
  records: (id) => ["community", id, "records"],
  record: (id, recordId) => ["community", id, "records", "detail", recordId],
  imports: (id) => ["community", id, "record-imports"],
  job: (id, jobId) => ["community", id, "record-imports", "job", jobId],
  usage: (id) => ["community", id, "ai-usage", "RECORD_IMPORT"],
};
export function refreshRecordImportEvent(client, payload, sequences) {
  if (
    !payload ||
    typeof payload.communityId !== "string" ||
    typeof payload.jobId !== "string" ||
    typeof payload.status !== "string" ||
    !Number.isSafeInteger(payload.sequence) ||
    payload.sequence < 0
  )
    return;
  const { communityId, jobId, status, sequence } = payload;
  const key = `${communityId}:${jobId}`;
  if (sequence <= (sequences.get(key) ?? -1)) return;
  sequences.set(key, sequence);
  // Bound tab-lifetime bookkeeping; a forgotten sequence only causes a refetch.
  if (sequences.size > 1000) sequences.delete(sequences.keys().next().value);
  void client.invalidateQueries({ queryKey: recordKeys.imports(communityId) });
  void client.invalidateQueries({ queryKey: recordKeys.usage(communityId) });
  void client.invalidateQueries({ queryKey: ["notifications"] });
  if (status === "COMMITTED")
    void client.invalidateQueries({ queryKey: recordKeys.records(communityId) });
}
