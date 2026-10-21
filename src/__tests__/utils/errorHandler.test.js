import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("../../utils/monitoring", () => ({
  captureException: vi.fn(),
}));

import { toast } from "sonner";
import { captureException } from "../../utils/monitoring";
import {
  getErrorMessage,
  getRetryAfterSeconds,
  notifyError,
  runWithErrorHandling,
} from "../../utils/errorHandler";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getErrorMessage", () => {
  it("prefers a specific server message over the status fallback", () => {
    const error = { response: { status: 400, data: { message: "Email already in use" } } };
    expect(getErrorMessage(error)).toBe("Email already in use");
  });

  it("falls back to the status message when the server message is too generic", () => {
    const error = { response: { status: 404, data: { message: "Not Found" } } };
    expect(getErrorMessage(error)).toBe("We couldn't find what you were looking for.");
  });

  it("rewrites a known cryptic backend message into actionable guidance", () => {
    const error = {
      response: { status: 400, data: { message: "Active Default Account Required" } },
    };
    expect(getErrorMessage(error)).toContain("payout account");
  });

  it("reads the first field error out of a NestJS ValidationPipe array", () => {
    const error = { response: { status: 400, data: { message: ["Phone must be valid"] } } };
    expect(getErrorMessage(error)).toBe("Phone must be valid");
  });

  it("treats a 401 on a pre-auth path as a wrong-credentials message, not a session-expired one", () => {
    const error = {
      response: { status: 401, data: {} },
      config: { url: "/auth/login" },
    };
    expect(getErrorMessage(error)).toBe("Incorrect email or password.");
  });

  it("treats a 401 on an authenticated path as a session-expired message", () => {
    const error = {
      response: { status: 401, data: {} },
      config: { url: "/communities/123" },
    };
    expect(getErrorMessage(error)).toBe(
      "For your security, your session has expired — please sign in again.",
    );
  });

  // The backend answers 401 for a resend to an address with no account, and
  // its body ("Invalid Request") says nothing a person can act on. The
  // status + path carry the real meaning.
  it("reads a 401 on the resend endpoint as 'no account for that email'", () => {
    const error = {
      response: { status: 401, data: { message: "error", description: "Invalid Request" } },
      config: { url: "/auth/verify/resend" },
    };
    expect(getErrorMessage(error)).toBe("We couldn't find an account for that email address.");
  });

  it("returns a connection-lost message when the request never got a response", () => {
    const error = { request: {} };
    expect(getErrorMessage(error)).toBe(
      "Connection lost — this didn't go through. Check your connection and try again.",
    );
  });

  it("returns a timeout message for ECONNABORTED", () => {
    const error = { code: "ECONNABORTED" };
    expect(getErrorMessage(error)).toBe("Request timed out — please try again.");
  });

  it("falls back to a plain Error's own message", () => {
    expect(getErrorMessage(new Error("Boom"))).toBe("Boom");
  });

  it("never throws and always returns the fallback for a falsy error", () => {
    expect(getErrorMessage(null)).toBe("Something went wrong. Please try again.");
    expect(getErrorMessage(undefined, "Custom fallback")).toBe("Custom fallback");
  });
});

describe("getRetryAfterSeconds", () => {
  it("reads a numeric Retry-After header off a 429", () => {
    const error = { response: { status: 429, headers: { "retry-after": "30" } } };
    expect(getRetryAfterSeconds(error)).toBe(30);
  });

  it("returns null for a non-429 error", () => {
    const error = { response: { status: 400, headers: { "retry-after": "30" } } };
    expect(getRetryAfterSeconds(error)).toBeNull();
  });

  it("returns null when the header is missing or non-numeric", () => {
    expect(getRetryAfterSeconds({ response: { status: 429, headers: {} } })).toBeNull();
    expect(
      getRetryAfterSeconds({ response: { status: 429, headers: { "retry-after": "soon" } } }),
    ).toBeNull();
  });
});

describe("notifyError", () => {
  it("toasts the resolved message and reports it to monitoring", () => {
    const error = new Error("Boom");
    const message = notifyError(error);
    expect(message).toBe("Boom");
    expect(toast.error).toHaveBeenCalledWith("Boom");
    expect(captureException).toHaveBeenCalledWith(error, { context: undefined });
  });

  it("suppresses the toast when silent is true, but still reports it", () => {
    notifyError(new Error("Quiet failure"), { silent: true });
    expect(toast.error).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalled();
  });
});

describe("runWithErrorHandling", () => {
  it("returns ok:true and the result on success, and shows a success toast when given one", async () => {
    const outcome = await runWithErrorHandling(() => Promise.resolve(42), {
      successMessage: "Done!",
    });
    expect(outcome).toEqual({ ok: true, result: 42 });
    expect(toast.success).toHaveBeenCalledWith("Done!");
  });

  it("returns ok:false with the resolved message on failure, without throwing", async () => {
    const outcome = await runWithErrorHandling(() => Promise.reject(new Error("Nope")));
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toBe("Nope");
    expect(toast.error).toHaveBeenCalledWith("Nope");
  });
});
