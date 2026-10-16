import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberPaymentsSection from "../../../../pages/dashboard/admin-dashboard/sections/MemberPaymentsSection";

// PR2 of the admin responsiveness work added a client-side pager and a Filter
// dropdown that drives Figma's chips row (node 393:19990). The parent owns
// the page/filter state; this suite pins the section's presentational contract
// so a prop rename or a missing callback fails here rather than silently
// freezing the table on page 0 with no way to change filters.

vi.mock("../../../../components/common/SkeletonUI", () => ({
  Skeleton: ({ className }) => <div data-testid="skeleton" className={className} />,
}));

const TX = (i, over = {}) => ({
  id: `tx-${i}`,
  status: i % 2 ? "SUCCESSFUL" : "PENDING",
  amount: 5000,
  planName: i % 2 ? "School Fees Support" : "End Of Year Party",
  createdAt: "2026-10-15T10:00:00Z",
  member: { user: { firstName: "A", lastName: `User${i}`, email: `u${i}@x.test` } },
  ...over,
});

function baseProps(over = {}) {
  return {
    transactions: [],
    total: 0,
    page: 0,
    pageCount: 1,
    onPageChange: vi.fn(),
    planOptions: ["School Fees Support", "End Of Year Party"],
    planFilter: null,
    onPlanFilterChange: vi.fn(),
    statusFilter: null,
    onStatusFilterChange: vi.fn(),
    onClearFilters: vi.fn(),
    search: "",
    onSearchChange: vi.fn(),
    sortDir: "desc",
    onToggleSort: vi.fn(),
    onExport: vi.fn(),
    isExporting: false,
    communityId: "c1",
    resolveMemberName: (tx) => `${tx.member.user.firstName} ${tx.member.user.lastName}`,
    community: { name: "Kings" },
    onRowClick: vi.fn(),
    ...over,
  };
}

describe("MemberPaymentsSection pagination", () => {
  const PAGED = {
    transactions: Array.from({ length: 8 }, (_, i) => TX(i + 1)),
    total: 14,
    page: 0,
    pageCount: 2,
  };

  it("hides the footer when there is a single page", () => {
    render(
      <MemberPaymentsSection {...baseProps({ transactions: [TX(1)], total: 1, pageCount: 1 })} />,
    );

    expect(screen.queryByText(/payments/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("shows the count and one button per page", () => {
    render(<MemberPaymentsSection {...baseProps(PAGED)} />);

    expect(screen.getByText("14 payments")).toBeDefined();
    expect(screen.getByRole("button", { name: "1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "2" })).toBeDefined();
  });

  it("calls onPageChange with the zero-based index", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<MemberPaymentsSection {...baseProps({ ...PAGED, onPageChange })} />);

    await user.click(screen.getByRole("button", { name: "2" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables Previous on page 0 and Next on the last page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <MemberPaymentsSection {...baseProps({ ...PAGED, onPageChange })} />,
    );

    expect(screen.getByRole("button", { name: "Previous page" }).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    rerender(<MemberPaymentsSection {...baseProps({ ...PAGED, page: 1, onPageChange })} />);
    expect(screen.getByRole("button", { name: "Next page" }).disabled).toBe(true);
  });

  it("windows the page list around the current page", () => {
    render(
      <MemberPaymentsSection
        {...baseProps({
          transactions: Array.from({ length: 8 }, (_, i) => TX(i + 1)),
          total: 80,
          page: 5,
          pageCount: 10,
        })}
      />,
    );

    // |i - 5| <= 2 → indexes 3–7, labels 4–8.
    expect(screen.getByRole("button", { name: "4" })).toBeDefined();
    expect(screen.getByRole("button", { name: "8" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "3" })).toBeNull();
    expect(screen.queryByRole("button", { name: "9" })).toBeNull();
  });
});

describe("MemberPaymentsSection filters", () => {
  it("opens the dropdown with plan and status options", async () => {
    const user = userEvent.setup();
    render(<MemberPaymentsSection {...baseProps()} />);

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    expect(screen.getByRole("menu", { name: "Filter payments" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "School Fees Support" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Paid" })).toBeDefined();
    expect(screen.getByRole("menuitem", { name: "Unpaid" })).toBeDefined();
  });

  it("emits onPlanFilterChange and closes the dropdown", async () => {
    const user = userEvent.setup();
    const onPlanFilterChange = vi.fn();
    render(<MemberPaymentsSection {...baseProps({ onPlanFilterChange })} />);

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await user.click(screen.getByRole("menuitem", { name: "School Fees Support" }));

    expect(onPlanFilterChange).toHaveBeenCalledWith("School Fees Support");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("emits onStatusFilterChange with the status code", async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = vi.fn();
    render(<MemberPaymentsSection {...baseProps({ onStatusFilterChange })} />);

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await user.click(screen.getByRole("menuitem", { name: "Paid" }));

    expect(onStatusFilterChange).toHaveBeenCalledWith("PAID");
  });

  it("toggles a selected plan off when clicked again", async () => {
    const user = userEvent.setup();
    const onPlanFilterChange = vi.fn();
    render(
      <MemberPaymentsSection
        {...baseProps({ planFilter: "School Fees Support", onPlanFilterChange })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Filter/ }));
    await user.click(screen.getByRole("menuitem", { name: "School Fees Support" }));

    expect(onPlanFilterChange).toHaveBeenCalledWith(null);
  });

  it("renders chips for active filters and Clear All empties them", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(
      <MemberPaymentsSection
        {...baseProps({ planFilter: "School Fees Support", statusFilter: "PAID", onClearFilters })}
      />,
    );

    expect(screen.getByText("School Fees Support")).toBeDefined();
    expect(screen.getByText("Paid")).toBeDefined();
    await user.click(screen.getByText("Clear All"));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it("removes a single plan chip without clearing status", async () => {
    const user = userEvent.setup();
    const onPlanFilterChange = vi.fn();
    render(
      <MemberPaymentsSection
        {...baseProps({
          planFilter: "School Fees Support",
          statusFilter: "PAID",
          onPlanFilterChange,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove School Fees Support filter" }));
    expect(onPlanFilterChange).toHaveBeenCalledWith(null);
  });

  it("renders no chips when nothing is filtered", () => {
    render(<MemberPaymentsSection {...baseProps()} />);

    expect(screen.queryByText("Clear All")).toBeNull();
  });
});
