import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CrispRouteBridge from "../../../components/common/CrispRouteBridge";

const { crisp } = vi.hoisted(() => ({
  crisp: {
    chat: { hide: vi.fn(), show: vi.fn() },
    session: { setData: vi.fn() },
  },
}));

vi.mock("crisp-sdk-web", () => ({ Crisp: crisp }));

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CrispRouteBridge />
    </MemoryRouter>,
  );

describe("CrispRouteBridge", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_CRISP_WEBSITE_ID", "test-website-id");
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each([
    "/onboarding/payment-profile",
    "/dashboard/verify-identity",
    "/dashboard/verify-identity/history",
    "/member/verify-identity",
    "/member/pay/abc-123",
    "/member/pay/abc-123/success",
    "/payment/callback",
    "/dashboard/settings/finance/payment-methods",
    "/member/saved-cards",
  ])("hides the chat on %s", (path) => {
    renderAt(path);
    expect(crisp.chat.hide).toHaveBeenCalled();
    expect(crisp.chat.show).not.toHaveBeenCalled();
  });

  // The sensitive deny-list wins even inside the allowed Settings area.
  it("hides the chat on payment-methods inside settings", () => {
    renderAt("/dashboard/settings/finance/payment-methods");
    expect(crisp.chat.hide).toHaveBeenCalled();
    expect(crisp.chat.show).not.toHaveBeenCalled();
  });

  it.each(["/dashboard/home", "/member/transactions", "/sign-in", "/onboarding/choose-path"])(
    "hides the chat in the signed-in app on %s",
    (path) => {
      renderAt(path);
      expect(crisp.chat.hide).toHaveBeenCalled();
      expect(crisp.chat.show).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/",
    "/members",
    "/invite",
    "/invites",
    "/privacy",
    "/terms",
    "/cookies",
    "/acceptable-use",
    "/refund-policy",
    "/dashboard/settings",
    "/dashboard/settings/account/profile",
    "/member/settings",
  ])("shows the chat on %s", (path) => {
    renderAt(path);
    expect(crisp.chat.show).toHaveBeenCalled();
    expect(crisp.chat.hide).not.toHaveBeenCalled();
  });

  it("hides the chat while the dashboard mobile drawer is open", () => {
    renderAt("/");
    vi.clearAllMocks();

    act(() => {
      window.dispatchEvent(new CustomEvent("glass:dashboard-mobile-drawer", { detail: true }));
    });

    expect(crisp.chat.hide).toHaveBeenCalled();
    expect(crisp.chat.show).not.toHaveBeenCalled();
  });

  it("re-shows the chat on allowed pages after the drawer closes", () => {
    renderAt("/");

    act(() => {
      window.dispatchEvent(new CustomEvent("glass:dashboard-mobile-drawer", { detail: true }));
    });
    vi.clearAllMocks();

    act(() => {
      window.dispatchEvent(new CustomEvent("glass:dashboard-mobile-drawer", { detail: false }));
    });

    expect(crisp.chat.show).toHaveBeenCalled();
    expect(crisp.chat.hide).not.toHaveBeenCalled();
  });

  it("keeps the chat hidden on sensitive pages after the drawer closes", () => {
    renderAt("/dashboard/verify-identity");

    act(() => {
      window.dispatchEvent(new CustomEvent("glass:dashboard-mobile-drawer", { detail: true }));
    });
    vi.clearAllMocks();

    act(() => {
      window.dispatchEvent(new CustomEvent("glass:dashboard-mobile-drawer", { detail: false }));
    });

    expect(crisp.chat.hide).toHaveBeenCalled();
    expect(crisp.chat.show).not.toHaveBeenCalled();
  });

  it("pushes the current page as agent context, debounced", () => {
    renderAt("/member/transactions");
    expect(crisp.session.setData).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(crisp.session.setData).toHaveBeenCalledWith({
      page: "/member/transactions",
    });
  });

  it("does nothing when the chat is disabled", () => {
    vi.stubEnv("VITE_CRISP_WEBSITE_ID", "");
    renderAt("/dashboard/home");
    vi.advanceTimersByTime(400);
    expect(crisp.chat.show).not.toHaveBeenCalled();
    expect(crisp.chat.hide).not.toHaveBeenCalled();
    expect(crisp.session.setData).not.toHaveBeenCalled();
  });
});
