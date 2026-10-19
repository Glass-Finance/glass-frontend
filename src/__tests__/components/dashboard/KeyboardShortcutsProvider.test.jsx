import { useMemo } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import KeyboardShortcutsProvider from "../../../components/dashboard/KeyboardShortcutsProvider";
import {
  useRegisterShortcut,
  useRegisterShortcutGroup,
  useEscapeToClose,
} from "../../../hooks/useKeyboardShortcuts";

afterEach(cleanup);

function press(key, opts = {}) {
  fireEvent.keyDown(document, { key, ...opts });
}

function Probe({ onA, onEscape }) {
  useRegisterShortcut("a", "Do A", onA);
  useEscapeToClose(onEscape);
  return <input aria-label="text-field" />;
}

function renderProbe(props = {}) {
  return render(
    <KeyboardShortcutsProvider>
      <Probe {...props} />
    </KeyboardShortcutsProvider>,
  );
}

describe("KeyboardShortcutsProvider — single-key shortcuts", () => {
  it("fires a registered single-key shortcut", () => {
    const onA = vi.fn();
    renderProbe({ onA });
    press("a");
    expect(onA).toHaveBeenCalledTimes(1);
  });

  it("does not fire while an input is focused", () => {
    const onA = vi.fn();
    renderProbe({ onA });
    screen.getByLabelText("text-field").focus();
    press("a");
    expect(onA).not.toHaveBeenCalled();
  });

  it("ignores the shortcut when a modifier key is held", () => {
    const onA = vi.fn();
    renderProbe({ onA });
    press("a", { ctrlKey: true });
    press("a", { metaKey: true });
    press("a", { altKey: true });
    expect(onA).not.toHaveBeenCalled();
  });
});

describe("KeyboardShortcutsProvider — Escape", () => {
  it("still fires Escape even while an input is focused", () => {
    const onEscape = vi.fn();
    renderProbe({ onEscape });
    screen.getByLabelText("text-field").focus();
    press("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("closes only the most recently registered Escape handler", () => {
    const first = vi.fn();
    const second = vi.fn();
    function TwoModals() {
      useEscapeToClose(first);
      useEscapeToClose(second);
      return null;
    }
    render(
      <KeyboardShortcutsProvider>
        <TwoModals />
      </KeyboardShortcutsProvider>,
    );
    press("Escape");
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("does not fire once the modal is no longer active", () => {
    const onEscape = vi.fn();
    function Toggleable({ active }) {
      useEscapeToClose(onEscape, active);
      return null;
    }
    const { rerender } = render(
      <KeyboardShortcutsProvider>
        <Toggleable active={false} />
      </KeyboardShortcutsProvider>,
    );
    press("Escape");
    expect(onEscape).not.toHaveBeenCalled();

    rerender(
      <KeyboardShortcutsProvider>
        <Toggleable active={true} />
      </KeyboardShortcutsProvider>,
    );
    press("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});

describe("KeyboardShortcutsProvider — chords", () => {
  function ChordProbe({ onGoHome }) {
    // useMemo here isn't incidental -- useRegisterShortcutGroup re-registers
    // whenever its `bindings` array reference changes, and a fresh inline
    // array literal here would be a new reference every render, including
    // the very re-render its own registration triggers (the provider's
    // context value changes when the registry grows). That's a genuine
    // infinite loop, not just wasted work -- reproduced it while writing
    // this test, matching the real Sidebar.jsx/PlatformAdmin.jsx usage.
    const bindings = useMemo(
      () => [{ keys: "g h", description: "Go to Home", handler: onGoHome }],
      [onGoHome],
    );
    useRegisterShortcutGroup(bindings, "Navigation");
    return <input aria-label="text-field" />;
  }

  it("fires a 'g h' chord typed in sequence", () => {
    const onGoHome = vi.fn();
    render(
      <KeyboardShortcutsProvider>
        <ChordProbe onGoHome={onGoHome} />
      </KeyboardShortcutsProvider>,
    );
    press("g");
    press("h");
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it("does not fire the chord's second half on its own", () => {
    const onGoHome = vi.fn();
    render(
      <KeyboardShortcutsProvider>
        <ChordProbe onGoHome={onGoHome} />
      </KeyboardShortcutsProvider>,
    );
    press("h");
    expect(onGoHome).not.toHaveBeenCalled();
  });

  it("never arms a chord while typing in a field", () => {
    const onGoHome = vi.fn();
    render(
      <KeyboardShortcutsProvider>
        <ChordProbe onGoHome={onGoHome} />
      </KeyboardShortcutsProvider>,
    );
    screen.getByLabelText("text-field").focus();
    press("g");
    press("h");
    expect(onGoHome).not.toHaveBeenCalled();
  });
});

describe("KeyboardShortcutsProvider — help overlay pausing other shortcuts", () => {
  it("toggles help open/closed on '?' and suppresses other shortcuts meanwhile", async () => {
    const onA = vi.fn();
    const { useShortcutsHelp } = await import("../../../hooks/useKeyboardShortcuts");
    function HelpAwareProbe() {
      const { open } = useShortcutsHelp();
      useRegisterShortcut("a", "Do A", onA);
      return <div data-testid="help-state">{open ? "open" : "closed"}</div>;
    }
    render(
      <KeyboardShortcutsProvider>
        <HelpAwareProbe />
      </KeyboardShortcutsProvider>,
    );
    expect(screen.getByTestId("help-state").textContent).toBe("closed");

    press("?");
    expect(screen.getByTestId("help-state").textContent).toBe("open");

    press("a");
    expect(onA).not.toHaveBeenCalled();

    press("?");
    expect(screen.getByTestId("help-state").textContent).toBe("closed");

    press("a");
    expect(onA).toHaveBeenCalledTimes(1);
  });
});

it("pauses dashboard navigation and help inside an accessible modal while retaining Escape", async () => {
  const { default: GlassModal } = await import("../../../components/common/GlassModal");
  const { useShortcutsHelp } = await import("../../../hooks/useKeyboardShortcuts");
  const navigate = vi.fn();
  const close = vi.fn();
  function ModalProbe({ open }) {
    const { open: helpOpen } = useShortcutsHelp();
    useRegisterShortcutGroup(
      useMemo(() => [{ keys: "g h", description: "Home", handler: navigate }], []),
    );
    return (
      <>
        <p>{helpOpen ? "Help opened" : "Help closed"}</p>
        <GlassModal
          open={open}
          title="Dirty draft"
          onClose={close}
          footer={<button type="button">Keep editing</button>}
        >
          Draft
        </GlassModal>
      </>
    );
  }
  const { rerender } = render(
    <KeyboardShortcutsProvider>
      <ModalProbe open />
    </KeyboardShortcutsProvider>,
  );
  screen.getByRole("button", { name: "Keep editing" }).focus();
  press("g");
  press("h");
  press("?");
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByText("Help closed")).toBeTruthy();
  press("Escape");
  expect(close).toHaveBeenCalledTimes(1);
  rerender(
    <KeyboardShortcutsProvider>
      <ModalProbe open={false} />
    </KeyboardShortcutsProvider>,
  );
  press("g");
  press("h");
  expect(navigate).toHaveBeenCalledTimes(1);
});
