import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import EmailChangeModal from "../../../components/common/EmailChangeModal";

describe("EmailChangeModal", () => {
  it("requests a replacement email-update code through its resend callback", async () => {
    const onResend = vi.fn().mockResolvedValue({});
    render(
      <EmailChangeModal
        newEmail="new@example.com"
        onResend={onResend}
        onSubmitOtp={vi.fn()}
        onVerified={vi.fn()}
        onWrongEmail={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resend" }));

    expect(await screen.findByText("A new code has been sent.")).toBeDefined();
    expect(onResend).toHaveBeenCalledTimes(1);
  });
});
