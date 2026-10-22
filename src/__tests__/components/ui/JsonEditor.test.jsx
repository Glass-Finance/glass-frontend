import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EditorView } from "@uiw/react-codemirror";
import JsonEditor from "../../../components/ui/JsonEditor";

// jsdom does not implement text layout, which CodeMirror measures after edits.
beforeAll(() => {
  Range.prototype.getClientRects ??= () => [];
  Range.prototype.getBoundingClientRect ??= () => ({
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Fixture({ initial = "{}" }) {
  const [value, setValue] = useState(initial);
  return <JsonEditor id="schedule" label="Schedule JSON" value={value} onChange={setValue} />;
}

function editorView() {
  return EditorView.findFromDOM(screen.getByRole("textbox", { name: "Schedule JSON" }));
}

describe("JsonEditor", () => {
  it("provides a labelled editor with line numbers and coloured JSON tokens", async () => {
    render(<Fixture initial={'{"rate":1.5,"active":true,"name":"Dues"}'} />);
    expect(screen.getByRole("textbox", { name: "Schedule JSON" })).toBeDefined();
    expect(document.querySelector(".cm-lineNumbers")).not.toBeNull();
    await waitFor(() =>
      expect(document.querySelectorAll(".cm-line span").length).toBeGreaterThan(3),
    );
  });

  it("formats valid JSON after typing, keeping the cursor inside the same string", async () => {
    vi.useFakeTimers();
    render(<Fixture />);
    const view = editorView();
    const input = '{"name":"Hello world","rate":1.5}';
    act(() =>
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: input },
        selection: { anchor: input.indexOf("world") + 2 },
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    const formatted = JSON.stringify(JSON.parse(input), null, 2);
    expect(view.state.doc.toString()).toBe(formatted);
    expect(view.state.selection.main.head).toBe(formatted.indexOf("world") + 2);
  });

  it("leaves incomplete JSON untouched while typing", async () => {
    vi.useFakeTimers();
    render(<Fixture />);
    const view = editorView();
    act(() => view.dispatch({ changes: { from: 0, to: 2, insert: '{"rate":' } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(view.state.doc.toString()).toBe('{"rate":');
  });

  it("preserves numeric literals, escaped strings, duplicate keys, and property order", () => {
    const input = '{"2":9007199254740993,"1":1e400,"name":"\\u0061","name":"a"}';
    render(<Fixture initial={input} />);
    fireEvent.click(screen.getByRole("button", { name: "Format JSON" }));
    expect(editorView().state.doc.toString()).toBe(
      '{\n  "2": 9007199254740993,\n  "1": 1e400,\n  "name": "\\u0061",\n  "name": "a"\n}',
    );
  });

  it("lets Undo reach the user's edit and does not reformat an undone document", async () => {
    vi.useFakeTimers();
    const original = '{"rate":1}';
    render(<Fixture initial={original} />);
    const view = editorView();
    act(() =>
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '{"rate":2}' } }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "z", ctrlKey: true });
    expect(view.state.doc.toString()).toBe('{"rate":2}');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(view.state.doc.toString()).toBe('{"rate":2}');
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "z", ctrlKey: true });
    expect(view.state.doc.toString()).toBe(original);
  });

  it("restarts the formatting delay when typing continues", async () => {
    vi.useFakeTimers();
    render(<Fixture />);
    const view = editorView();
    act(() => view.dispatch({ changes: { from: 0, to: 2, insert: '{"rate":1}' } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    act(() => view.dispatch({ changes: { from: 8, to: 9, insert: "2" } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(view.state.doc.toString()).toBe('{"rate":2}');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(view.state.doc.toString()).toBe('{\n  "rate": 2\n}');
  });

  it("formats on demand without submitting its parent form", () => {
    const submit = vi.fn();
    render(
      <form onSubmit={submit}>
        <Fixture initial={'{"rate":1.5}'} />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Format JSON" }));
    expect(editorView().state.doc.toString()).toBe('{\n  "rate": 1.5\n}');
    expect(submit).not.toHaveBeenCalled();
  });
});
