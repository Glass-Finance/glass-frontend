import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditorView } from "@uiw/react-codemirror";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import SystemConfig from "../../../../../pages/dashboard/settings/admin/SystemConfig";
import { getSystemConfigs, updateSystemConfig } from "../../../../../api/admin";

vi.mock("../../../../../api/admin", async (importOriginal) => ({
  ...(await importOriginal()),
  getSystemConfigs: vi.fn(),
  updateSystemConfig: vi.fn(),
}));

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

const config = {
  id: "config-1",
  key: "system.example",
  name: "Example configuration",
  description: "Example description",
  category: "SYSTEM_VARIABLE",
  environment: "PRODUCTION",
  valueType: "JSON",
  value: '{"limit":9007199254740993,"enabled":true}',
};

beforeEach(() => {
  getSystemConfigs.mockResolvedValue({
    data: { data: { content: [config], totalElements: 1, totalPages: 1 } },
  });
  updateSystemConfig.mockResolvedValue({ data: { data: config } });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openEditor(overrides = {}) {
  getSystemConfigs.mockResolvedValue({
    data: { data: { content: [{ ...config, ...overrides }], totalElements: 1, totalPages: 1 } },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SystemConfig />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Edit", exact: true }));
}

async function jsonView() {
  return EditorView.findFromDOM(await screen.findByRole("textbox", { name: "Value (JSON)" }));
}

async function setJson(value) {
  const view = await jsonView();
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }));
}

function submit() {
  fireEvent.submit(
    screen.getByRole("button", { name: "Save Changes", exact: true }).closest("form"),
  );
}

describe("SystemConfig JSON editing", () => {
  it("uses the mini editor only for JSON and preserves numeric literals on load", async () => {
    await openEditor();
    expect((await jsonView()).state.doc.toString()).toBe(
      '{\n  "limit": 9007199254740993,\n  "enabled": true\n}',
    );
    expect(screen.getByRole("button", { name: "Format JSON" })).toBeDefined();
  });

  it("saves JSON as a string with the other edited metadata", async () => {
    await openEditor();
    const value = '{"arbitrary":{"newKey":[1,true]},"limit":9007199254740993}';
    await setJson(value);
    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "Updated name" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated description" },
    });
    submit();
    await waitFor(() =>
      expect(updateSystemConfig).toHaveBeenCalledWith("config-1", {
        value,
        name: "Updated name",
        description: "Updated description",
      }),
    );
  });

  it.each(["[1,true,null]", "[]", "{}"])("accepts JSON objects and arrays: %s", async (value) => {
    await openEditor();
    await setJson(value);
    submit();
    await waitFor(() =>
      expect(updateSystemConfig).toHaveBeenCalledWith(
        "config-1",
        expect.objectContaining({ value }),
      ),
    );
  });

  it.each(["", '{"limit":', "null", "1", '"value"', "true"])(
    "rejects invalid or non-container JSON: %s",
    async (value) => {
      await openEditor();
      await setJson(value);
      submit();
      expect(screen.getByRole("alert")).toBeDefined();
      expect(updateSystemConfig).not.toHaveBeenCalled();
    },
  );

  it("keeps STRING configuration values in the existing input", async () => {
    await openEditor({ valueType: "STRING", value: '{"text":"not a JSON config"}' });
    expect(screen.getByRole("textbox", { name: "Config value" }).value).toBe(
      '{"text":"not a JSON config"}',
    );
    expect(screen.queryByRole("button", { name: "Format JSON" })).toBeNull();
  });

  it("keeps BOOLEAN configuration values in the existing selector", async () => {
    await openEditor({ valueType: "BOOLEAN", value: "true" });
    fireEvent.click(screen.getByRole("button", { name: "false", exact: true }));
    submit();
    await waitFor(() =>
      expect(updateSystemConfig).toHaveBeenCalledWith(
        "config-1",
        expect.objectContaining({ value: "false" }),
      ),
    );
    expect(screen.queryByRole("button", { name: "Format JSON" })).toBeNull();
  });

  it("cancels JSON edits without saving", async () => {
    await openEditor();
    await setJson('{"changed":true}');
    fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
    expect(screen.queryByRole("textbox", { name: "Value (JSON)" })).toBeNull();
    expect(updateSystemConfig).not.toHaveBeenCalled();
  });
});
