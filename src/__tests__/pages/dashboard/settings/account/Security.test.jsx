import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Security from "../../../../../pages/dashboard/settings/account/Security";
import { useUpdatePassword, useMe } from "../../../../../hooks/useMyAccount";
import { setupMfaTotp, enableMfaTotp, disableMfaTotp } from "../../../../../services/authService";
import { toastSuccess } from "../../../../../utils/toast";
import QRCode from "qrcode";

// Highest-risk behaviors of the 639-line Security page: password-change
// validation/payload/failure handling, and the MFA enable/disable flows —
// including the recovery-codes stage that must be impossible to dismiss
// accidentally (backdrop/X blocked, Done gated on the saved checkbox).

vi.mock("../../../../../hooks/useMyAccount", () => ({
  useUpdatePassword: vi.fn(),
  useMe: vi.fn(),
}));
vi.mock("../../../../../services/authService", () => ({
  setupMfaTotp: vi.fn(),
  enableMfaTotp: vi.fn(),
  disableMfaTotp: vi.fn(),
}));
vi.mock("../../../../../utils/toast", async (importOriginal) => ({
  ...(await importOriginal()),
  toastSuccess: vi.fn(),
}));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn() } }));

const OTPAUTH = "otpauth://totp/Glass:ada?secret=JBSWY3DPEHPK3PXP&issuer=Glass";

let invalidateSpy;

function renderSecurity({ mfaEnabled = false } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidateSpy = vi.spyOn(client, "invalidateQueries");
  useMe.mockReturnValue({ data: { mfaEnabled }, isLoading: false });
  return render(
    <QueryClientProvider client={client}>
      <Security />
    </QueryClientProvider>,
  );
}

function fillPasswords({
  current = "OldPass123!",
  fresh = "Glass123!",
  confirm = "Glass123!",
} = {}) {
  fireEvent.change(screen.getByPlaceholderText("Enter Current Password"), {
    target: { value: current },
  });
  fireEvent.change(screen.getByPlaceholderText("Enter New Password"), {
    target: { value: fresh },
  });
  fireEvent.change(screen.getByPlaceholderText("Confirm New Password"), {
    target: { value: confirm },
  });
}

function updateButton() {
  return screen.getByRole("button", { name: /^(Update Password|Updating…)$/ });
}

async function beginSetup() {
  fireEvent.click(screen.getByRole("button", { name: "Enable" }));
  fireEvent.click(screen.getByRole("button", { name: "Begin Setup" }));
  await screen.findByAltText("MFA QR code");
}

function typeCode(value) {
  fireEvent.change(screen.getByPlaceholderText("000000"), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  useUpdatePassword.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  useMe.mockReturnValue({ data: { mfaEnabled: false }, isLoading: false });
  setupMfaTotp.mockResolvedValue({ otpauthUri: OTPAUTH, secret: "JBSWY3DPEHPK3PXP" });
  enableMfaTotp.mockResolvedValue({ recoveryCodes: ["RC-AAAA1111", "RC-BBBBB2222"] });
  disableMfaTotp.mockResolvedValue({});
  QRCode.toDataURL.mockResolvedValue("data:image/png;base64,QR");
});

afterEach(cleanup);

describe("Security — password change", () => {
  it("blocks submit with inline errors when every field is empty", () => {
    const update = { mutateAsync: vi.fn(), isPending: false };
    useUpdatePassword.mockReturnValue(update);
    renderSecurity();

    fireEvent.click(updateButton());

    expect(screen.getByText("Current password is required.")).toBeTruthy();
    expect(screen.getByText("Please confirm your new password.")).toBeTruthy();
    // The new-password error is surfaced as a danger border (the live
    // checklist carries the detailed rules), and it still blocks submit.
    expect(screen.getByPlaceholderText("Enter New Password").style.borderColor).toBe(
      "var(--color-danger)",
    );
    expect(update.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirmation", () => {
    const update = { mutateAsync: vi.fn(), isPending: false };
    useUpdatePassword.mockReturnValue(update);
    renderSecurity();
    fillPasswords({ confirm: "Glass9999!" });

    fireEvent.click(updateButton());

    expect(screen.getByText("Passwords don't match.")).toBeTruthy();
    expect(update.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects a weak new password", () => {
    const update = { mutateAsync: vi.fn(), isPending: false };
    useUpdatePassword.mockReturnValue(update);
    renderSecurity();
    fillPasswords({ fresh: "alllowercase", confirm: "alllowercase" });

    fireEvent.click(updateButton());

    expect(update.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Enter New Password").style.borderColor).toBe(
      "var(--color-danger)",
    );
    // Confirmation matched and current was filled — only the new password
    // blocked the submit.
    expect(screen.queryByText("Passwords don't match.")).toBeNull();
    expect(screen.queryByText("Current password is required.")).toBeNull();
  });

  it("sends the expected payload, clears fields, and confirms success", async () => {
    const update = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
    useUpdatePassword.mockReturnValue(update);
    renderSecurity();
    fillPasswords();

    fireEvent.click(updateButton());

    expect(update.mutateAsync).toHaveBeenCalledWith({
      oldPassword: "OldPass123!",
      newPassword: "Glass123!",
      confirmPassword: "Glass123!",
    });
    expect(await screen.findByText("Password updated.")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter Current Password").value).toBe("");
    expect(screen.getByPlaceholderText("Enter New Password").value).toBe("");
  });

  it("surfaces the server message when the update fails", async () => {
    const update = {
      mutateAsync: vi.fn().mockRejectedValue({
        response: { status: 400, data: { message: "Current password is incorrect" } },
      }),
      isPending: false,
    };
    useUpdatePassword.mockReturnValue(update);
    renderSecurity();
    fillPasswords();

    fireEvent.click(updateButton());

    expect(await screen.findByText("Current password is incorrect")).toBeTruthy();
    expect(screen.queryByText("Password updated.")).toBeNull();
    expect(screen.getByPlaceholderText("Enter Current Password").value).toBe("OldPass123!");
  });

  it("disables the button and shows Updating… while pending", () => {
    useUpdatePassword.mockReturnValue({ mutateAsync: vi.fn(), isPending: true });
    renderSecurity();

    const button = updateButton();
    expect(button.textContent).toContain("Updating…");
    expect(button.disabled).toBe(true);
  });
});

describe("Security — MFA enable", () => {
  it("gates activation on a 6-digit code and renders the QR + manual key", async () => {
    renderSecurity({ mfaEnabled: false });

    await beginSetup();

    expect(setupMfaTotp).toHaveBeenCalledTimes(1);
    expect(QRCode.toDataURL).toHaveBeenCalledWith(expect.stringContaining("otpauth://"), {
      width: 200,
      margin: 1,
    });
    expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeTruthy();

    const activate = () => screen.getByRole("button", { name: /^(Activate MFA|Activating…)$/ });
    expect(activate().disabled).toBe(true);

    // Non-digits are stripped, so they can never satisfy the gate.
    typeCode("abcdef");
    expect(screen.getByPlaceholderText("000000").value).toBe("");
    expect(activate().disabled).toBe(true);

    typeCode("123456");
    expect(activate().disabled).toBe(false);
  });

  it("shows the server error for an invalid code and clears the input", async () => {
    enableMfaTotp.mockRejectedValue({
      response: { status: 400, data: { message: "Invalid authentication code" } },
    });
    renderSecurity({ mfaEnabled: false });
    await beginSetup();
    typeCode("123456");

    fireEvent.click(screen.getByRole("button", { name: "Activate MFA" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Invalid authentication code");
    expect(screen.getByPlaceholderText("000000").value).toBe("");
    expect(screen.getByRole("button", { name: "Activate MFA" }).disabled).toBe(true);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("locks the recovery stage until the codes are confirmed saved", async () => {
    renderSecurity({ mfaEnabled: false });
    await beginSetup();
    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: "Activate MFA" }));

    expect(await screen.findByText("MFA Enabled Successfully!")).toBeTruthy();
    // Auto-advances to recovery after ~1.6s.
    expect(await screen.findByText("Save your recovery codes", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText("RC-AAAA1111")).toBeTruthy();
    expect(screen.getByText("RC-BBBBB2222")).toBeTruthy();

    // X is hidden and the backdrop is a no-op on this stage…
    expect(screen.queryByLabelText("Close")).toBeNull();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement);
    expect(screen.getByRole("dialog")).toBeTruthy();

    // …and Done stays disabled until the saved checkbox is ticked.
    const done = screen.getByRole("button", { name: "Done" });
    expect(done.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("I've saved these codes somewhere safe"));
    expect(done.disabled).toBe(false);
    fireEvent.click(done);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["me"] });
  });
});

describe("Security — MFA disable", () => {
  it("disables MFA with a 6-digit code and refreshes the profile", async () => {
    renderSecurity({ mfaEnabled: true });
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));

    expect(screen.getByRole("heading", { name: "Disable MFA" })).toBeTruthy();
    expect(screen.getByText("Your account will be less secure")).toBeTruthy();

    typeCode("123456");
    fireEvent.click(screen.getByRole("button", { name: "Disable MFA" }));

    await waitFor(() => expect(disableMfaTotp).toHaveBeenCalledWith({ code: "123456" }));
    expect(toastSuccess).toHaveBeenCalledWith("Two-factor authentication disabled");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["me"] });
  });

  it("keeps the dialog open and shows the error for an invalid disable code", async () => {
    disableMfaTotp.mockRejectedValue({
      response: { status: 400, data: { message: "Invalid authentication code" } },
    });
    renderSecurity({ mfaEnabled: true });
    fireEvent.click(screen.getByRole("button", { name: "Disable" }));
    typeCode("123456");

    fireEvent.click(screen.getByRole("button", { name: "Disable MFA" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Invalid authentication code");
    expect(screen.getByPlaceholderText("000000").value).toBe("");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

// Phone frame (iPhone 16 - 99) swaps the Enable/Disable button for a switch.
// It must open the same modal and never flip on its own.
describe("2FA switch (phone layout)", () => {
  it("opens the setup modal without flipping while MFA is off", () => {
    renderSecurity({ mfaEnabled: false });
    const toggle = screen.getByRole("switch", { name: "Enable 2FA" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Begin Setup" })).toBeTruthy();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("opens the disable modal while MFA is on", () => {
    renderSecurity({ mfaEnabled: true });
    const toggle = screen.getByRole("switch", { name: "Enable 2FA" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(screen.getByRole("heading", { name: "Disable MFA" })).toBeTruthy();
  });
});
