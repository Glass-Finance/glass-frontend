import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyCommunities from "../../../pages/memberApp/settings/communities/MyCommunities";
import { useLeaveCommunity, useMyCommunities } from "../../../hooks/useMyAccount";
import { useKycGate } from "../../../hooks/useKycGate";

vi.mock("../../../hooks/useMyAccount");
vi.mock("../../../hooks/useKycGate");
vi.mock("../../../utils/communityRole", () => ({ resolveIsPayingAdmin: vi.fn() }));
vi.mock("../../../components/kyc/KycWizardModal", () => ({ default: () => null }));

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateSpy };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <MyCommunities />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateSpy.mockClear();
  useMyCommunities.mockReturnValue({ data: [], isLoading: false });
  useLeaveCommunity.mockReturnValue({ mutate: vi.fn(), isPending: false });
  useKycGate.mockReturnValue({
    enforce: (continueAction) => continueAction(),
    isLoading: false,
    gateOpen: false,
    closeGate: vi.fn(),
    completeGate: vi.fn(),
  });
});

describe("MyCommunities desktop view", () => {
  it("shows the community empty state and links to invitations", () => {
    renderPage();

    expect(screen.getByText("You're not in a community yet")).toBeTruthy();
    expect(screen.getByText("You haven't joined any communities yet")).toBeTruthy();
    expect(
      screen.getByText(/Communities are how Glass brings your association, club or group together/),
    ).toBeTruthy();
    expect(screen.getByText("Start your own, or join one you've been invited to.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "View invitations" })[0]);
    expect(navigateSpy).toHaveBeenCalledWith("/member/invites");
  });

  it("shows membership counts, filters cards by role, and opens the community menu", () => {
    useMyCommunities.mockReturnValue({
      data: [
        { id: "admin-id", slug: "admins", name: "Admin Community", owned: true, memberCount: 24 },
        { id: "member-id", slug: "members", name: "Member Community", owned: false },
      ],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByRole("button", { name: "All · 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Admin · 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Member · 1" })).toBeTruthy();
    const adminFilter = screen.getByRole("button", { name: "Admin · 1" });
    fireEvent.click(adminFilter);
    expect(adminFilter.getAttribute("aria-pressed")).toBe("true");
    const [adminCard] = screen.getAllByRole("article");
    expect(adminCard.textContent).toContain("Admin Community");
    expect(adminCard.textContent).not.toContain("Member Community");

    fireEvent.click(
      within(adminCard).getByRole("button", { name: "More options for Admin Community" }),
    );
    expect(within(adminCard).getByRole("button", { name: "View details" })).toBeTruthy();
  });
});
