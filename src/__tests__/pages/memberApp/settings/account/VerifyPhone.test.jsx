import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VerifyPhone from "../../../../../pages/memberApp/settings/account/VerifyPhone";

const { navigateMock, refreshUserMock, requestPhoneUpdateMock, updatePhoneMock } = vi.hoisted(
  () => ({
    navigateMock: vi.fn(),
    refreshUserMock: vi.fn(),
    requestPhoneUpdateMock: vi.fn(),
    updatePhoneMock: vi.fn(),
  }),
);

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));
vi.mock("../../../../../hooks/useMyAccount", () => ({
  useMe: () => ({ data: { phoneNumber: "+2348012345678", phoneVerified: false } }),
  useRequestPhoneUpdate: () => ({ mutateAsync: requestPhoneUpdateMock }),
  useUpdatePhone: () => ({ mutateAsync: updatePhoneMock }),
}));
vi.mock("../../../../../store/AuthContext", () => ({
  useAuth: () => ({ refreshUser: refreshUserMock }),
}));
vi.mock("../../../../../hooks/useCountdown", () => ({
  useCountdown: () => 900,
  formatCountdown: () => "15:00",
}));

describe("VerifyPhone OTP flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestPhoneUpdateMock.mockResolvedValue({});
  });

  it("clears an old code when requesting a code after changing the phone number", async () => {
    render(<VerifyPhone />);

    fireEvent.click(screen.getByRole("button", { name: "Add Phone Number" }));
    await screen.findByText("Enter the Code we Sent");

    const otpInput = screen.getByLabelText("Verification code");
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Wrong Number?" }));

    const phoneInput = screen.getByLabelText("Phone Number");
    fireEvent.change(phoneInput, { target: { value: "+2348098765432" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Phone Number" }));

    await waitFor(() => expect(requestPhoneUpdateMock).toHaveBeenCalledTimes(2));
    await screen.findByText("Enter the Code we Sent");
    expect(screen.getByLabelText("Verification code").value).toBe("");
    expect(screen.getByRole("button", { name: "Continue" }).disabled).toBe(true);
  });
});
