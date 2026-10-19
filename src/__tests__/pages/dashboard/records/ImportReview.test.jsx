import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  page: 1,
  hidden: false,
  requests: [],
  mutation: vi.fn().mockResolvedValue([]),
}));
vi.mock("../../../../hooks/useRecordImportRows", () => ({
  useRecordImportRows: (_c, _j, params) => {
    state.requests.push(params);
    return {
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
    };
  },
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
    expect(screen.queryByRole("button", { name: "Skip selected" })).toBeNull();
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

it("keeps bulk actions out of the way until rows are selected", () => {
  render(
    <ImportReview
      communityId="c"
      job={{ id: "j", status: "READY_FOR_REVIEW", reviewTotals: { VALID: 2 } }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Skip selected" })).toBeNull();
  fireEvent.click(screen.getAllByLabelText("Select record Payer 1")[0]);
  expect(screen.getByRole("button", { name: "Skip selected" })).toBeTruthy();
});

it("omits default search and only submits the debounced literal text", async () => {
  state.requests = [];
  render(
    <ImportReview
      communityId="c"
      job={{ id: "j", status: "READY_FOR_REVIEW", reviewTotals: { VALID: 2 } }}
    />,
  );
  expect(Object.hasOwn(state.requests.at(-1), "search")).toBe(false);
  fireEvent.change(screen.getByLabelText("Review status"), { target: { value: "INVALID" } });
  expect(state.requests.at(-1).reviewStatus).toBe("INVALID");
  fireEvent.change(screen.getByLabelText("Search records"), { target: { value: "%_! dues" } });
  await waitFor(() => expect(state.requests.at(-1).search).toBe("%_! dues"));
  fireEvent.change(screen.getByLabelText("Search records"), { target: { value: "" } });
  await waitFor(() => expect(Object.hasOwn(state.requests.at(-1), "search")).toBe(false));
});
