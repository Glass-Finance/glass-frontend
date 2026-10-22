import { useEffect, useMemo, useRef } from "react";
import CodeMirror, { EditorView, Transaction } from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import { diff } from "@codemirror/merge";
import { tags } from "@lezer/highlight";
import { Button } from "./Button";
import { formatJson } from "../../utils/formatJson";

const THEME = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "14px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { padding: "12px 0", caretColor: "var(--color-brand)" },
  ".cm-content:focus-visible": { outline: "none" },
  ".cm-line": { padding: "0 12px" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "var(--color-outline-input)",
  },
  ".cm-gutterElement": { paddingLeft: "8px" },
});

const JSON_EXTENSIONS = [
  json(),
  linter(jsonParseLinter()),
  THEME,
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.propertyName, color: "var(--color-brand)" },
      { tag: tags.string, color: "var(--color-success)" },
      { tag: tags.number, color: "var(--color-brand-purple)" },
      { tag: [tags.bool, tags.null], color: "var(--color-warning)" },
    ]),
  ),
];

function formatEditor(view) {
  if (!view || view.composing) return;
  const before = view.state.doc.toString();
  const after = formatJson(before);
  if (after == null || before === after) return;
  // Apply small edits so CodeMirror maps the selection and undo history itself.
  const changes = view.state.changes(
    diff(before, after).map(({ fromA, toA, fromB, toB }) => ({
      from: fromA,
      to: toA,
      insert: after.slice(fromB, toB),
    })),
  );
  view.dispatch({
    changes,
    effects: view.scrollSnapshot().map(changes),
    annotations: Transaction.userEvent.of("input.format"),
  });
}

export default function JsonEditor({ id, label, value, onChange, describedBy, invalid = false }) {
  const editor = useRef(null);
  const formatTimer = useRef(null);
  const extensions = useMemo(
    () => [
      ...JSON_EXTENSIONS,
      EditorView.contentAttributes.of({
        id,
        "aria-labelledby": `${id}-label`,
        "aria-describedby": describedBy ?? "",
        "aria-invalid": String(invalid),
      }),
    ],
    [id, describedBy, invalid],
  );

  useEffect(() => () => clearTimeout(formatTimer.current), []);

  function handleChange(nextValue, update) {
    clearTimeout(formatTimer.current);
    onChange(nextValue);
    // Undo/redo must stay under the user's control, and formatting must not
    // schedule another formatting pass through its own onChange callback.
    if (
      update.transactions.some(
        (tr) => tr.isUserEvent("undo") || tr.isUserEvent("redo") || tr.isUserEvent("input.format"),
      )
    )
      return;
    formatTimer.current = setTimeout(() => formatEditor(editor.current?.view), 700);
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span id={`${id}-label`} className="text-xs font-medium text-gray-700">
          {label}
        </span>
        <Button
          type="button"
          variant="tertiary"
          size="xs"
          fullWidth={false}
          aria-label="Format JSON"
          disabled={formatJson(value) == null}
          onClick={() => formatEditor(editor.current?.view)}
        >
          Format
        </Button>
      </div>
      <div className="overflow-hidden rounded-g-1 border border-outline-input/40 focus-within:border-brand">
        <CodeMirror
          ref={editor}
          value={value}
          onChange={handleChange}
          extensions={extensions}
          theme="none"
          minHeight="220px"
          maxHeight="45vh"
          indentWithTab={false}
          basicSetup={{
            tabSize: 2,
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
            highlightSelectionMatches: false,
            searchKeymap: false,
            autocompletion: false,
          }}
        />
      </div>
    </div>
  );
}
