import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmSheet from "../../../components/memberApp/ConfirmSheet";

// Guards docs/design-system.md §2 for the member app's shared bottom-sheet
// confirm — behind every destructive member action (leave community, remove
// saved card, turn off auto-pay). It had no test coverage at all, which is how
// a rounded-xl pill at weight 600 with no pressed or focus-visible state
// survived here.
describe("ConfirmSheet — design system conformance", () => {
  const defaults = {
    title: "Leave this community?",
    description: "You can re-join later.",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  // Two buttons answer to "Cancel": the icon-only close (earlier in the DOM)
  // and the outline action. These pick the right one so every assertion below
  // is unambiguous.
  const cancelAction = () => screen.getAllByRole("button", { name: /cancel/i })[1];
  const cancelIcon = () =>
    [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Cancel");

  // The confirm label swaps to confirmingLabel (default "Please wait…") while
  // busy, so queries that must survive a confirming rerender span both.
  const confirmBtn = () => screen.getByRole("button", { name: /yes, continue|please wait/i });

  it("renders both actions", () => {
    render(<ConfirmSheet {...defaults} />);
    expect(cancelAction()).toBeTruthy();
    expect(confirmBtn()).toBeTruthy();
  });

  it("uses the critical role for the destructive confirm", () => {
    const { rerender } = render(<ConfirmSheet {...defaults} danger />);
    expect(confirmBtn().className).toContain("bg-danger");
    rerender(<ConfirmSheet {...defaults} danger={false} />);
    expect(confirmBtn().className).toContain("bg-brand");
  });

  // The role collapse from docs/design-system.md §4.3: Cancel must be the outline
  // role (transparent + 10% black stroke), never a filled pill.
  it("Cancel is the transparent outline role, not a filled pill", () => {
    render(<ConfirmSheet {...defaults} />);
    const cls = cancelAction().className;
    expect(cls).toContain("bg-transparent");
    expect(cls).toContain("border-black/10");
  });

  // ui/Button swaps in its disabled styling at render time rather than
  // carrying a static disabled: class, so the disabled state is asserted
  // functionally below rather than by class name.
  it.each([
    ["confirm", confirmBtn],
    ["cancel", cancelAction],
  ])("%s carries the spec radius, weight and state classes", (_label, pick) => {
    render(<ConfirmSheet {...defaults} />);
    const cls = pick().className;
    expect(cls).toContain("rounded-g-1");
    expect(cls).not.toMatch(/rounded-(lg|xl|full|2xl)\b/);
    expect(cls).toContain("font-medium");
    expect(cls).not.toMatch(/font-(semibold|bold)\b/);
    expect(cls).toContain("hover:");
    expect(cls).toContain("active:");
    expect(cls).toContain("focus-visible:outline-focus");
  });

  it.each([
    ["confirm", confirmBtn],
    ["cancel", cancelAction],
  ])("%s actually disables while confirming", (_label, pick) => {
    const { rerender } = render(<ConfirmSheet {...defaults} confirming={false} />);
    expect(pick().disabled).toBe(false);
    rerender(<ConfirmSheet {...defaults} confirming />);
    expect(pick().disabled).toBe(true);
  });

  // Regression guard for a mistake this sweep nearly shipped: ui/Button
  // defaults fullWidth to true, and these actions are stacked in a flex-col
  // and were w-full before migrating -- passing fullWidth={false} to match
  // ConfirmDialog (whose pair shares a row and sizes with flex-1) would have
  // silently narrowed both.
  it("keeps both actions full width", () => {
    render(<ConfirmSheet {...defaults} />);
    expect(confirmBtn().className).toContain("w-full");
    expect(cancelAction().className).toContain("w-full");
  });

  it("marks the busy confirm as aria-busy", () => {
    render(<ConfirmSheet {...defaults} confirming />);
    expect(confirmBtn().getAttribute("aria-busy")).toBe("true");
  });

  // The icon-only close deliberately stays a raw <button> rather than going
  // through ui/Button -- Figma defines no icon-button role. It is exempt from
  // the component, not from the spec.
  it("icon-only close is reachable and still carries the spec states", () => {
    render(<ConfirmSheet {...defaults} />);
    expect(screen.getAllByRole("button", { name: /cancel/i })).toHaveLength(2);
    const iconBtn = cancelIcon();
    expect(iconBtn).toBeTruthy();
    expect(iconBtn.className).toContain("rounded-g-1");
    expect(iconBtn.className).not.toMatch(/rounded-(lg|xl|full|2xl)\b/);
    for (const pattern of ["hover:", "active:", "focus-visible:outline-focus"]) {
      expect(iconBtn.className).toContain(pattern);
    }
  });

  it("calls back on confirm and cancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmSheet {...defaults} onConfirm={onConfirm} onCancel={onCancel} />);
    confirmBtn().click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    cancelAction().click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
