import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PhoneChangeModal from "../../../components/common/PhoneChangeModal";

vi.mock("../../../hooks/useCountdown", () => ({
  useCountdown: () => 900,
  formatCountdown: () => "15:00",
}));

describe("PhoneChangeModal OTP layout", () => {
  it("uses the compact shared boxes sized to stay within the modal", () => {
    render(
      <PhoneChangeModal
        newPhone="+2348012345678"
        isUpdate={false}
        onSubmitOtp={vi.fn()}
        onVerified={vi.fn()}
        onWrongNumber={vi.fn()}
        onResend={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const firstBox = screen.getByLabelText("Digit 1 of 6");
    const otpRow = firstBox.parentElement.parentElement;
    expect(otpRow.className).toContain("w-fit");
    expect(otpRow.className).toContain("max-w-full");
    expect(screen.getByLabelText("Verification code").parentElement.className).toContain("-mx-2");
    expect(firstBox.className).toContain("w-9");
    expect(firstBox.className).toContain("sm:w-10");
    expect(firstBox.className).toContain("md:w-16");
    expect(screen.getByLabelText("Digit 2 of 6").className).toContain("border-hairline-strong");
    expect(screen.getByLabelText("Digit 3 of 6").className).toContain("border-hairline-strong");
    expect(screen.getByLabelText("Digit 6 of 6")).toBeTruthy();
  });
});
