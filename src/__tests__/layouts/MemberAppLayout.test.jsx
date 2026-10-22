import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MemberAppLayout from "../../layouts/MemberAppLayout";
import { useAuth } from "../../store/AuthContext";

vi.mock("../../store/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../components/memberApp/InvitePopup", () => ({ default: () => null }));
vi.mock("../../utils/toast", () => ({ toastSuccess: vi.fn() }));

afterEach(cleanup);

function renderMemberLayout({ path = "/member/transactions", isAdmin = false } = {}) {
  useAuth.mockReturnValue({
    user: {
      email: "member@example.com",
      firstName: "Casey",
      lastName: "Member",
    },
    isAdmin,
    logout: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/member" element={<MemberAppLayout />}>
          <Route path="transactions" element={<div>Transaction list</div>} />
          <Route path="home" element={<div>Member overview</div>} />
        </Route>
        <Route path="/dashboard/home" element={<div>Admin dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("MemberAppLayout", () => {
  it("renders the desktop navigation and keeps the mobile tab bar available", () => {
    renderMemberLayout();

    expect(screen.getByRole("complementary", { name: "Member app navigation" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Payment history" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("navigation", { name: "Main navigation" }).className).toContain(
      "md:hidden",
    );
    expect(screen.getByText("Transaction list")).toBeTruthy();
  });

  it("keeps the admin dashboard shortcut for members who also administer a community", () => {
    renderMemberLayout({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Admin dashboard" })).toBeTruthy();
  });
});
