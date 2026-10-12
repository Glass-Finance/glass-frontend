import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonRow } from "../../../components/common/SkeletonUI";
import { MEMBER_APP_SKELETON_ROW } from "../../../components/common/skeletonRowPresets";
import Toggle from "../../../components/common/Toggle";

// The shared skeleton primitives. These replace four hand-rolled copies that
// drifted on padding, bar geometry, colour tokens and the Toggle footprint --
// so the geometry assertions below are the regression: a placeholder wider or
// taller than the content it stands in for shifts the row on swap.

describe("Skeleton", () => {
  it("pulses and merges a caller's geometry", () => {
    const { container } = render(<Skeleton className="h-6 w-16" />);

    const el = container.firstChild;
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("bg-gray-200");
    expect(el.className).toContain("h-6");
    expect(el.className).toContain("w-16");
  });

  it("is hidden from assistive tech — decoration, not content", () => {
    const { container } = render(<Skeleton />);

    expect(container.firstChild.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("SkeletonRow", () => {
  it("renders a label bar, a description bar and a toggle placeholder", () => {
    const { container } = render(<SkeletonRow />);

    // Two text bars + one toggle placeholder.
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("matches the shared Toggle's own w-8 h-[20px] footprint", () => {
    // The old dashboard copy used w-12 h-5 and the member-app copy w-10
    // h-[22px]; both are the wrong size for Toggle.jsx's w-8 h-[20px].
    const { container } = render(<SkeletonRow />);
    const toggleBar = container.querySelector(".rounded-full");
    expect(toggleBar.className).toContain("w-8");
    expect(toggleBar.className).toContain("h-[20px]");
  });

  it("puts the divider on the row except the last one", () => {
    const { rerender, container } = render(<SkeletonRow />);
    expect(container.firstChild.className).toContain("border-b");

    rerender(<SkeletonRow last />);
    expect(container.firstChild.className).not.toContain("border-b");
  });

  it("is hidden from assistive tech — decoration, not content", () => {
    const { container } = render(<SkeletonRow />);

    expect(container.firstChild.getAttribute("aria-hidden")).toBe("true");
  });

  it("accepts the member-app geometry preset", () => {
    const { container } = render(<SkeletonRow {...MEMBER_APP_SKELETON_ROW} />);

    // The member-app label bar is h-[13px] (text-sm) with p-4-equivalent
    // padding, and uses an approved token rather than the old raw #EBEBEB.
    expect(container.querySelector(".h-\\[13px\\]")).not.toBeNull();
    expect(container.firstChild.className).toContain("py-3.5");
    expect(container.firstChild.className).toContain("px-4");
  });

  it("never emits the prohibited raw hex", () => {
    const { container } = render(<SkeletonRow {...MEMBER_APP_SKELETON_ROW} />);

    expect(container.innerHTML).not.toContain("EBEBEB");
    // The approved replacement.
    expect(container.querySelector(".bg-hairline-soft")).not.toBeNull();
  });
});

describe("SkeletonRow vs Toggle geometry", () => {
  it("the toggle placeholder is no wider than the real switch it replaces", () => {
    // Real Toggle switch is w-8 h-[20px]; anything wider shifts the row.
    const skeleton = render(<SkeletonRow />);
    const bar = skeleton.container.querySelector(".rounded-full");
    expect(bar.className).toContain("w-8");

    const real = render(<Toggle on={false} onChange={() => {}} />);
    const track = real.container.querySelector(".w-8");
    expect(track).not.toBeNull();
  });
});
