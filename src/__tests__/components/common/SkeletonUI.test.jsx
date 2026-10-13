import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton, SkeletonRow } from "../../../components/common/SkeletonUI";
import {
  MEMBER_APP_SKELETON_ROW,
  DASHBOARD_SKELETON_ROW,
} from "../../../components/common/skeletonRowPresets";
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

  it("honours a tone override so two-tone rows keep their contrast", () => {
    // Regression: Skeleton hardcoded bg-gray-200, so migrating call sites
    // silently flattened every lighter bar onto the same tone. The override
    // has to be a prop, not a second bg-* class in className — equal
    // specificity means stylesheet order would decide the winner.
    const { container } = render(<Skeleton className="h-2.5" tone="bg-gray-100" />);

    const el = container.firstChild;
    expect(el.className).toContain("bg-gray-100");
    expect(el.className).not.toContain("bg-gray-200");
  });
});

describe("SkeletonRow", () => {
  it("renders a label bar, a description bar and a toggle placeholder", () => {
    const { container } = render(<SkeletonRow />);

    // Two text bars + one toggle placeholder.
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("keeps the label and description bars in different tones by default", () => {
    const { container } = render(<SkeletonRow />);
    const [label, sub] = container.querySelectorAll(".rounded-md");

    expect(label.className).toContain("bg-gray-200");
    expect(sub.className).toContain("bg-gray-100");
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
    // The approved replacement (#f2f2f2, "Hairline surface").
    expect(container.querySelector(".bg-hairline-soft")).not.toBeNull();
  });

  it("keeps the member-app label and sub in different tones", () => {
    // Regression: collapsing all three bars onto one tone flattened the row
    // and lost the label/description hierarchy the original #EBEBEB-vs-
    // hairline-soft pairing had.
    const { container } = render(<SkeletonRow {...MEMBER_APP_SKELETON_ROW} />);
    const [label, sub] = container.querySelectorAll(".rounded-md");

    expect(label.className).toContain("bg-gray-200");
    expect(sub.className).toContain("bg-hairline-soft");
  });
});

describe("SkeletonRow toggle width", () => {
  it("defaults to the bare switch width", () => {
    // Toggle.jsx without showLabel: the w-8 h-[20px] switch is the whole control.
    const { container } = render(<SkeletonRow />);

    expect(container.querySelector(".rounded-full").className).toContain("w-8");
  });

  it("widens for the showLabel variant the dashboard rows use", () => {
    // Regression: the placeholder was hardcoded w-8 while the real control is
    // the switch + gap-1.5 + an "On"/"Off" label, so the row shifted on swap.
    const { container } = render(<SkeletonRow {...DASHBOARD_SKELETON_ROW} />);

    const bar = container.querySelector(".rounded-full");
    expect(bar.className).toContain("w-14");
    expect(bar.className).toContain("h-[20px]");
  });

  it("keeps the showLabel placeholder wider than the bare one", () => {
    const bare = render(<SkeletonRow />);
    const labelled = render(<SkeletonRow {...DASHBOARD_SKELETON_ROW} />);

    expect(labelled.container.querySelector(".rounded-full").className).not.toBe(
      bare.container.querySelector(".rounded-full").className,
    );
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
