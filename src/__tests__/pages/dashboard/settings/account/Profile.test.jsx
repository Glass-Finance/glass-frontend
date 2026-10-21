import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Profile from "../../../../../pages/dashboard/settings/account/Profile";
import {
  useMe,
  useUpdateProfile,
  useRequestPhoneUpdate,
  useUpdatePhone,
} from "../../../../../hooks/useMyAccount";
import { useFileUpload } from "../../../../../hooks/useFileUpload";
import { useAuth } from "../../../../../store/AuthContext";
import {
  deleteAccount,
  requestAccountDeletionCode,
  requestEmailUpdate,
  updateEmail,
} from "../../../../../api/members";

// Account deletion is the single most irreversible Tier 1 action in the
// app: unlike payout-account removal, there's no "add it back" path. It's
// already gated behind three separate steps -- type the literal word
// "DELETE" to unlock requesting a code, receive the code, then enter the
// full 6-digit code to unlock the final confirm button -- which these
// tests pin explicitly. The most important case is the last one: a failed
// deletion must NOT log the user out or navigate away, since that would
// be a severe UX bug (losing your session over a deletion that didn't
// even succeed).

vi.mock("../../../../../hooks/useMyAccount", () => ({
  useMe: vi.fn(),
  useUpdateProfile: vi.fn(),
  useRequestPhoneUpdate: vi.fn(),
  useUpdatePhone: vi.fn(),
}));
vi.mock("../../../../../hooks/useFileUpload", () => ({
  useFileUpload: vi.fn(),
}));
vi.mock("../../../../../store/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../../../../../api/members", async () => {
  const actual = await vi.importActual("../../../../../api/members");
  return {
    ...actual,
    deleteAccount: vi.fn(),
    requestAccountDeletionCode: vi.fn(),
    requestEmailUpdate: vi.fn(),
    updateEmail: vi.fn(),
  };
});

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

let logoutMock;

beforeEach(() => {
  navigateMock.mockClear();
  requestAccountDeletionCode.mockReset();
  deleteAccount.mockReset();
  requestEmailUpdate.mockReset();
  updateEmail.mockReset();

  useMe.mockReturnValue({
    data: {
      id: "user-1",
      firstName: "Amina",
      lastName: "Bello",
      email: "amina@example.com",
      emailVerified: true,
    },
  });
  useUpdateProfile.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  useRequestPhoneUpdate.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  useUpdatePhone.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  useFileUpload.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

  logoutMock = vi.fn().mockResolvedValue({});
  useAuth.mockReturnValue({ refreshUser: vi.fn(), logout: logoutMock });

  requestAccountDeletionCode.mockResolvedValue({});
  deleteAccount.mockResolvedValue({});
  requestEmailUpdate.mockResolvedValue({});
  updateEmail.mockResolvedValue({});
});

function renderPage() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  );
}

describe("Email update flow", () => {
  it("requests an EMAIL_UPDATE code before opening the confirmation modal", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Update email" }));

    const input = document.querySelector('input[type="email"]');
    fireEvent.change(input, { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    await screen.findByText("Enter the Code we Sent");
    expect(requestEmailUpdate).toHaveBeenCalledWith({ email: "new@example.com" });
    expect(updateEmail).not.toHaveBeenCalled();
  });

  it("confirms an email update with the submitted OTP", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Update email" }));

    const input = document.querySelector('input[type="email"]');
    fireEvent.change(input, { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    await screen.findByText("Enter the Code we Sent");

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(updateEmail).toHaveBeenCalledWith({
        email: "new@example.com",
        emailVerificationOtp: "123456",
      }),
    );
  });
});

function openWarnStep() {
  screen.getByText("Delete").click();
}

async function typeDeleteConfirmAndContinue() {
  const input = await screen.findByPlaceholderText("DELETE");
  fireEvent.change(input, { target: { value: "DELETE" } });
  screen.getByText("Continue").click();
  await waitFor(() => expect(requestAccountDeletionCode).toHaveBeenCalledTimes(1));
}

function fillOtp(code) {
  const input = document.querySelector('input[name="otp"]');
  fireEvent.change(input, { target: { value: code } });
}

function clickFinalDeleteButton() {
  // "Delete Account" text is ambiguous once on the code step -- it's also
  // the static page heading (a <p>) that stays rendered behind the modal.
  // The real submit action is the <button>.
  const candidates = screen.getAllByText("Delete Account");
  const button = candidates.find((el) => el.tagName === "BUTTON");
  button.click();
}

describe("Account deletion flow", () => {
  it("never calls deleteAccount or requestAccountDeletionCode just from opening the modal", async () => {
    renderPage();
    openWarnStep();

    await screen.findByText("Continue");
    expect(requestAccountDeletionCode).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("the Continue button stays disabled until the literal word DELETE is typed", async () => {
    renderPage();
    openWarnStep();

    const continueButton = await screen.findByText("Continue");
    expect(continueButton.disabled).toBe(true);

    const input = screen.getByPlaceholderText("DELETE");
    fireEvent.change(input, { target: { value: "delete" } }); // wrong case
    expect(continueButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(continueButton.disabled).toBe(false);
  });

  it("requests a deletion code only after typing DELETE and clicking Continue, never calls deleteAccount yet", async () => {
    renderPage();
    openWarnStep();
    await typeDeleteConfirmAndContinue();

    expect(requestAccountDeletionCode).toHaveBeenCalledTimes(1);
    expect(deleteAccount).not.toHaveBeenCalled();
    // Should now be on the code-entry step.
    await screen.findByText("Enter Verification Code");
  });

  it("the final confirm button stays disabled until all 6 OTP digits are entered", async () => {
    renderPage();
    openWarnStep();
    await typeDeleteConfirmAndContinue();
    await screen.findByText("Enter Verification Code");

    const candidates = screen.getAllByText("Delete Account");
    const confirmButton = candidates.find((el) => el.tagName === "BUTTON");
    expect(confirmButton.disabled).toBe(true);

    fillOtp("123");
    expect(confirmButton.disabled).toBe(true);

    fillOtp("123456");
    expect(confirmButton.disabled).toBe(false);
  });

  it("on success: calls deleteAccount with the entered code, then logs out and navigates to sign-in", async () => {
    renderPage();
    openWarnStep();
    await typeDeleteConfirmAndContinue();
    await screen.findByText("Enter Verification Code");
    fillOtp("123456");

    clickFinalDeleteButton();

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith("123456"));
    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/sign-in"));
  });

  it("on a failed deletion: shows the server's error and does NOT log the user out or navigate away", async () => {
    deleteAccount.mockRejectedValueOnce({
      response: { data: { description: "Incorrect verification code." } },
    });
    renderPage();
    openWarnStep();
    await typeDeleteConfirmAndContinue();
    await screen.findByText("Enter Verification Code");
    fillOtp("000000");

    clickFinalDeleteButton();

    await screen.findByText("Incorrect verification code.");
    expect(logoutMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("Cancel from either step closes the modal without calling deleteAccount", async () => {
    renderPage();
    openWarnStep();
    await screen.findByText("Continue");

    screen.getByText("Cancel").click();

    await waitFor(() => expect(screen.queryByText("Continue")).toBeNull());
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(requestAccountDeletionCode).not.toHaveBeenCalled();
  });
});

// While `useMe()` resolves the form used to render with every field empty and
// then fill in. These pin that a cold visit now gets one busy skeleton region
// and no form at all, and that the two never appear together.
describe("Profile loading state", () => {
  it("shows a skeleton instead of an empty form while the user is loading", () => {
    useMe.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderPage();

    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    // The real form must be absent entirely -- an empty form under a skeleton
    // is the exact flash this change removes.
    expect(screen.queryByText("Manage your personal information")).toBeNull();
    expect(screen.queryByText("First Name")).toBeNull();
    expect(screen.queryByText("Delete Account")).toBeNull();
  });

  it("hides the skeleton and shows the form once the user has resolved", () => {
    const { container } = renderPage();

    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByText("Manage your personal information")).toBeTruthy();
    expect(screen.getByText("First Name")).toBeTruthy();
  });
});
