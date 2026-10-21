import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OtpBoxes from "../../../components/common/OtpBoxes";
import { renderDashedOtpBoxes } from "../../../components/common/renderDashedOtpBoxes";

// Regression guard: renderDashedOtpBoxes is a render PROP that OtpBoxes
// invokes as renderBoxes(digits, activeIndex). It must never be swapped for a
// component — a component receives a props object, so `digits` lands in
// `props` and the component's own destructuring yields value === undefined,
// which blew up on `value.join("")` at render time ("Cannot read properties of
// undefined (reading 'join')"). Every OTP surface went blank mid-flow, and a
// refresh landed the user back on the step-1 form.
describe("renderDashedOtpBoxes", () => {
  it("renders inside OtpBoxes without throwing", () => {
    expect(() =>
      render(
        <OtpBoxes
          value={["1", "2", "", "", "", ""]}
          onChange={() => {}}
          renderBoxes={renderDashedOtpBoxes}
        />,
      ),
    ).not.toThrow();
  });

  it("draws one labelled box per digit plus the dash separator", () => {
    render(
      <OtpBoxes
        value={["1", "2", "", "", "", ""]}
        onChange={() => {}}
        renderBoxes={renderDashedOtpBoxes}
      />,
    );
    for (let i = 1; i <= 6; i += 1) {
      expect(screen.getByLabelText(`Digit ${i} of 6`)).toBeTruthy();
    }
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("shows the digits it is handed", () => {
    render(
      <OtpBoxes
        value={["9", "8", "7", "6", "5", "4"]}
        onChange={() => {}}
        renderBoxes={renderDashedOtpBoxes}
      />,
    );
    expect(screen.getByLabelText("Digit 1 of 6").textContent).toBe("9");
    expect(screen.getByLabelText("Digit 6 of 6").textContent).toBe("4");
  });

  it("keeps typing wired to the single hidden input", async () => {
    const user = userEvent.setup();
    const seen = [];
    // Controlled harness: OtpBoxes is a controlled input, so the parent has to
    // feed the new digits back for the second keystroke to accumulate.
    function Harness() {
      const [digits, setDigits] = useState(["", "", "", "", "", ""]);
      return (
        <OtpBoxes
          value={digits}
          onChange={(next) => {
            seen.push(next);
            setDigits(next);
          }}
          renderBoxes={renderDashedOtpBoxes}
        />
      );
    }
    render(<Harness />);
    await user.type(screen.getByLabelText("Verification code"), "12");
    expect(seen.at(-1)).toEqual(["1", "2", "", "", "", ""]);
    expect(screen.getByLabelText("Digit 1 of 6").textContent).toBe("1");
    expect(screen.getByLabelText("Digit 2 of 6").textContent).toBe("2");
  });

  it("is a plain function, not a component (no props-object destructuring)", () => {
    // Guards the exact regression: if this ever becomes a component again,
    // calling it positionally breaks the render-prop contract.
    expect(renderDashedOtpBoxes(["1", "", "", "", "", ""], 1)).toBeTruthy();
    expect(renderDashedOtpBoxes.length).toBe(2);
  });

  it("keeps phone boxes compact and fixed, with Figma sizing on desktop", () => {
    render(
      <OtpBoxes
        value={["1", "2", "", "", "", ""]}
        onChange={() => {}}
        renderBoxes={renderDashedOtpBoxes}
      />,
    );
    const box = screen.getByLabelText("Digit 1 of 6");
    // 36px narrow-phone, 40px standard-phone, and 64px desktop box sizes.
    expect(box.className).toContain("w-9");
    expect(box.className).toContain("h-9");
    expect(box.className).toContain("flex-shrink-0");
    expect(box.className).toContain("sm:w-10");
    expect(box.className).toContain("sm:h-10");
    expect(box.className).toContain("md:w-16");
    expect(box.className).toContain("md:h-16");
  });

  it("marks only the caret box for the focus border", () => {
    render(
      <OtpBoxes
        value={["1", "2", "", "", "", ""]}
        onChange={() => {}}
        renderBoxes={renderDashedOtpBoxes}
      />,
    );
    // code.length = 2 → box 3 is the next keystroke target
    expect(screen.getByLabelText("Digit 3 of 6").className).toContain("otp-box-active");
    expect(screen.getByLabelText("Digit 1 of 6").className).not.toContain("otp-box-active");
    expect(screen.getByLabelText("Digit 4 of 6").className).not.toContain("otp-box-active");
  });

  it("wires the OtpBoxes root for the focus-within border selector", () => {
    const { container } = render(
      <OtpBoxes
        value={["", "", "", "", "", ""]}
        onChange={() => {}}
        renderBoxes={renderDashedOtpBoxes}
      />,
    );
    expect(container.querySelector(".otp-input-root")).toBeTruthy();
  });
});
