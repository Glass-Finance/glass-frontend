import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingCta } from "../../../components/ui/LandingCta";

// Guards docs/design-system.md §2.2b — the landing CTA pill. Literal on
// purpose: the Figma values live in the spec first, and this test is
// what fails when the two drift.
describe("LandingCta — design system conformance", () => {
  it("renders a real button element", () => {
    render(<LandingCta>Get Started Free</LandingCta>);
    expect(screen.getByRole("button", { name: "Get Started Free" }).tagName).toBe("BUTTON");
  });

  it("defaults to type=button", () => {
    render(<LandingCta>Go</LandingCta>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });

  it("carries the Figma geometry: h=50 pill, ~36px sides, 15px label", () => {
    render(<LandingCta>Get Started Free</LandingCta>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("h-[50px]");
    expect(cls).toContain("rounded-full");
    expect(cls).toContain("px-9");
    expect(cls).toContain("text-[15px]");
  });

  it("uses the near-white fill with a black label, not the primary blue", () => {
    render(<LandingCta>Create Your Community</LandingCta>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("bg-[#fafbfc]");
    expect(cls).toContain("text-black");
    expect(cls).not.toContain("bg-brand");
  });

  it("disables and marks aria-busy while loading", () => {
    render(<LandingCta loading>Join A Community</LandingCta>);
    const btn = screen.getByRole("button");
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
  });

  it("accepts extra children such as a trailing chevron", () => {
    render(
      <LandingCta>
        Get Started Free <span data-testid="chev">›</span>
      </LandingCta>,
    );
    expect(screen.getByTestId("chev")).toBeTruthy();
  });

  it("merges a className override and forwards onClick", () => {
    const onClick = vi.fn();
    render(
      <LandingCta className="shadow-lg shadow-black/20" onClick={onClick}>
        Go
      </LandingCta>,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-[#fafbfc]");
    expect(btn.className).toContain("shadow-lg");
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
