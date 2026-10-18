import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ page: 1, mutation: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../../hooks/useRecordImportRows", () => ({
  useRecordImportRows: (_c, _j, params) => ({
    data: {
      content: [
        {
          id: `r${params.pageNumber}`,
          payerName: `Payer ${params.pageNumber}`,
          amount: 25,
          currency: "NGN",
          reviewStatus: "VALID",
        },
      ],
      totalPages: 2,
      totalElements: 2,
    },
    refetch: vi.fn(),
  }),
  useImportRowMutation: () => ({ mutateAsync: state.mutation }),
}));
vi.mock("../../../../hooks/useCommunityMembers", () => ({
  useCommunityMembers: () => ({ members: [] }),
}));
import ImportReview from "../../../../pages/dashboard/records/ImportReview";
describe("explicit review selection", () => {
  it("keeps only explicitly selected row IDs across pages", async () => {
    render(
      <ImportReview
        communityId="c"
        job={{ id: "j", status: "READY_FOR_REVIEW", reviewTotals: { VALID: 2 } }}
      />,
    );
    fireEvent.click(screen.getAllByLabelText("Select record Payer 1")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Next", exact: true }));
    fireEvent.click(screen.getAllByLabelText("Select record Payer 2")[0]);
    expect(screen.getByText(/2 selected/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Skip selected" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply to 2 selected records" }));
    await waitFor(() =>
      expect(state.mutation).toHaveBeenCalledWith({
        payload: { rowIds: ["r1", "r2"], patch: { skip: true } },
      }),
    );
    expect(screen.getByText(/0 selected/)).toBeTruthy();
  });
});
