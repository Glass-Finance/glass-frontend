import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  Skeleton,
  SkeletonRow,
  SkeletonTableRows,
  SkeletonTable,
} from "../../../components/common/SkeletonUI";
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

// A table placeholder has to participate in the table's column sizing, which is
// why it renders tr/td rather than a div grid. These assert the two properties
// that actually matter: real table elements, and the header's per-column
// classes carried through -- including the responsive hiding, so a column that
// vanishes below a breakpoint takes its placeholder with it.
describe("SkeletonTableRows", () => {
  const COLUMNS = [
    "hidden sm:table-cell px-5 py-2.5 w-8",
    "px-5 py-2.5",
    "hidden xl:table-cell px-5 py-2.5",
  ];

  const renderInTable = (ui) =>
    render(
      <table>
        <tbody>{ui}</tbody>
      </table>,
    );

  it("renders real table rows and cells, not divs", () => {
    const { container } = renderInTable(<SkeletonTableRows rows={3} columns={COLUMNS} />);

    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(container.querySelectorAll("tbody tr:first-child td")).toHaveLength(3);
  });

  it("carries each column's own classes onto its cell", () => {
    const { container } = renderInTable(<SkeletonTableRows rows={1} columns={COLUMNS} />);
    const cells = [...container.querySelectorAll("td")];

    expect(cells[0].className).toContain("hidden sm:table-cell");
    expect(cells[1].className).toContain("px-5 py-2.5");
    expect(cells[1].className).not.toContain("hidden");
    // The xl column's placeholder must hide at xl exactly like its header does.
    expect(cells[2].className).toContain("hidden xl:table-cell");
  });

  it("hides every row from assistive tech", () => {
    const { container } = renderInTable(<SkeletonTableRows rows={2} columns={COLUMNS} />);
    const rows = [...container.querySelectorAll("tr")];

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("renders nothing without columns rather than a broken table", () => {
    const { container } = renderInTable(<SkeletonTableRows rows={4} columns={[]} />);

    expect(container.querySelectorAll("tr")).toHaveLength(0);
  });

  it("uses a square for the leading checkbox column and bars for the rest", () => {
    const { container } = renderInTable(<SkeletonTableRows rows={1} columns={COLUMNS} />);
    const cells = [...container.querySelectorAll("td")];
    const square = cells[0].firstElementChild;
    const bar = cells[1].firstElementChild;

    // Dashboard tables lead with a checkbox, so that placeholder is a small
    // square; the text columns get a bar. Both carry Skeleton's base classes
    // (including `rounded`), so the distinguishing size is what to assert.
    expect(square.className).toContain("w-5");
    expect(square.className).toContain("h-5");
    expect(bar.className).toContain("max-w-[7.5rem]");
    expect(bar.className).not.toContain("w-5");
  });
});

// For pages whose loading state returns BEFORE the real table exists, so there
// is no header to align against. These pin that it is a real table with a real
// header row, that the header and body agree on the column count, and that the
// whole thing is announced as one busy region rather than a grid of empty cells.
describe("SkeletonTable", () => {
  it("renders a table with a header and the requested body rows", () => {
    const { container } = render(<SkeletonTable rows={4} columns={6} />);

    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(container.querySelectorAll("thead tr")).toHaveLength(1);
    expect(container.querySelectorAll("thead th")).toHaveLength(6);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(container.querySelectorAll("tbody tr:first-child td")).toHaveLength(6);
  });

  it("announces the region as busy and hides the header and body from AT", () => {
    const { container } = render(<SkeletonTable rows={2} columns={3} />);

    expect(container.firstChild.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector("thead").getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("tbody").getAttribute("aria-hidden")).toBe("true");
  });

  it("applies the caller's table, header, cell and wrapper classes", () => {
    const { container } = render(
      <SkeletonTable
        rows={1}
        columns={2}
        className="px-4 h-full"
        tableClassName="w-full text-sm border-collapse"
        headClassName="border-y border-gray-100"
        cellClassName="px-5 py-3"
      />,
    );

    expect(container.firstChild.className).toContain("px-4");
    expect(container.firstChild.className).toContain("h-full");
    expect(container.querySelector("table").className).toContain("border-collapse");
    expect(container.querySelector("thead").className).toContain("border-y");
    expect(container.querySelector("td").className).toContain("px-5 py-3");
  });
});
