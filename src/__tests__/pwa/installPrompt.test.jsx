import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallPromptProvider, useInstallPrompt } from "../../hooks/useInstallPrompt";

// This repo has no jest-dom matchers (@testing-library/jest-dom is not a
// dependency) -- assertions below use plain DOM reads.
function TestComponent() {
  const { isInstallable, isInstalled, install } = useInstallPrompt();
  return (
    <div>
      <span data-testid="installable">{String(isInstallable)}</span>
      <span data-testid="installed">{String(isInstalled)}</span>
      <button type="button" onClick={install}>
        Install
      </button>
    </div>
  );
}

function renderInstallProvider() {
  return render(
    <InstallPromptProvider>
      <TestComponent />
    </InstallPromptProvider>,
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is not installable by default", () => {
    renderInstallProvider();
    expect(screen.getByTestId("installable").textContent).toBe("false");
  });

  it("becomes installable when beforeinstallprompt fires", () => {
    renderInstallProvider();
    firePromptEvent(listeners, "beforeinstallprompt", {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    expect(screen.getByTestId("installable").textContent).toBe("true");
  });

  it("calls prompt() when install is invoked", async () => {
    const user = userEvent.setup();
    renderInstallProvider();
    const prompt = vi.fn().mockResolvedValue(undefined);
    firePromptEvent(listeners, "beforeinstallprompt", {
      preventDefault: vi.fn(),
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    await user.click(screen.getByText("Install"));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("installed").textContent).toBe("true");
    expect(screen.getByTestId("installable").textContent).toBe("false");
  });

  it("hides when appinstalled fires", () => {
    renderInstallProvider();
    firePromptEvent(listeners, "beforeinstallprompt", {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    expect(screen.getByTestId("installable").textContent).toBe("true");
    firePromptEvent(listeners, "appinstalled");
    expect(screen.getByTestId("installable").textContent).toBe("false");
  });

  it("does not require localStorage", () => {
    renderInstallProvider();
    expect(screen.getByTestId("installable").textContent).toBe("false");
  });
});
