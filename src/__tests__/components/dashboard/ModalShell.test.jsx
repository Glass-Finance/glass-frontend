import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModalShell from "../../../components/dashboard/ModalShell";

// Guards docs/design-system.md §2 for the shared dashboard modal chrome, imported
// by 17 files. Its two close-button variants (the one in the titled header row
// and the absolutely positioned one used when a caller supplies its own
// heading) had no test coverage at all, which is how both kept a rounded-lg
// (8px, off-spec) radius with no pressed and no focus-visible state -- and how
// the titled variant ended up with no accessible name.
//
// The close buttons deliberately stay raw <button> rather than going through
// ui/Button: Figma defines no icon-button role. They are exempt from the
// component, not from the spec.
describe("ModalShell — design system conformance", () => {
  const body = <p>body</p>;

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <ModalShell title="t" onClose={onClose}>
        {body}
      </ModalShell>,
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Both variants share one class string, so this covers the whole component.
  it.each([
    ["titled header row", { title: "Has a title" }],
    ["caller-supplied heading", {}],
  ])("close button (%s) uses the 4px radius and all states", (_label, props) => {
    render(
      <ModalShell {...props} onClose={vi.fn()}>
        {body}
      </ModalShell>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.className).toContain("rounded-g-1");
    expect(close.className).not.toMatch(/rounded-(lg|xl|full|2xl)\b/);
    expect(close.className).toMatch(/hover:/);
    expect(close.className).toMatch(/active:/);
    expect(close.className).toContain("focus-visible:outline-focus");
  });

  // The titled variant previously had no aria-label at all, so it was
  // reachable only as an unnamed button.
  it.each([
    ["titled header row", { title: "Has a title" }],
    ["caller-supplied heading", {}],
  ])("close button (%s) has an accessible name", (_label, props) => {
    render(
      <ModalShell {...props} onClose={vi.fn()}>
        {body}
      </ModalShell>,
    );
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("renders the footer slot below the children", () => {
    render(
      <ModalShell title="t" onClose={vi.fn()} footer={<button type="button">Act</button>}>
        {body}
      </ModalShell>,
    );
    expect(screen.getByRole("button", { name: "Act" })).toBeTruthy();
  });
});
