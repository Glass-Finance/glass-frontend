import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import useRealtimeStream from "../../hooks/useRealtimeStream";
import { useAuth } from "../../store/AuthContext";
import { mintRealtimeTicket } from "../../api/realtime";

// The backend's RealtimeEventType, and the fact that the wire format IS the
// enum name (RealtimeEventConsumer sends `.name(event.type().name())`).
//
// The stream used to subscribe to a list of lower-case guesses —
// "notification", "payment", "transaction" — that the backend has never sent.
// A named SSE event is delivered only to listeners registered for that exact
// name, so NOTIFICATION_CREATED was received by the browser and discarded.
// The notification push has not worked since the stream landed in June.
//
// The symptom was invisible rather than obvious: useNotifications falls back
// to a 30s poll only while the connection is DOWN, and this bug leaves it UP,
// so a new notification took up to FIVE MINUTES to appear.

vi.mock("../../store/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../api/realtime", () => ({ mintRealtimeTicket: vi.fn() }));

let listeners;
let invalidateSpy;

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.closed = false;
    listeners = this;
  }
  addEventListener(name, handler) {
    this.handlers = this.handlers ?? {};
    this.handlers[name] = handler;
  }
  close() {
    this.closed = true;
  }
  emit(type, data = "{}") {
    this.handlers?.[type]?.({ type, data });
  }
}

beforeEach(() => {
  globalThis.EventSource = FakeEventSource;
  listeners = null;
  useAuth.mockReturnValue({ isAuthenticated: true, sessionVerified: true });
  mintRealtimeTicket.mockResolvedValue({ data: { data: { ticket: "t-1" } } });
});

function renderStream() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <StreamHarness />
    </QueryClientProvider>,
  );
  return queryClient;
}

function StreamHarness() {
  useRealtimeStream();
  return null;
}

async function waitForStream() {
  await waitFor(() => expect(listeners).not.toBeNull());
  await waitFor(() => expect(Object.keys(listeners.handlers ?? {})).length > 0);
  return listeners;
}

describe("SSE event names", () => {
  it("subscribes to every name the backend can send", async () => {
    renderStream();
    const es = await waitForStream();
    // The backend's RealtimeEventType, verbatim.
    for (const name of [
      "CONNECTED",
      "RECORD_IMPORT_PROGRESS",
      "NOTIFICATION_CREATED",
      "EXPORT_COMPLETED",
      "EXPORT_FAILED",
    ]) {
      expect(es.handlers[name]).toBeTypeOf("function");
    }
  });

  it("invalidates the notification list when a notification is created", async () => {
    renderStream();
    const es = await waitForStream();
    invalidateSpy.mockClear();

    es.emit("NOTIFICATION_CREATED", JSON.stringify({ title: "Payment received" }));

    // The invalidation is debounced by 400ms.
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] }),
    );
  });

  it("does not drop an event whose payload merely contains an ignored word", async () => {
    // "shipping" contains "ping", and IGNORE used to be tested against the
    // payload as well as the event name — so a notification titled "Shipping
    // update" was silently swallowed and the list never refreshed.
    renderStream();
    const es = await waitForStream();
    invalidateSpy.mockClear();

    es.emit("NOTIFICATION_CREATED", JSON.stringify({ title: "Shipping update" }));

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] }),
    );
  });

  it("does not refetch notifications when an export finishes", async () => {
    // Export jobs are polled by useExportJob, not held in a query, so there is
    // no key to invalidate — and the fallback would refetch the notification
    // list for no reason.
    renderStream();
    const es = await waitForStream();
    invalidateSpy.mockClear();

    es.emit("EXPORT_COMPLETED", JSON.stringify({ exportId: "e-1", status: "COMPLETED" }));

    await new Promise((r) => setTimeout(r, 600));
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("ignores the CONNECTED handshake", async () => {
    renderStream();
    const es = await waitForStream();
    invalidateSpy.mockClear();

    es.emit("CONNECTED", JSON.stringify({ connected: true }));

    await new Promise((r) => setTimeout(r, 600));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
