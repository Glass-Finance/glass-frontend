import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardStats from "../../../../pages/dashboard/admin-dashboard/sections/DashboardStats";
import RecentActivityCard from "../../../../pages/dashboard/admin-dashboard/sections/RecentActivityCard";
import PaymentPlansCard from "../../../../pages/dashboard/admin-dashboard/sections/PaymentPlansCard";
import MemberPaymentsSection from "../../../../pages/dashboard/admin-dashboard/sections/MemberPaymentsSection";

// All four admin-dashboard sections are presentational: the parent passes
// props and owns no query. On a failed fetch the parent's arrays resolve to
// empty and `isLoading` flips false, so before these branches existed each
// section fell through to an empty/zero state that reads as real data
// ("No recent activity yet", a "0" contribution total) rather than a failure.

vi.mock("../../../../components/common/SkeletonUI", () => ({
  Skeleton: ({ className }) => <div data-testid="skeleton" className={className} />,
  ActivityIcon: () => <span />,
}));

const STAT = { label: "Total Members", value: "12", icon: "icon.png" };
const STATS = [STAT, { label: "Total Contributions", value: "₦5,000", icon: "icon.png" }];

describe("DashboardStats error branch", () => {
  it("shows the real stat values on a successful load", () => {
    render(<DashboardStats stats={STATS} isLoading={false} />);

    expect(screen.getByText("12")).toBeDefined();
    expect(screen.getByText("₦5,000")).toBeDefined();
    expect(screen.queryByText("Couldn't load")).toBeNull();
  });

  it("shows skeletons while loading and no error text", () => {
    render(<DashboardStats stats={STATS} isLoading />);

    expect(screen.queryByText("12")).toBeNull();
    expect(screen.queryByText("Couldn't load")).toBeNull();
    expect(screen.getAllByTestId("skeleton")).toHaveLength(STATS.length);
  });

  it("shows an error instead of falling through to a zero value", () => {
    render(<DashboardStats stats={STATS} isLoading={false} error={new Error("boom")} />);

    // The parent computes `String(members?.total ?? 0)` -- so without this
    // branch the cards would render "0" on failure.
    expect(screen.queryByText("12")).toBeNull();
    expect(screen.queryByText("₦5,000")).toBeNull();
    expect(screen.getAllByText("Couldn't load")).toHaveLength(STATS.length);
  });
});

describe("RecentActivityCard error branch", () => {
  it("shows items on a successful load", () => {
    render(<RecentActivityCard isLoading={false} items={[{ id: "a1", description: "paid" }]} />);

    expect(screen.getByText("paid")).toBeDefined();
  });

  it("distinguishes an empty community from a failed fetch", () => {
    render(<RecentActivityCard isLoading={false} items={[]} />);

    expect(screen.getByText("No recent activity yet")).toBeDefined();
    expect(screen.queryByText("Couldn't load recent activity.")).toBeNull();
  });

  it("shows an error instead of the empty state when the fetch fails", () => {
    render(<RecentActivityCard isLoading={false} items={[]} error={new Error("boom")} />);

    expect(screen.queryByText("No recent activity yet")).toBeNull();
    expect(screen.getByText("Couldn't load recent activity.")).toBeDefined();
  });
});

describe("PaymentPlansCard error branch", () => {
  const PLANS = [{ id: "p1", name: "Monthly Dues", amount: 5000, paidCount: 1, totalCount: 4 }];

  it("renders plan rows on a successful load", () => {
    render(<PaymentPlansCard plans={PLANS} plansLoading={false} onManageAll={vi.fn()} />);

    expect(screen.getByText("Monthly Dues")).toBeDefined();
  });

  it("distinguishes a community with no plans from a failed fetch", () => {
    render(<PaymentPlansCard plans={[]} plansLoading={false} onManageAll={vi.fn()} />);

    expect(screen.getByText("No payment plans yet")).toBeDefined();
  });

  it("shows an error instead of the empty plan card when the fetch fails", () => {
    render(
      <PaymentPlansCard
        plans={[]}
        plansLoading={false}
        error={new Error("boom")}
        onManageAll={vi.fn()}
      />,
    );

    expect(screen.queryByText("No payment plans yet")).toBeNull();
    expect(screen.getByText("Couldn't load payment plans.")).toBeDefined();
  });
});

describe("MemberPaymentsSection error branch", () => {
  const baseProps = {
    transactions: [],
    search: "",
    onSearchChange: vi.fn(),
    sortDir: "desc",
    onToggleSort: vi.fn(),
    onExport: vi.fn(),
    isExporting: false,
    communityId: "community-1",
    resolveMemberName: () => null,
    community: {},
    onRowClick: vi.fn(),
  };

  it("renders transaction rows on a successful load", () => {
    render(
      <MemberPaymentsSection
        {...baseProps}
        transactions={[{ id: "t1", status: "SUCCESSFUL", amount: 5000 }]}
      />,
    );

    expect(screen.queryByText("No transactions found")).toBeNull();
    expect(screen.queryByText("Couldn't load member payments.")).toBeNull();
  });

  it("distinguishes a community with no payments from a failed fetch", () => {
    render(<MemberPaymentsSection {...baseProps} />);

    expect(screen.getByText("No transactions found")).toBeDefined();
    expect(screen.queryByText("Couldn't load member payments.")).toBeNull();
  });

  it("shows an error row instead of the empty row when the fetch fails", () => {
    render(<MemberPaymentsSection {...baseProps} error={new Error("boom")} />);

    expect(screen.queryByText("No transactions found")).toBeNull();
    expect(screen.getByText("Couldn't load member payments.")).toBeDefined();
  });
});
