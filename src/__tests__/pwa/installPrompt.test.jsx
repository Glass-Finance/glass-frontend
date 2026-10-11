import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";

// This repo has no jest-dom matchers (@testing-library/jest-dom is not a
// dependency) -- assertions below use plain DOM reads.
function TestComponent() {
  const { isInstallable, install, dismiss } = useInstallPrompt();
  return (
    <div>
      <span data-testid="installable">{String(isInstallable)}</span>
      <button type="button" onClick={install}>
        Install
      </button>
      <button type="button" onClick={dismiss}>
        Dismiss
      </button>
    </div>
  );
}

function firePromptEvent(listeners, name, detail = {}) {
  act(() => {
    listeners[name](detail);
  });
}

describe("useInstallPrompt", () => {
  let listeners;

  beforeEach(() => {
    listeners = {};
    vi.stubGlobal("addEventListener", (event, cb) => {
      listeners[event] = cb;
    });
    vi.stubGlobal("removeEventListener", () => {});
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is not installable by default", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("installable").textContent).toBe("false");
  });

  it("becomes installable when beforeinstallprompt fires", () => {
    render(<TestComponent />);
    firePromptEvent(listeners, "beforeinstallprompt", {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    expect(screen.getByTestId("installable").textContent).toBe("true");
  });

  it("calls prompt() when install is invoked", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    firePromptEvent(listeners, "beforeinstallprompt", {
      preventDefault: vi.fn(),
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    await user.click(screen.getByText("Install"));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it("dismisses the prompt and persists the dismissal", async () => {
    const user = userEvent.setup();
    render(<TestComponent />);
    firePromptEvent(listeners, "beforeinstallprompt", {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    await user.click(screen.getByText("Dismiss"));
    expect(screen.getByTestId("installable").textContent).toBe("false");
    expect(localStorage.getItem("pwa_install_dismissed")).toBe("1");
  });

  it("stays dismissed across a remount", () => {
    render(<TestComponent />);
    firePromptEvent(listeners, "beforeinstallprompt", {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    act(() => {
      fireEvent.click(screen.getByText("Dismiss"));
    });
    render(<TestComponent />);
    expect(screen.getAllByTestId("installable")[1].textContent).toBe("false");
  });

  it("hides when appinstalled fires", () => {
    render(<TestComponent />);
    firePromptEvent(listeners, "beforeinstallprompt", {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    expect(screen.getByTestId("installable").textContent).toBe("true");
    firePromptEvent(listeners, "appinstalled");
    expect(screen.getByTestId("installable").textContent).toBe("false");
  });

  it("does not throw when localStorage is unavailable", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    render(<TestComponent />);
    expect(screen.getByTestId("installable").textContent).toBe("false");
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
