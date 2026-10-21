import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Badge from "../../../components/ui/Badge";

// Guards docs/design-system.md §9.1 — the Figma badge palette. Literal on
// purpose: when the spec changes, the spec file changes first and this
// test is what should then fail with it.
describe("Badge — design system conformance", () => {
  it.each([
    // [kind, value, wash, label-colour, radius]
    ["status", "paid", "bg-success-wash", "text-success", "rounded-g-1"],
    ["status", "unpaid", "bg-danger-wash", "text-danger", "rounded-g-1"],
    ["status", "pending", "bg-warning-wash", "text-warning", "rounded-g-1"],
    ["role", "member", "bg-warning-wash", "text-warning", "rounded-g-1"],
    ["role", "admin", "bg-accent-purple-tint", "text-accent-purple", "rounded-g-1"],
    // Frequency chips are the §1.5 pill exception.
    ["freq", "weekly", "bg-brand-100", "text-brand", "rounded-full"],
    ["freq", "monthly", "bg-warning-wash", "text-warning", "rounded-full"],
    ["freq", "one-time", "bg-accent-purple-tint", "text-accent-purple", "rounded-full"],
  ])("%s/%s maps to its Figma wash/label/radius", (kind, value, wash, fg, radius) => {
    render(<Badge kind={kind} value={value} />);
    const cls = screen.getByText(
      value === "one-time" ? "One-Time" : value[0].toUpperCase() + value.slice(1),
    ).className;
    expect(cls).toContain(wash);
    expect(cls).toContain(fg);
    expect(cls).toContain(radius);
  });

  it("status and role labels are 16px; frequency pills are 14px", () => {
    const { rerender } = render(<Badge kind="status" value="paid" />);
    expect(screen.getByText("Paid").className).toContain("text-base");
    rerender(<Badge kind="freq" value="weekly" />);
    expect(screen.getByText("Weekly").className).toContain("text-sm");
  });

  it("all badges are weight 500", () => {
    render(<Badge kind="status" value="paid" />);
    expect(screen.getByText("Paid").className).toContain("font-medium");
  });

  it("accepts custom children over the default label", () => {
    render(
      <Badge kind="status" value="paid">
        2/2
      </Badge>,
    );
    expect(screen.getByText("2/2").tagName).toBe("SPAN");
  });

  it("returns null for an unknown value instead of a broken chip", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<Badge kind="status" value="overdue" />);
    expect(container.firstChild).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("merges a className override", () => {
    render(<Badge kind="status" value="paid" className="text-xs" />);
    const cls = screen.getByText("Paid").className;
    expect(cls).toContain("bg-success-wash");
    expect(cls).toContain("text-xs");
  });
});
