import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { act, render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditorView } from "@uiw/react-codemirror";
import CommunitiesSection from "../../../../pages/dashboard/platform-admin/CommunitiesSection";
import { getAdminCommunities, setCommissionOverride } from "../../../../api/admin";
import { updateCommunitySettings } from "../../../../api/communities";

// Platform-admin community controls: the commission-override payload
// (a schedule object vs explicit null for platform default)
// and the joining/visibility settings payload are the two mutations this
// section owns — both asserted against the real modal wiring.

vi.mock("../../../../api/admin", async (importOriginal) => ({
  ...(await importOriginal()),
  getAdminCommunities: vi.fn(),
  setCommissionOverride: vi.fn(),
}));
vi.mock("../../../../api/communities", async (importOriginal) => ({
  ...(await importOriginal()),
  updateCommunitySettings: vi.fn(),
}));

// CodeMirror measures text layout; jsdom has no layout engine.
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

function scheduleView() {
  return EditorView.findFromDOM(
    screen.getByRole("textbox", { name: "Commission schedule (JSON)" }),
  );
}

function setSchedule(value) {
  const view = scheduleView();
  act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }));
}

function page(content) {
  return { data: { data: { content, totalElements: content.length, totalPages: 1 } } };
}

const community = {
  id: "comm-1",
  slug: "kca",
  name: "KCA Alumni",
  status: "ACTIVE",
  commissionSchedule: null,
  defaultCurrency: "NGN",
  createdAt: "2026-01-15T00:00:00.000Z",
  metrics: { totalMembers: 120 },
  requiresMemberApproval: false,
  publicVisible: false,
  logo: null,
};

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CommunitiesSection />
    </QueryClientProvider>,
  );
}

async function findRow() {
  const name = await screen.findByText("KCA Alumni");
  return name.closest("tr");
}

function submitOpenModal() {
  const save = screen.getByRole("button", { name: "Save" });
  fireEvent.submit(save.closest("form"));
}

beforeEach(() => {
  getAdminCommunities.mockResolvedValue(page([community]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CommunitiesSection — rendering", () => {
  it("recognizes a custom commission schedule from the current response", async () => {
    getAdminCommunities.mockResolvedValue(
      page([
        {
          ...community,
          commissionSchedule: JSON.stringify({ bands: [{ upToMinor: null, rate: 1.5 }] }),
        },
      ]),
    );
    renderSection();

    expect((await findRow()).textContent).toContain("Custom schedule");
  });

  it("renders a community row with default-commission and member count", async () => {
    renderSection();
    const row = await findRow();

    expect(row.textContent).toContain("kca");
    expect(row.textContent).toContain("Platform default");
    expect(row.textContent).toContain("120");
    expect(row.textContent).toContain("ACTIVE");
    expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Commission" })).toBeTruthy();
  });
});

describe("CommunitiesSection — commission override", () => {
  it("sends a null schedule when the platform default is kept", async () => {
    setCommissionOverride.mockResolvedValue({});
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Commission" }));

    expect(screen.getByText("Commission Override")).toBeTruthy();
    expect(screen.getByLabelText("Use platform default").checked).toBe(true);
    submitOpenModal();

    await waitFor(() =>
      expect(setCommissionOverride).toHaveBeenCalledWith("kca", {
        schedule: null,
      }),
    );
    await waitFor(() => expect(screen.queryByText("Commission Override")).toBeNull());
  });

  it("sends the edited JSON as a schedule object without changing its values", async () => {
    const schedule = {
      bands: [{ upToMinor: null, rate: 1.5 }],
      capMinor: 50025,
      futurePricing: { enabled: true },
    };
    setCommissionOverride.mockResolvedValue({});
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Commission" }));
    fireEvent.click(screen.getByLabelText("Use platform default"));
    await screen.findByRole("textbox", { name: "Commission schedule (JSON)" });
    setSchedule(JSON.stringify(schedule));
    submitOpenModal();
    await waitFor(() => expect(setCommissionOverride).toHaveBeenCalledWith("kca", { schedule }));
  });

  it("loads and saves the entire response schedule without changing its structure", async () => {
    const schedule = {
      bands: [
        { upToMinor: 250025, rate: 8 },
        { upToMinor: null, rate: 1.5 },
      ],
      capMinor: 0,
    };
    getAdminCommunities.mockResolvedValue(
      page([{ ...community, commissionSchedule: JSON.stringify(schedule) }]),
    );
    setCommissionOverride.mockResolvedValue({});
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Commission" }));
    expect(screen.getByLabelText("Use platform default").checked).toBe(false);
    await screen.findByRole("textbox", { name: "Commission schedule (JSON)" });
    expect(scheduleView().state.doc.toString()).toBe(JSON.stringify(schedule, null, 2));
    submitOpenModal();
    await waitFor(() => expect(setCommissionOverride).toHaveBeenCalledWith("kca", { schedule }));
  });

  it("keeps unreadable JSON editable and prevents saving until it is fixed", async () => {
    getAdminCommunities.mockResolvedValue(page([{ ...community, commissionSchedule: "not-json" }]));
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Commission" }));
    await screen.findByRole("textbox", { name: "Commission schedule (JSON)" });
    expect(scheduleView().state.doc.toString()).toBe("not-json");
    submitOpenModal();
    expect(screen.getByRole("alert").textContent).toContain("Enter valid JSON");
    expect(setCommissionOverride).not.toHaveBeenCalled();
  });

  it.each(["null", "[]", "2", '"schedule"'])("rejects a non-object schedule: %s", async (value) => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Commission" }));
    fireEvent.click(screen.getByLabelText("Use platform default"));
    await screen.findByRole("textbox", { name: "Commission schedule (JSON)" });
    setSchedule(value);
    submitOpenModal();
    expect(screen.getByRole("alert").textContent).toContain("JSON object");
    expect(setCommissionOverride).not.toHaveBeenCalled();
  });

  it("allows explicitly clearing a custom schedule", async () => {
    getAdminCommunities.mockResolvedValue(
      page([
        {
          ...community,
          commissionSchedule: JSON.stringify({ bands: [{ upToMinor: null, rate: 0 }] }),
        },
      ]),
    );
    setCommissionOverride.mockResolvedValue({});
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Commission" }));
    fireEvent.click(screen.getByLabelText("Use platform default"));
    submitOpenModal();
    await waitFor(() =>
      expect(setCommissionOverride).toHaveBeenCalledWith("kca", { schedule: null }),
    );
  });

  it("keeps edits visible when the API rejects the pricing schedule", async () => {
    setCommissionOverride.mockRejectedValue({
      response: { status: 400, data: { message: "Invalid pricing schedule" } },
    });
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Commission" }));
    fireEvent.click(screen.getByLabelText("Use platform default"));
    await screen.findByRole("textbox", { name: "Commission schedule (JSON)" });
    setSchedule('{"bands":[]}');
    submitOpenModal();
    expect(await screen.findByText("Invalid pricing schedule")).toBeDefined();
    await screen.findByRole("textbox", { name: "Commission schedule (JSON)" });
    expect(scheduleView().state.doc.toString()).toBe('{"bands":[]}');
  });

  it("cancels without saving", async () => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Commission" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Commission Override")).toBeNull();
    expect(setCommissionOverride).not.toHaveBeenCalled();
  });
});

describe("CommunitiesSection — joining & visibility settings", () => {
  it("saves both toggles with the expected payload", async () => {
    updateCommunitySettings.mockResolvedValue({});
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(screen.getByText("Joining & Visibility")).toBeTruthy();
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    expect(switches[0].getAttribute("aria-checked")).toBe("false");
    expect(switches[1].getAttribute("aria-checked")).toBe("false");

    fireEvent.click(switches[1]); // Show in Discover
    expect(switches[1].getAttribute("aria-checked")).toBe("true");
    expect(switches[0].getAttribute("aria-checked")).toBe("false");

    submitOpenModal();

    await waitFor(() =>
      expect(updateCommunitySettings).toHaveBeenCalledWith("kca", {
        requiresMemberApproval: false,
        publicVisible: true,
      }),
    );
    await waitFor(() => expect(screen.queryByText("Joining & Visibility")).toBeNull());
  });

  it("keeps the modal open when saving settings fails", async () => {
    updateCommunitySettings.mockRejectedValue({
      response: { status: 400, data: { message: "bad payload" } },
    });
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

    submitOpenModal();

    await waitFor(() => expect(updateCommunitySettings).toHaveBeenCalled());
    expect(screen.getByText("Joining & Visibility")).toBeTruthy();
  });
});
