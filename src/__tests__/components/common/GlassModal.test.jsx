import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import GlassModal from "../../../components/common/GlassModal";

afterEach(cleanup);

function renderModal(props = {}) {
  const onClose = vi.fn();
  const utils = render(
    <GlassModal
      onClose={onClose}
      title="Test modal"
      label="Test modal"
      footer={<button type="button">Primary</button>}
      {...props}
    >
      <p>Body content</p>
    </GlassModal>,
  );
  return { onClose, ...utils };
}

describe("GlassModal", () => {
  it("renders a labelled dialog with body and fixed footer actions", () => {
    renderModal();
    expect(screen.getByRole("dialog", { name: "Test modal" })).toBeTruthy();
    expect(screen.getByText("Body content")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Primary" })).toBeTruthy();
  });

  it("closes on Escape", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click but not from clicks inside the panel", () => {
    const { onClose } = renderModal();
    const backdrop = screen.getByRole("dialog").parentElement;
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("suspends Escape and hides the close button while closeDisabled", () => {
    const { onClose } = renderModal({ closeDisabled: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Close")).toBeNull();
    const backdrop = screen.getByRole("dialog").parentElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("locks background scroll while open", () => {
    const { unmount } = renderModal();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

it("keeps keyboard focus inside from the initial dialog and restores the trigger on close", () => {
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const { unmount } = renderModal();
  const dialog = screen.getByRole("dialog");
  const first = screen.getByRole("button", { name: "Close" });
  const last = screen.getByRole("button", { name: "Primary" });
  // jsdom has no layout: make the visible controls measurable for the trap.
  for (const node of [first, last]) Object.defineProperty(node, "offsetParent", { value: dialog });
  expect(document.activeElement).toBe(dialog);
  fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(window, { key: "Tab" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  unmount();
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});
