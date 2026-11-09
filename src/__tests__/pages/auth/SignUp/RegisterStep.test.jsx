import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RegisterStep from "../../../../pages/auth/SignUp/RegisterStep";
import { register } from "../../../../services/authService";

// RegisterStep owns the one register() call of the whole sign-up flow and its
// payload contract (backend rejects a confirmPassword/inviteToken field — see
// authPayloads.js). Uncovered off the baseline; mocked at the service boundary
// per repo convention, with the real buildRegisterPayload running underneath.
vi.mock("../../../../services/authService", () => ({
  register: vi.fn(),
}));

const VALID_PASSWORD = "Glass123!";
const EMAIL = "sulaimon@example.com";

function renderStep(props = {}) {
  const onNext = vi.fn();
  render(<RegisterStep email={EMAIL} phone="" phoneConfirmToken="" onNext={onNext} {...props} />);
  return onNext;
}

function fillForm({
  first = "Sulaimon",
  last = "Balogun",
  password = VALID_PASSWORD,
  confirm = VALID_PASSWORD,
} = {}) {
  const nameInputs = screen.getAllByPlaceholderText("Enter Your Name");
  fireEvent.change(nameInputs[0], { target: { value: first } });
  fireEvent.change(nameInputs[1], { target: { value: last } });
  fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByPlaceholderText("re-enter Password"), {
    target: { value: confirm },
  });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Create Your Account|Creating Account/ }));
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RegisterStep validation", () => {
  it("flags empty fields on blur and never calls register on an empty submit", () => {
    const onNext = renderStep();

    // The form relies on native `required` validation (deliberately no
    // noValidate), so an empty submit is blocked before handleSubmit runs —
    // the custom messages surface through the per-field blur validation.
    fireEvent.blur(screen.getAllByPlaceholderText("Enter Your Name")[0]);
    fireEvent.blur(screen.getByPlaceholderText("re-enter Password"));

    expect(screen.getByText("First name is required.")).toBeDefined();
    expect(screen.getByText("Please confirm your password.")).toBeDefined();

    submit();
    expect(register).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("blocks submit and marks the password invalid when it doesn't meet the backend rules", () => {
    const onNext = renderStep();

    fillForm({ password: "weakpw", confirm: "weakpw" });
    submit();

    // The password field has no inline error element (only the live
    // checklist) — its invalid state is exposed on the input itself, and
    // the observable contract is that submit never reaches the service.
    expect(screen.getByPlaceholderText("Enter Your Password").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(register).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("flags a confirm value that doesn't match", () => {
    const onNext = renderStep();

    fillForm({ confirm: "Glass1234!" });
    submit();

    expect(screen.getByText("Passwords don't match.")).toBeDefined();
    expect(register).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe("RegisterStep submit", () => {
  it("registers with the backend payload contract (no confirmPassword), shows loading, then advances", async () => {
    const onNext = renderStep();
    const authData = { accessToken: "reg-token" };
    const gate = deferred();
    register.mockReturnValue(gate.promise);

    fillForm();
    submit();

    expect(screen.getByText("Creating Account...")).toBeDefined();

    gate.resolve(authData);
    await waitFor(() => expect(onNext).toHaveBeenCalledWith(EMAIL, { accessToken: "reg-token" }));
    expect(register).toHaveBeenCalledWith({
      email: EMAIL,
      firstName: "Sulaimon",
      lastName: "Balogun",
      password: VALID_PASSWORD,
    });
    expect(Object.keys(register.mock.calls[0][0])).not.toContain("confirmPassword");
  });

  it("surfaces a server rejection (duplicate email) inline and does not advance", async () => {
    const onNext = renderStep();
    register.mockRejectedValue({
      response: { status: 400, data: { message: "Email already registered" } },
    });

    fillForm();
    submit();

    expect(await screen.findByText("Email already registered")).toBeDefined();
    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create Your Account" })).toBeDefined();
  });
});

describe("RegisterStep password checklist visibility", () => {
  const RULE = "At least 8 characters";

  it("is hidden until the password field is focused", () => {
    renderStep();
    expect(screen.queryByText(RULE)).toBeNull();
    fireEvent.focus(screen.getByPlaceholderText("Enter Your Password"));
    expect(screen.getByText(RULE)).toBeDefined();
  });

  it("hides again on blur when the password is valid", () => {
    renderStep();
    const input = screen.getByPlaceholderText("Enter Your Password");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: VALID_PASSWORD } });
    fireEvent.blur(input);
    expect(screen.queryByText(RULE)).toBeNull();
  });

  it("stays visible after blur when the password fails, since it is the only error explanation", () => {
    renderStep();
    const input = screen.getByPlaceholderText("Enter Your Password");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "short" } });
    fireEvent.blur(input);
    expect(screen.getByText(RULE)).toBeDefined();
  });
});
