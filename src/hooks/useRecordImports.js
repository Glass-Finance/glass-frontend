import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/recordImports";
import { uploadFile, uploadFiles } from "../api/files";
import { recordKeys } from "../utils/recordBookQueryKeys";
import { jobPollInterval } from "../utils/recordBook";

export function useRecordImports(id, params = {}, enabled = true) {
  return useQuery({
    queryKey: [...recordKeys.imports(id), "list", params],
    queryFn: async () => (await api.getRecordImports(id, params)).data.data,
    enabled: !!id && enabled,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: (q) =>
      q.state.data?.content?.some((job) => jobPollInterval(job)) ? 15000 : false,
  });
}
export function useRecordImport(id, jobId, enabled = true) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: recordKeys.job(id, jobId),
    queryFn: async () => (await api.getRecordImport(id, jobId)).data.data,
    enabled: !!id && !!jobId && enabled,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchInterval: (q) => jobPollInterval(q.state.data),
  });
  const status = query.data?.status;
  useEffect(() => {
    if (status === "COMMITTED") {
      void client.invalidateQueries({ queryKey: recordKeys.records(id) });
      void client.invalidateQueries({ queryKey: recordKeys.usageRoot(id) });
    }
  }, [status, id, client]);
  return query;
}

export function useImportAction(id, jobId, action) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const actions = {
        commit: api.commitRecordImport,
        retry: api.retryRecordImport,
        rerun: api.rerunRecordImport,
        discard: api.discardRecordImport,
      };
      return (await actions[action](id, jobId)).data.data;
    },
    retry: false,
    meta: { silentError: true },
    onSuccess: (job) => {
      client.setQueryData(recordKeys.job(id, job.id), job);
      if (job.status === "COMMITTED")
        void client.invalidateQueries({ queryKey: recordKeys.records(id) });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: recordKeys.imports(id) });
      void client.invalidateQueries({ queryKey: recordKeys.usageRoot(id) });
    },
  });
}
export function useImportUpload(id) {
  const client = useQueryClient();
  const upload = useMutation({
    mutationFn: async (files) => {
      const response =
        files.length === 1
          ? await uploadFile(files[0], "RECORD_IMPORT_SOURCE")
          : await uploadFiles(files, "RECORD_IMPORT_SOURCE");
      return files.length === 1 ? [response.data.data] : response.data.data;
    },
    retry: false,
    meta: { silentError: true },
  });
  const submit = useMutation({
    mutationFn: async (payload) => (await api.submitRecordImport(id, payload)).data.data,
    retry: false,
    meta: { silentError: true },
    onSuccess: (job) => client.setQueryData(recordKeys.job(id, job.id), job),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: recordKeys.imports(id) });
      void client.invalidateQueries({ queryKey: recordKeys.usageRoot(id) });
    },
  });
  // Reconcile an uncertain POST response by its uploaded file ID before any
  // explicit resubmission. This is a read, never an automatic mutation retry.
  const reconcile = useMutation({
    mutationFn: async (fileId) =>
      (await api.getRecordImports(id, { fileId, pageNumber: 1, pageSize: 10 })).data.data,
    retry: false,
    meta: { silentError: true },
  });
  return { upload, submit, reconcile };
}
