import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  page: 1,
  hidden: false,
  mutation: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../../hooks/useRecordImportRows", () => ({
  useRecordImportRows: (_c, _j, params) => ({
    data: {
      content: state.hidden
        ? []
        : [
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

it("preserves staged bulk field changes when a background update freezes review", async () => {
  const job = { id: "j", status: "READY_FOR_REVIEW", reviewTotals: { VALID: 2 } };
  const { rerender } = render(<ImportReview communityId="c" job={job} />);
  fireEvent.click(screen.getAllByLabelText("Select record Payer 1")[0]);
  fireEvent.click(screen.getByRole("button", { name: "Edit selected" }));
  fireEvent.change(screen.getByLabelText("New value"), {
    target: { value: "Retain this bulk correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add field change" }));
  rerender(<ImportReview communityId="c" job={{ ...job, status: "COMMIT_QUEUED" }} frozen />);
  expect(screen.getByText("Description: Retain this bulk correction")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Review changes" }).disabled).toBe(true);
});

it("blocks a dirty editor when its row disappears from the refreshed filtered page", () => {
  const job = { id: "j", status: "READY_FOR_REVIEW", reviewTotals: { VALID: 2 } };
  const { rerender } = render(<ImportReview communityId="c" job={job} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Edit record" }));
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "35" } });
  state.hidden = true;
  rerender(<ImportReview communityId="c" job={{ ...job }} />);
  expect(screen.getByRole("button", { name: "Save changes" }).disabled).toBe(true);
  expect(screen.getByLabelText("Amount").value).toBe("35");
  state.hidden = false;
});
