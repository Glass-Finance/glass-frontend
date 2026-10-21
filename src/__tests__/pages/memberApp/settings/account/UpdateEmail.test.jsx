import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UpdateEmail from "../../../../../pages/memberApp/settings/account/UpdateEmail";
import { useMe, useUpdateEmail } from "../../../../../hooks/useMyAccount";
import { useAuth } from "../../../../../store/AuthContext";
import { requestEmailUpdate } from "../../../../../api/members";

vi.mock("../../../../../hooks/useMyAccount", () => ({
  useMe: vi.fn(),
  useUpdateEmail: vi.fn(),
}));
vi.mock("../../../../../store/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../../../../../api/members", async () => {
  const actual = await vi.importActual("../../../../../api/members");
  return { ...actual, requestEmailUpdate: vi.fn() };
});

let updateEmailMutation;

beforeEach(() => {
  vi.clearAllMocks();
  useMe.mockReturnValue({ data: { email: "old@example.com" } });
  updateEmailMutation = vi.fn().mockResolvedValue({});
  useUpdateEmail.mockReturnValue({ mutateAsync: updateEmailMutation });
  useAuth.mockReturnValue({ refreshUser: vi.fn().mockResolvedValue({}) });
  requestEmailUpdate.mockResolvedValue({});
});

describe("Member app email update OTP", () => {
  it("requests and resends EMAIL_UPDATE codes before confirming the entered OTP", async () => {
    render(
      <MemoryRouter>
        <UpdateEmail />
      </MemoryRouter>,
    );

    fireEvent.change(document.querySelector('input[type="email"]'), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Email" }));

    await screen.findByText("Enter OTP");
    expect(requestEmailUpdate).toHaveBeenCalledWith({ email: "new@example.com" });

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    await waitFor(() => expect(requestEmailUpdate).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(updateEmailMutation).toHaveBeenCalledWith({
        email: "new@example.com",
        emailVerificationOtp: "123456",
      }),
    );
  });
});
