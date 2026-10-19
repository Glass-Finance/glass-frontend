import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("../../../../hooks/useCommunityMembers", () => ({
  useCommunityMembers: () => ({
    members: [
      {
        id: "membership-1",
        userId: "user-1",
        firstName: "Ada",
        lastName: "Example",
        memberRef: "0001",
      },
    ],
  }),
}));
import RecordFormModal from "../../../../pages/dashboard/records/RecordFormModal";
describe("record form", () => {
  it("sends explicit clearing but never overwrites untouched metadata", async () => {
    const save = vi.fn().mockResolvedValue({});
    render(
      <RecordFormModal
        communityId="c"
        record={{
          id: "r",
          recordType: "EXPENSE",
          direction: "OUTFLOW",
          occurredOn: "2026-01-01",
          amount: 25,
          currency: "NGN",
          description: "old",
        }}
        onSave={save}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Additional details"));
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ description: null }));
  });
  it("retains a failed save and uses membership IDs with editable snapshots", async () => {
    const save = vi
      .fn()
      .mockRejectedValue({ response: { data: { description: "Check this record" } } });
    render(
      <RecordFormModal communityId="c" defaultCurrency="NGN" onSave={save} onClose={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText("Member (optional)"), {
      target: { value: "membership-1" },
    });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1250.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Add record" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Check this record"),
    );
    expect(save.mock.calls[0][0]).toMatchObject({
      memberId: "membership-1",
      payerName: "Ada Example",
      payerReference: "0001",
      amount: 1250.5,
    });
    expect(screen.getByLabelText("Amount").value).toBe("1250.50");
  });
});

it("provides a labelled dialog and puts discard confirmation in the fixed footer", () => {
  const close = vi.fn();
  render(<RecordFormModal communityId="c" onSave={vi.fn()} onClose={close} />);
  const dialog = screen.getByRole("dialog", { name: "Add record" });
  expect(document.activeElement).toBe(dialog);
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "25" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(close).not.toHaveBeenCalled();
  const discard = screen.getByRole("button", { name: "Discard changes" });
  expect(dialog.querySelector("form").contains(discard)).toBe(false);
  expect(screen.queryByRole("button", { name: "Add record" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Amount").value).toBe("25");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(close).toHaveBeenCalledTimes(1);
});
