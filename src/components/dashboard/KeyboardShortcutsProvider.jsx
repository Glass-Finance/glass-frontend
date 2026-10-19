import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShortcutsContext } from "../../hooks/shortcutsContext";

// Inputs/textareas/selects/contenteditable should never have their typing
// hijacked by a single-letter shortcut ("g", "?", a digit) -- Escape is the
// one exception, since closing the dialog you're typing in is expected to
// work without blurring the field first.
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

// How long a leading "g" stays "armed" waiting for its second key --
// matches the Gmail/GitHub/Linear go-to convention. Long enough to not feel
// twitchy, short enough that "g" followed by unrelated typing (after
// clicking back into a text field, say) doesn't fire a stale chord.
const CHORD_WINDOW_MS = 900;

export default function KeyboardShortcutsProvider({ children }) {
  // Array, not a Map -- multiple entries can share the same `keys` (e.g. two
  // modals both bound to "Escape"), and lookups always want the most
  // recently registered one, i.e. whatever's topmost/mounted last.
  const [registry, setRegistry] = useState([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const chordRef = useRef(null); // { key: "g", at: timestamp } | null

  const register = useCallback((entry) => {
    setRegistry((r) => [...r, entry]);
    return () => setRegistry((r) => r.filter((e) => e !== entry));
  }, []);

  useEffect(() => {
    function findLast(keys) {
      for (let i = registry.length - 1; i >= 0; i--) {
        if (registry[i].keys === keys) return registry[i];
      }
      return null;
    }

    function onKeyDown(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // never shadow OS/browser shortcuts

      if (e.key === "Escape") {
        chordRef.current = null;
        const entry = findLast("Escape");
        if (entry) entry.handler(e);
        return;
      }

      // A modal owns interaction even when focus is on its footer buttons.
      // Let its own Escape/Tab handlers run, but never navigate away from a
      // draft or open shortcut help behind it. Drop any previously armed chord.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) {
        chordRef.current = null;
        return;
      }
      if (isTypingTarget(document.activeElement)) return;

      // While the help overlay is open, only Escape (above) and "?" (its
      // own toggle) do anything -- everything else is paused so "g h"
      // typed while reading the cheatsheet doesn't also navigate away.
      if (helpOpen && e.key !== "?") return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      const now = Date.now();
      if (chordRef.current && now - chordRef.current.at < CHORD_WINDOW_MS) {
        const combo = `${chordRef.current.key} ${e.key.toLowerCase()}`;
        chordRef.current = null;
        const entry = findLast(combo);
        if (entry) {
          e.preventDefault();
          entry.handler(e);
        }
        return;
      }

      if (e.key.toLowerCase() === "g") {
        chordRef.current = { key: "g", at: now };
        return;
      }
      chordRef.current = null;

      const entry = findLast(e.key);
      if (entry) {
        e.preventDefault();
        entry.handler(e);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [registry, helpOpen]);

  // Without this, the object literal below is a new reference every render,
  // which every consumer's registration effect depends on (via `ctx`) --
  // that turned into a genuine infinite loop: new object -> effect re-fires
  // -> re-registers -> registry array grows/changes reference -> re-render
  // -> new object again, forever. Memoizing so the value only actually
  // changes when something in it does.
  const value = useMemo(
    () => ({ register, registry, helpOpen, setHelpOpen }),
    [register, registry, helpOpen],
  );

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}
