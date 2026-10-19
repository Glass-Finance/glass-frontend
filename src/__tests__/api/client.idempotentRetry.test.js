import { describe, it, expect, vi, beforeEach } from "vitest";

// Retry coverage for the idempotency-keyed replay path in client.js.
//
// The safety property under test is as much about what must NOT retry as what
// must: this client fronts payment initiation, so a replay that is not provably
// safe is worse than the original failure. Retry is gated on the payload
// carrying an idempotencyKey, and on nothing else — not the path, not the verb.
//
// Mocked at the axios adapter boundary so the interceptor chain itself is under
// test, not a stand-in for it.

const adapter = vi.fn();

// Swap the TRANSPORT, not the client: create() returns a real axios instance so
// the real interceptor chain runs, with defaults.adapter replaced by `adapter`.
// Stubbing client.post() would skip the interceptors — which are the code under
// test — and stubbing create() would require reimplementing the request chain.
vi.mock("axios", async () => {
  const actual = await vi.importActual("axios");
  const axios = (...args) => actual.default(...args);
  // Order matters: copy the real module's properties FIRST (including its own
  // `create`), then override `create` on top. The reverse order silently
  // restores the real create and every request goes out over jsdom's XHR.
  Object.assign(axios, actual.default);
  axios.create = (config) => {
    const instance = actual.default.create(config);
    instance.defaults.adapter = (cfg) => adapter(cfg);
    return instance;
  };
  return { ...actual, default: axios };
});

function axiosError(config, status) {
  const error = new Error(`Request failed with status code ${status}`);
  error.config = config;
  error.response = { data: {}, status, statusText: "", headers: {}, config };
  return error;
}

function networkError(config) {
  const error = new Error("Network Error");
  error.config = config;
  error.isAxiosError = true;
  error.request = {};
  return error;
}

function ok(config) {
  return {
    data: { data: { transactionId: "t-1" } },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

const PAY_PATH = "/payments/pay/payment-links/plan-1";

describe("client.js idempotent retry", () => {
  let client;

  beforeEach(async () => {
    vi.resetModules();
    adapter.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    // Seeded so the 401 branch does not tear the session down underneath the
    // retry assertions — this suite is about replay, not sign-out.
    localStorage.setItem("accessToken", "tok");
    localStorage.setItem("refreshToken", "ref");
    ({ default: client } = await import("../../api/client"));
  });

  const paymentPayload = () => ({ idempotencyKey: "key-123", amount: 5000 });

  it("replays a keyed request once after a 503 and resolves on the retry", async () => {
    adapter
      .mockImplementationOnce(() =>
        Promise.reject(axiosError({ url: PAY_PATH, method: "post", data: paymentPayload() }, 503)),
      )
      .mockImplementationOnce((cfg) => Promise.resolve(ok(cfg)));

    const res = await client.post(PAY_PATH, paymentPayload());

    expect(res.status).toBe(200);
    expect(adapter).toHaveBeenCalledTimes(2);
    // Same key on both attempts — that is what makes attempt two the same
    // intent rather than a second charge. axios serialises the body before the
    // adapter sees it, so read it back the same way a reviewer would.
    const keyOf = (call) => JSON.parse(call[0].data).idempotencyKey;
    expect(keyOf(adapter.mock.calls[0])).toBe("key-123");
    expect(keyOf(adapter.mock.calls[1])).toBe("key-123");
  });

  it("retries a keyed request after a network error with no response", async () => {
    adapter
      .mockImplementationOnce((cfg) => Promise.reject(networkError(cfg)))
      .mockImplementationOnce((cfg) => Promise.resolve(ok(cfg)));

    await expect(client.post(PAY_PATH, paymentPayload())).resolves.toMatchObject({ status: 200 });
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a request with no idempotency key", async () => {
    adapter.mockImplementation((cfg) => Promise.reject(axiosError(cfg, 503)));

    await expect(
      client.post("/payments/callback/verify", null, { params: { reference: "r1" } }),
    ).rejects.toThrow();
    // verifyPayment carries no key, so a replay would be a second side effect.
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a keyed request rejected with a 4xx", async () => {
    adapter.mockImplementation((cfg) => Promise.reject(axiosError(cfg, 400)));

    await expect(client.post(PAY_PATH, paymentPayload())).rejects.toThrow();
    // A rejected request will be rejected identically; replaying it is noise.
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a keyed request answered 429 by the rate limiter", async () => {
    adapter.mockImplementation((cfg) => Promise.reject(axiosError(cfg, 429)));

    await expect(client.post(PAY_PATH, paymentPayload())).rejects.toThrow();
    // 429 is a protection mechanism working correctly, not a fault to retry.
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry limit rather than looping", async () => {
    adapter.mockImplementation((cfg) => Promise.reject(axiosError(cfg, 503)));

    await expect(client.post(PAY_PATH, paymentPayload())).rejects.toThrow();
    // 1 initial attempt + 2 retries, then the error surfaces to the caller.
    expect(adapter).toHaveBeenCalledTimes(3);
  });

  it("treats an empty idempotency key as absent", async () => {
    adapter.mockImplementation((cfg) => Promise.reject(axiosError(cfg, 503)));

    await expect(client.post(PAY_PATH, { idempotencyKey: "", amount: 5000 })).rejects.toThrow();
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
