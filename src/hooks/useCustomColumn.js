import { useCallback, useEffect, useState } from "react";

// Custom columns for the admin dashboard's "Member Payments" table.
//
// STOPGAP: persisted in localStorage per community, because there is no
// backend endpoint for custom columns yet. Everything the UI needs goes
// through this hook, so when the API exists only this file changes:
//   - load()        -> GET  /communities/:id/custom-columns (+ values)
//   - addColumn()   -> POST /communities/:id/custom-columns
//   - setCellValue()-> PUT  /communities/:id/custom-columns/:columnId/values/:rowId
//
// Shapes:
//   column = { id, name, type: "text" | "dropdown" | "date", label,
//              options: [{ label, value }], defaultValue }
//   values = { [columnId]: { [transactionId]: string } }

const columnsKey = (communityId) => `glass_custom_columns_${communityId}`;
const valuesKey = (communityId) => `glass_custom_column_values_${communityId}`;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the in-memory state still works this session */
  }
}

function load(communityId) {
  if (!communityId) return { columns: [], values: {} };
  return {
    columns: readJson(columnsKey(communityId), []),
    values: readJson(valuesKey(communityId), {}),
  };
}

function newColumnId() {
  return `col_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function useCustomColumns(communityId) {
  const [store, setStore] = useState(() => ({ communityId, ...load(communityId) }));

  // The dashboard can switch communities without unmounting; reload when it does.
  if (store.communityId !== communityId) {
    setStore({ communityId, ...load(communityId) });
  }

  useEffect(() => {
    if (!store.communityId) return;
    writeJson(columnsKey(store.communityId), store.columns);
    writeJson(valuesKey(store.communityId), store.values);
  }, [store]);

  const addColumn = useCallback((draft) => {
    const column = { id: newColumnId(), ...draft };
    setStore((prev) => ({ ...prev, columns: [...prev.columns, column] }));
    return column;
  }, []);

  const setCellValue = useCallback((columnId, rowId, value) => {
    setStore((prev) => ({
      ...prev,
      values: {
        ...prev.values,
        [columnId]: { ...(prev.values[columnId] ?? {}), [rowId]: value },
      },
    }));
  }, []);

  return {
    columns: store.columns,
    values: store.values,
    addColumn,
    setCellValue,
  };
}
