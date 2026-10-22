import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import CheckEmail from "../../../../pages/auth/member/CheckEmail";

// Isolates this test to exactly the logic CheckEmail.jsx itself owns (the
// email ? ... : ... branch) rather than coupling it to buildMobileUrl's own
// separate concern of resolving APP_ORIGIN, which depends on env config
// this test shouldn't need to know about.
vi.mock("../../../../utils/deviceRedirect", () => ({
  buildMobileUrl: (path) => `MOCKED_ORIGIN${path}`,
}));

// QRCodeCanvas draws to an actual <canvas> asynchronously -- not something
// worth asserting pixels against here. Stubbed to just expose the `value`
// it was given, which is the only thing this test cares about.
vi.mock("../../../../components/common/QRCodeCanvas", () => ({
  default: ({ value }) => <div data-testid="qr-value">{value}</div>,
}));

function renderWithEmail(email) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/check-email", state: email ? { email } : undefined }]}
    >
      <Routes>
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/member/join" element={<JoinLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

function JoinLocation() {
  const location = useLocation();
  return <div data-testid="join-location">{location.pathname + location.search}</div>;
}

describe("CheckEmail's QR target", () => {
  it("includes the email as a query param when one was passed in router state", () => {
    renderWithEmail("sulaimon@example.com");
    expect(screen.getByTestId("qr-value").textContent).toBe(
      "MOCKED_ORIGIN/member/join?email=sulaimon%40example.com",
    );
  });

  it("URL-encodes special characters in the email", () => {
    renderWithEmail("first+last@example.com");
    expect(screen.getByTestId("qr-value").textContent).toBe(
      "MOCKED_ORIGIN/member/join?email=first%2Blast%40example.com",
    );
  });

  it("falls back to a bare /member/join when no email is in router state", () => {
    renderWithEmail(null);
    expect(screen.getByTestId("qr-value").textContent).toBe("MOCKED_ORIGIN/member/join");
  });

  it("lets someone continue the passwordless sign-in on this device", () => {
    renderWithEmail("sulaimon@example.com");
    fireEvent.click(screen.getByRole("button", { name: "Continue on this device" }));
    expect(screen.getByTestId("join-location").textContent).toBe(
      "/member/join?email=sulaimon%40example.com",
    );
  });
});
