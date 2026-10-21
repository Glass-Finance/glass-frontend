import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../../../components/dashboard/ConfirmDialog";

// Guards docs/design-system.md §2 for the shared confirm dialog — the single
// component behind every destructive dashboard action (remove member,
// remove payment method, turn off auto-pay, ...). It had no test coverage at
// all, which is how its Cancel button survived as a filled grey pill
// (rounded-xl / bg-gray-100 / font-semibold) while the non-danger confirm
// beside it had already been migrated to ui/Button.
describe("ConfirmDialog — design system conformance", () => {
  const defaults = {
    title: "Remove member?",
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders both actions", () => {
    render(<ConfirmDialog {...defaults} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeTruthy();
  });

  it("uses the critical role for the destructive confirm", () => {
    const { rerender } = render(<ConfirmDialog {...defaults} danger />);
    expect(screen.getByRole("button", { name: /confirm/i }).className).toContain("bg-danger");
    rerender(<ConfirmDialog {...defaults} danger={false} />);
    expect(screen.getByRole("button", { name: /confirm/i }).className).toContain("bg-brand");
  });

  // The role collapse from docs/design-system.md §4.3: Cancel must be the outline
  // role (transparent + 10% black stroke), never a filled grey pill.
  it("Cancel is the transparent outline role, not a filled grey pill", () => {
    render(<ConfirmDialog {...defaults} />);
    const cls = screen.getByRole("button", { name: /cancel/i }).className;
    expect(cls).toContain("bg-transparent");
    expect(cls).toContain("border-black/10");
    expect(cls).not.toContain("bg-gray-100");
  });

  // ui/Button swaps in its disabled styling at render time rather than
  // carrying a static disabled: class, so disabled behaviour is asserted
  // functionally instead of by class name.
  it.each([
    ["cancel", /cancel/i],
    ["confirm", /confirm/i],
  ])("%s carries the spec radius, weight and state classes", (_label, name) => {
    render(<ConfirmDialog {...defaults} />);
    const cls = screen.getByRole("button", { name }).className;
    expect(cls).toContain("rounded-g-1");
    expect(cls).not.toMatch(/rounded-(lg|xl|full|2xl)\b/);
    expect(cls).toContain("font-medium");
    expect(cls).not.toMatch(/font-(semibold|bold)\b/);
    expect(cls).toContain("hover:");
    expect(cls).toContain("active:");
    expect(cls).toContain("focus-visible:outline-focus");
  });

  it("both actions disable while confirming", () => {
    // The confirm label swaps to confirmingLabel (default "Please wait…")
    // while busy, so the query has to span both labels.
    const names = [/cancel/i, /confirm|please wait/i];
    const { rerender } = render(<ConfirmDialog {...defaults} confirming={false} />);
    for (const name of names) {
      expect(screen.getByRole("button", { name }).disabled).toBe(false);
    }
    rerender(<ConfirmDialog {...defaults} confirming />);
    for (const name of names) {
      expect(screen.getByRole("button", { name }).disabled).toBe(true);
    }
  });

  it("no longer leaves a raw off-spec button behind", () => {
    const { container } = render(<ConfirmDialog {...defaults} />);
    const raw = [...container.querySelectorAll("button")].filter(
      (b) => !b.className.includes("rounded-g-1"),
    );
    expect(raw).toHaveLength(0);
  });
});
