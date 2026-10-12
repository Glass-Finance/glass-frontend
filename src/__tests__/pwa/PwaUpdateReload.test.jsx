import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import PwaUpdateReload from "../../pwa/PwaUpdateReload";
import { isReloadPending, requestReload, resetReloadState } from "../../pwa/updatePolicy";

// End-to-end for the deferral: a worker update arrives while the user is
// mid-payment, nothing reloads, and the moment they leave the payment route the
// reload fires. This is the guarantee that stops an update from stranding a
// payer -- their paymentPendingRef / paymentReturnTo live in sessionStorage
// (see docs/payments.md).

function Harness() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/member/home")}>
        leave payment
      </button>
      <PwaUpdateReload />
      <Routes>
        <Route path="/member/pay/:id" element={<div>payment</div>} />
        <Route path="/payment/callback" element={<div>callback</div>} />
        <Route path="/member/home" element={<div>home</div>} />
      </Routes>
    </>
  );
}

function renderAt(path, reload, pathname) {
  vi.spyOn(window, "location", "get").mockReturnValue({ ...window.location, reload, pathname });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>,
  );
}

describe("PwaUpdateReload", () => {
  let reload;

  beforeEach(() => {
    resetReloadState();
    reload = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetReloadState();
  });

  it("renders nothing of its own", () => {
    renderAt("/member/home", reload, "/member/home");
    expect(screen.getByText("home")).toBeTruthy();
    expect(screen.queryByText(/update/i)).toBeNull();
  });

  it("leaves a payment route alone when an update activates", () => {
    renderAt("/member/pay/abc", reload, "/member/pay/abc");
    requestReload();

    expect(reload).not.toHaveBeenCalled();
    expect(isReloadPending()).toBe(true);
  });

  it("reloads straight away when the activation happens off a payment route", () => {
    renderAt("/member/home", reload, "/member/home");
    requestReload();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(isReloadPending()).toBe(false);
  });

  it("applies the deferred reload as soon as the user leaves the payment flow", async () => {
    const user = userEvent.setup();
    renderAt("/member/pay/abc", reload, "/member/pay/abc");

    requestReload();
    expect(reload).not.toHaveBeenCalled();
    expect(isReloadPending()).toBe(true);

    // The route change is what releases the deferred reload.
    await user.click(screen.getByText("leave payment"));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(isReloadPending()).toBe(false);
  });

  it("still defers on the payment callback route", async () => {
    const user = userEvent.setup();
    renderAt("/payment/callback", reload, "/payment/callback");

    requestReload();
    expect(reload).not.toHaveBeenCalled();

    await user.click(screen.getByText("leave payment"));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
