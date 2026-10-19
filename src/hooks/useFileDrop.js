import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isFileDrag } from "../utils/recordImportFiles";

// File-only gestures; the existing picker remains the keyboard alternative.
export function useFileDrop(onFiles, disabled = false, captureWindow = false) {
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const resetDrag = useCallback(() => {
    depth.current = 0;
    setDragging(false);
  }, []);
  useEffect(() => {
    const preventFileNavigation = (event) => {
      if (isFileDrag(event)) event.preventDefault();
    };
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);
  const dropHandlers = useMemo(
    () => ({
      onDragEnter(event) {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        if (disabled) return;
        depth.current++;
        setDragging(true);
      },
      onDragOver(event) {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      },
      onDragLeave(event) {
        if (!isFileDrag(event)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      },
      onDragEnd: resetDrag,
      onDrop(event) {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        resetDrag();
        const files = Array.from(event.dataTransfer.files ?? []);
        if (!disabled && files.length) onFiles(files, event);
      },
    }),
    [disabled, onFiles, resetDrag],
  );
  useEffect(() => {
    if (!captureWindow || disabled) return;
    const events = {
      dragenter: dropHandlers.onDragEnter,
      dragover: dropHandlers.onDragOver,
      dragleave: dropHandlers.onDragLeave,
      dragend: dropHandlers.onDragEnd,
      drop: dropHandlers.onDrop,
    };
    for (const [name, handler] of Object.entries(events)) window.addEventListener(name, handler);
    return () => {
      for (const [name, handler] of Object.entries(events))
        window.removeEventListener(name, handler);
    };
  }, [captureWindow, disabled, dropHandlers]);
  return {
    dragging: !disabled && dragging,
    dropHandlers: captureWindow ? {} : dropHandlers,
    resetDrag,
  };
}
