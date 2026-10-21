import { describe, it, expect, vi, beforeEach } from "vitest";

// monitoring.js reads the DSN into a module-level constant at import time,
// so the env stub has to be in place BEFORE the module is evaluated -- hence
// vi.hoisted. Without a DSN, monitoring stays disabled and nothing is ever
// forwarded, which would make every assertion here vacuous.
vi.hoisted(() => {
  vi.stubEnv("VITE_SENTRY_DSN", "https://examplePublicKey@o0.ingest.sentry.io/0");
});

// Sentry is mocked at the module boundary: this test is about WHICH errors
// are worth forwarding, not about Sentry itself.
vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
  init: vi.fn(),
}));

import * as Sentry from "@sentry/react";
import { captureException, initMonitoring } from "../../utils/monitoring";

beforeEach(() => {
  vi.clearAllMocks();
  initMonitoring();
});

describe("monitoring's reporting filter", () => {
  it("reports network failures, which produced no response at all", () => {
    captureException({ request: {} }, { context: "Send code" });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("reports server errors", () => {
    captureException({ response: { status: 500 } }, { context: "Send code" });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  // A 429 is the API's own limiter answering -- a statement about our
  // capacity, not about what the person typed. The auth limiters are per-IP,
  // so a phone behind a shared carrier NAT can be refused for reasons that
  // have nothing to do with it. Before this was reportable, a rate-limited
  // signup left no trace anywhere.
  it("reports a rate-limited request, which is our capacity rather than their mistake", () => {
    captureException({ response: { status: 429 } }, { context: "Send code" });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("does not report routine validation failures", () => {
    captureException({ response: { status: 400 } }, { context: "Register" });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
