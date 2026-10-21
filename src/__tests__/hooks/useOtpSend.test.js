import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// The toast is the whole point of this hook: a send that failed used to be
// swallowed (`notifyError(..., { silent: true })`), which is what let a
// rate-limited signup look exactly like a slow one. Mocked here so the test
// can assert the toast actually fires.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("../../utils/monitoring", () => ({
  captureException: vi.fn(),
}));

import { toast } from "sonner";
import { useOtpSend } from "../../hooks/useOtpSend";

function rateLimited(retryAfter) {
  return {
    response: {
      status: 429,
      data: { message: "error", description: "Rate limit exceeded. Please try again later." },
      headers: retryAfter ? { "retry-after": String(retryAfter) } : {},
    },
    config: { url: "/auth/otp/request" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useOtpSend", () => {
  it("sends once on mount when autoSend is set", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ expiresAt: new Date(Date.now() + 900_000).toISOString() });
    const { result } = renderHook(() => useOtpSend({ sendRequest: send, autoSend: true }));

    await waitFor(() => expect(result.current.status).toBe("sent"));
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not send on mount when autoSend is not set", async () => {
    const send = vi.fn().mockResolvedValue({});
    const { result } = renderHook(() => useOtpSend({ sendRequest: send }));

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(send).not.toHaveBeenCalled();
  });

  it("toasts a failed send instead of swallowing it, and reports it as failed", async () => {
    const send = vi.fn().mockRejectedValue(rateLimited());
    const { result } = renderHook(() => useOtpSend({ sendRequest: send, autoSend: true }));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Rate limit exceeded. Please try again later.");
    expect(result.current.error).toContain("Rate limit exceeded");
  });

  it("waits exactly as long as the server asked when the send was rate limited", async () => {
    const send = vi.fn().mockRejectedValue(rateLimited(17));
    const { result } = renderHook(() => useOtpSend({ sendRequest: send, autoSend: true }));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.cooldownSeconds).toBe(17);
    expect(result.current.error).toContain("Try again in 17s.");
  });

  it("refuses to send again while the cooldown is running", async () => {
    const send = vi.fn().mockRejectedValue(rateLimited(17));
    const { result } = renderHook(() => useOtpSend({ sendRequest: send, autoSend: true }));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.cooldownSeconds).toBeGreaterThan(0);

    await act(async () => {
      await result.current.send();
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("locks the send action for a short while after a failure with no Retry-After", async () => {
    const send = vi.fn().mockRejectedValue(rateLimited());
    const { result } = renderHook(() => useOtpSend({ sendRequest: send, autoSend: true }));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.cooldownSeconds).toBeGreaterThan(0);
  });

  it("calls onSent with the response so the caller can restart its own timers", async () => {
    const payload = { expiresAt: "2026-01-01T00:00:00.000Z" };
    const send = vi.fn().mockResolvedValue(payload);
    const onSent = vi.fn();
    const { result } = renderHook(() => useOtpSend({ sendRequest: send, onSent, autoSend: true }));

    await waitFor(() => expect(result.current.status).toBe("sent"));
    expect(onSent).toHaveBeenCalledWith(payload);
  });

  // A failed RESEND after a code already went out is not the same failure as
  // a send that never happened: the person may already be holding a working
  // code, so the screen must not say "no code was sent".
  it("keeps everSent true once any send has gone out, even after a later failure", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ expiresAt: "2026-01-01T00:00:00.000Z" })
      .mockRejectedValueOnce(rateLimited());
    // successCooldown 0 so the second attempt isn't blocked by the lock the
    // first one set — the lock itself is covered above.
    const { result } = renderHook(() =>
      useOtpSend({ sendRequest: send, autoSend: true, successCooldown: 0 }),
    );

    await waitFor(() => expect(result.current.everSent).toBe(true));

    await act(async () => {
      await result.current.send();
    });

    expect(result.current.failed).toBe(true);
    expect(result.current.everSent).toBe(true);
  });
});
