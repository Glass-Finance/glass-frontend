import { expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
vi.mock("../../store/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, sessionVerified: true }),
}));
vi.mock("../../api/realtime", () => ({
  mintRealtimeTicket: vi.fn().mockResolvedValue({ data: { data: { ticket: "once" } } }),
}));
import useRealtimeStream from "../../hooks/useRealtimeStream";
import { recordKeys } from "../../utils/recordBookQueryKeys";
function Stream() {
  useRealtimeStream();
  return null;
}
it("refreshes records from a named SSE transition on the existing connection", async () => {
  const listeners = {};
  const close = vi.fn();
  const EventSourceMock = vi.fn(function () {
    this.addEventListener = (name, fn) => {
      listeners[name] = fn;
    };
    this.close = close;
  });
  vi.stubGlobal("EventSource", EventSourceMock);
  const client = new QueryClient();
  client.setQueryData(recordKeys.records("c"), { content: [] });
  const mounted = render(
    <QueryClientProvider client={client}>
      <Stream />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(listeners.RECORD_IMPORT_PROGRESS).toBeTypeOf("function"));
  listeners.RECORD_IMPORT_PROGRESS({
    type: "RECORD_IMPORT_PROGRESS",
    data: JSON.stringify({ communityId: "c", jobId: "j", status: "COMMITTED", sequence: 3 }),
  });
  expect(client.getQueryState(recordKeys.records("c")).isInvalidated).toBe(true);
  expect(EventSourceMock).toHaveBeenCalledTimes(1);
  mounted.unmount();
  expect(close).toHaveBeenCalled();
  vi.unstubAllGlobals();
});
