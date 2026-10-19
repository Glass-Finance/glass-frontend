import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
vi.mock("../../../../hooks/useCommunityRecords", () => ({
  useCommunityRecord: () => ({
    data: { id: "r1", source: "PLATFORM", transactionId: "tx/1", amount: 25, currency: "NGN" },
  }),
}));
import RecordDetailPanel from "../../../../pages/dashboard/records/RecordDetailPanel";
function Destination() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}
it("opens the original transaction with a button and preserves community context", () => {
  render(
    <MemoryRouter initialEntries={["/records"]}>
      <Routes>
        <Route
          path="/records"
          element={
            <RecordDetailPanel
              communityId="c"
              identifier="my community"
              recordId="r1"
              onClose={() => {}}
            />
          }
        />
        <Route path="/dashboard/transactions/:id" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "View original transaction" }));
  expect(screen.getByText("/dashboard/transactions/tx%2F1?community=my%20community")).toBeTruthy();
});
