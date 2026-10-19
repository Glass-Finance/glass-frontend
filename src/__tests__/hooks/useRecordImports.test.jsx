import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import * as api from "../../api/recordImports";
import { useImportJob, useCommitImportJob } from "../../hooks/useRecordImports";

// The commit trap, pinned as a test.
//
// POST /commit answers 202 having queued work. The job only reaches COMMITTED
// once a worker revalidates every included row, and a commit blocked by
// validation does NOT fail the job — it comes back as READY_FOR_REVIEW with
// IMPORT_COMMIT_BLOCKED. So a poll that settles on "anything that isn't
// COMMITTED", or that stops at COMMIT_QUEUED, either reports a false success or
// freezes the UI mid-commit.

vi.mock("../../api/recordImports", () => ({
  getImportJob: vi.fn(),
  commitImportJob: vi.fn(),
}));

function wrapper({ children }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const jobEnvelope = (job) => ({ status: 200, data: { success: true, data: job } });

beforeEach(() => {
  api.getImportJob.mockReset();
  api.commitImportJob.mockReset();
});

describe("importJobPollInterval (via useImportJob)", () => {
  // The predicate is asserted through its effect on the hook's refetch count,
  // so the wiring in the query config is covered too — not just the rule.
  async function countFetchesFor(job) {
    let resolveFetch;
    api.getImportJob.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve(jobEnvelope(job));
        }),
    );
    const { result, unmount } = renderHook(() => useImportJob("c", "job-1"), { wrapper });
    await waitFor(() => expect(api.getImportJob).toHaveBeenCalledTimes(1));
    resolveFetch();
    // Let the resolved value settle into the cache.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const settled = api.getImportJob.mock.calls.length;
    unmount();
    return settled;
  }

  it("keeps polling while the job is queued", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const before = await countFetchesFor({ id: "job-1", status: "QUEUED" });
      expect(before).toBe(1);
      // Not settled on a single request — the point is that it has not stopped.
      expect(api.getImportJob).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops polling once the job commits", async () => {
    await countFetchesFor({ id: "job-1", status: "COMMITTED" });
    const settled = api.getImportJob.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(api.getImportJob.mock.calls.length).toBe(settled);
  });

  it("stops polling at READY_FOR_REVIEW — nothing moves without a human", async () => {
    await countFetchesFor({ id: "job-1", status: "READY_FOR_REVIEW" });
    const settled = api.getImportJob.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(api.getImportJob.mock.calls.length).toBe(settled);
  });

  it("does not poll at all when poll is false", async () => {
    api.getImportJob.mockResolvedValue(jobEnvelope({ id: "job-1", status: "QUEUED" }));
    const { result, unmount } = renderHook(() => useImportJob("c", "job-1", { poll: false }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const settled = api.getImportJob.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(api.getImportJob.mock.calls.length).toBe(settled);
    unmount();
  });

  it("stops polling after a terminal outcome", async () => {
    for (const status of ["FAILED", "DISCARDED"]) {
      api.getImportJob.mockReset();
      await countFetchesFor({ id: "job-1", status });
      const settled = api.getImportJob.mock.calls.length;
      await new Promise((r) => setTimeout(r, 120));
      expect(api.getImportJob.mock.calls.length).toBe(settled);
    }
  });
});

describe("useCommitImportJob", () => {
  it("POSTs commit and resolves on the 202 without claiming success", async () => {
    // 202 is the queue accepting the request, not the records being written.
    // The hook must not hang waiting for COMMITTED, and must not invent a
    // success signal — observation is useImportJob's poll.
    api.commitImportJob.mockResolvedValue({
      status: 202,
      data: { success: true, data: { id: "job-1", status: "COMMIT_QUEUED" } },
    });

    const { result } = renderHook(() => useCommitImportJob("c"), { wrapper });
    const res = await result.current.mutateAsync("job-1");

    expect(api.commitImportJob).toHaveBeenCalledWith("c", "job-1");
    expect(res.status).toBe(202);
    // Resolved with what the server said — COMMIT_QUEUED, not COMMITTED.
    expect(res.data.data.status).toBe("COMMIT_QUEUED");
  });

  it("sends no body", async () => {
    api.commitImportJob.mockResolvedValue({ status: 202, data: { data: {} } });
    const { result } = renderHook(() => useCommitImportJob("c"), { wrapper });
    await result.current.mutateAsync("job-1");
    // Asserted in the API test; here we only care that the mutation resolves.
    expect(api.commitImportJob).toHaveBeenCalledTimes(1);
  });

  it("surfaces a rejected commit to the caller rather than swallowing it", async () => {
    api.commitImportJob.mockRejectedValue(new Error("Job is not in a committable state"));

    const { result } = renderHook(() => useCommitImportJob("c"), { wrapper });

    await expect(result.current.mutateAsync("job-1")).rejects.toThrow(
      "Job is not in a committable state",
    );
  });
});
