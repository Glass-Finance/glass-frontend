import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";
import {
  ADMIN_PERSONA,
  createScenario,
  installNetworkMock,
  preparePage,
  ok,
  json,
} from "./support.js";

const PERSONA = {
  ...ADMIN_PERSONA,
  user: { ...ADMIN_PERSONA.user, role: "USER", isPlatformAdmin: false, isAdmin: true },
  profile: { ...ADMIN_PERSONA.profile, platformRole: "USER" },
};
const COMMUNITY = {
  id: "comm-records",
  slug: "records-crew",
  name: "Records Crew",
  defaultCurrency: "NGN",
  owned: true,
  memberRole: "COMMUNITY_OWNER",
  memberStatus: "ACTIVE",
  metrics: {},
};
const pageOf = (content) => ({
  content,
  pageNumber: 1,
  pageSize: 20,
  totalElements: content.length,
  totalPages: content.length ? 1 : 0,
  last: true,
});
const ROW = {
  id: "record-1",
  communityId: COMMUNITY.id,
  source: "MANUAL",
  recordType: "MEMBER_PAYMENT",
  direction: "INFLOW",
  occurredOn: "2026-01-01",
  amount: 1250.5,
  currency: "NGN",
  payerName: "Ada Example",
  description: "January dues",
  reviewStatus: "VALID",
  issues: [],
};
async function seed(page) {
  const state = {
    records: [],
    job: null,
    rows: [{ ...ROW, id: "draft-1", source: "FILE_IMPORT", payerName: "Imported payer" }],
    calls: [],
  };
  const scenario = createScenario({ persona: PERSONA });
  scenario.overrides.push({
    match: () => true,
    handle: async (route, request, url) => {
      const path = url.pathname.replace("/api/v1", "");
      const method = request.method();
      if (path === "/communities/me") {
        await ok(route, pageOf([COMMUNITY]));
        return true;
      }
      if (path === "/roles/community/COMMUNITY_OWNER") {
        await ok(route, {
          code: "COMMUNITY_OWNER",
          permissions: ["read", "create", "update", "delete", "import"]
            .map((key) => ({ code: `community.recordbook.${key}` }))
            .concat([{ code: "community.ai.usage.read" }]),
        });
        return true;
      }
      if (path === `/communities/${COMMUNITY.id}/ai/usage/RECORD_IMPORT`) {
        await ok(route, {
          mode: "LIMITED",
          remainingUnits: 8,
          reservedUnits: 0,
          resetsAt: "2026-11-01T00:00:00Z",
        });
        return true;
      }
      if (path === "/realtime/ticket") {
        await ok(route, { ticket: "test-ticket" });
        return true;
      }
      if (path === "/file/upload" && method === "POST") {
        state.calls.push({
          path,
          contentType: request.headers()["content-type"],
          fileContentType: request
            .postDataBuffer()
            ?.toString("latin1")
            .match(/\r\nContent-Type: ([^\r\n]+)/i)?.[1],
        });
        await json(route, 201, {
          success: true,
          data: { id: "file-1", success: true, originalFileName: "dues.csv" },
        });
        return true;
      }
      const base = `/communities/${COMMUNITY.id}/records`;
      if (path === base && method === "GET") {
        state.calls.push({ path, params: Object.fromEntries(url.searchParams) });
        const search = url.searchParams.get("search")?.toLowerCase();
        await ok(
          route,
          pageOf(
            search
              ? state.records.filter((row) =>
                  `${row.payerName ?? ""} ${row.description ?? ""}`.toLowerCase().includes(search),
                )
              : state.records,
          ),
        );
        return true;
      }
      if (path === base && method === "POST") {
        const payload = request.postDataJSON();
        state.calls.push({ path, payload });
        const saved = { ...ROW, ...payload };
        state.records.push(saved);
        await json(route, 201, { success: true, data: saved });
        return true;
      }
      if (path === `${base}/imports` && method === "GET") {
        await ok(route, pageOf(state.job ? [state.job] : []));
        return true;
      }
      if (path === `${base}/imports` && method === "POST") {
        state.calls.push({ path, payload: request.postDataJSON() });
        state.job = {
          id: "job-1",
          communityId: COMMUNITY.id,
          fileId: "file-1",
          fileFormat: "CSV",
          createdAt: "2026-10-18T10:00:00Z",
          status: "QUEUED",
          reviewTotals: { VALID: 1 },
          timeline: [
            {
              sequence: 1,
              status: "QUEUED",
              title: "Waiting to start",
              occurredAt: "2026-10-18T10:00:00Z",
            },
          ],
        };
        await json(route, 202, { success: true, data: state.job });
        return true;
      }
      if (path === `${base}/imports/job-1` && method === "GET") {
        await ok(route, state.job);
        return true;
      }
      if (path === `${base}/imports/job-1/rows` && method === "GET") {
        state.calls.push({ path, params: Object.fromEntries(url.searchParams) });
        const search = url.searchParams.get("search")?.toLowerCase();
        await ok(
          route,
          pageOf(
            search
              ? state.rows.filter((row) =>
                  `${row.payerName ?? ""} ${row.description ?? ""}`.toLowerCase().includes(search),
                )
              : state.rows,
          ),
        );
        return true;
      }
      if (path === `${base}/imports/job-1/rows/bulk` && method === "PATCH") {
        const payload = request.postDataJSON();
        state.calls.push({ path, payload });
        state.rows = state.rows.map((row) => ({ ...row, ...payload.patch }));
        await ok(route, state.rows);
        return true;
      }
      if (path === `${base}/imports/job-1/commit` && method === "POST") {
        state.job.status = "COMMIT_QUEUED";
        await json(route, 202, { success: true, data: state.job });
        return true;
      }
      if (path === `/communities/${COMMUNITY.slug}`) {
        await ok(route, COMMUNITY);
        return true;
      }
      return false;
    },
  });
  await installNetworkMock(page, scenario);
  await preparePage(page, PERSONA);
  await page.addInitScript(() => {
    window.__recordStreams = [];
    window.EventSource = class {
      constructor() {
        this.listeners = {};
        window.__recordStreams.push(this);
        setTimeout(() => this.onopen?.(), 0);
      }
      addEventListener(name, fn) {
        this.listeners[name] = fn;
      }
      close() {}
    };
  });
  const event = async (status, sequence) =>
    page.evaluate(
      ({ status, sequence, communityId }) => {
        for (const stream of window.__recordStreams)
          stream.listeners.RECORD_IMPORT_PROGRESS?.({
            type: "RECORD_IMPORT_PROGRESS",
            data: JSON.stringify({ communityId, jobId: "job-1", status, sequence }),
          });
      },
      { status, sequence, communityId: COMMUNITY.id },
    );
  return { state, event };
}

test("manual record and SSE-driven spreadsheet review/save journey", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "covered once on desktop; responsive view tested separately",
  );
  const { state, event } = await seed(page);
  await page.goto(`/dashboard/records?community=${COMMUNITY.slug}`);
  await page.getByRole("button", { name: "Add record", exact: true }).click();
  await page.getByLabel("Amount", { exact: true }).fill("1250.50");
  await page.getByLabel("Payer name (optional)", { exact: true }).fill("Ada Example");
  await page.getByRole("button", { name: "Add record", exact: true }).last().click();
  await expect(page.getByRole("table")).toContainText("Ada Example");
  expect(state.calls.find((call) => call.payload?.payerName === "Ada Example").payload.amount).toBe(
    1250.5,
  );
  expect(state.calls.find((call) => call.params)?.params).not.toHaveProperty("search");
  const recordsPath = `/communities/${COMMUNITY.id}/records`;
  await page.getByLabel("Search records", { exact: true }).fill("%_! manual");
  await expect
    .poll(
      () =>
        state.calls.filter((call) => call.path === recordsPath && call.params).at(-1)?.params
          .search,
    )
    .toBe("%_! manual");
  await page.getByLabel("Search records", { exact: true }).fill("");
  await expect(page.getByRole("table")).toContainText("Ada Example");
  // Clearing can reuse the fresh unfiltered cache. Change sort to force a
  // new request and verify its serialized parameters also omit search.
  await page.getByLabel("Sort by", { exact: true }).selectOption("occurredOn");
  await expect
    .poll(
      () =>
        state.calls.filter((call) => call.path === recordsPath && call.params).at(-1)?.params
          .sortBy,
    )
    .toBe("occurredOn");
  expect(
    state.calls.filter((call) => call.path === recordsPath && call.params).at(-1).params,
  ).not.toHaveProperty("search");
  await page.getByRole("button", { name: "Import spreadsheet", exact: true }).click();
  await page.getByLabel("Spreadsheets", { exact: true }).setInputFiles({
    name: "dues.csv",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("name,amount\nAda,1250.50"),
  });
  await page.screenshot({ path: testInfo.outputPath("record-upload-dialog.png"), fullPage: true });
  await page.getByRole("button", { name: "Upload and start imports" }).click();
  await expect(page).toHaveURL(/imports\/job-1/);
  await expect(page.getByRole("heading", { name: "Waiting to start" })).toBeVisible();
  expect(state.calls.find((call) => call.path === "/file/upload").contentType).toMatch(
    /multipart\/form-data; boundary=/,
  );
  expect(state.calls.find((call) => call.path === "/file/upload").fileContentType).toBe("text/csv");
  state.job.status = "READY_FOR_REVIEW";
  await event("READY_FOR_REVIEW", 2);
  await expect(page.getByRole("heading", { name: "Review your records" })).toBeVisible();
  const rowsPath = `/communities/${COMMUNITY.id}/records/imports/job-1/rows`;
  expect(state.calls.find((call) => call.path === rowsPath).params).not.toHaveProperty("search");
  await page.getByLabel("Search records", { exact: true }).fill("%_! dues");
  await expect
    .poll(() => state.calls.filter((call) => call.path === rowsPath).at(-1)?.params.search)
    .toBe("%_! dues");
  await page.getByLabel("Search records", { exact: true }).fill("");
  await expect(page.getByRole("table")).toContainText("Imported payer");
  await page.getByLabel("Sort by", { exact: true }).selectOption("sourceRowNumber");
  await expect
    .poll(() => state.calls.filter((call) => call.path === rowsPath).at(-1)?.params.sortBy)
    .toBe("sourceRowNumber");
  expect(state.calls.filter((call) => call.path === rowsPath).at(-1).params).not.toHaveProperty(
    "search",
  );
  await page.getByLabel("Select record Imported payer", { exact: true }).first().check();
  await page.getByRole("button", { name: "Edit selected", exact: true }).click();
  await page.getByLabel("New value", { exact: true }).fill("Imported January dues");
  await page.getByRole("button", { name: "Add field change" }).click();
  await page.getByRole("button", { name: "Review changes" }).click();
  await page.getByRole("button", { name: "Apply to 1 selected records" }).click();
  await expect(page.getByRole("table")).toContainText("Imported January dues");
  expect(state.calls.find((call) => call.path.endsWith("/rows/bulk")).payload).toEqual({
    rowIds: ["draft-1"],
    patch: { description: "Imported January dues" },
  });
  await page.screenshot({ path: testInfo.outputPath("record-review-desktop.png"), fullPage: true });
  await page.getByRole("button", { name: "Save records", exact: true }).click();
  await page.getByRole("button", { name: "Save records", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Saving records" })).toBeVisible();
  await expect(page.getByText("Your records have been saved", { exact: true })).toHaveCount(0);
  state.job.status = "COMMITTED";
  state.job.committedRows = 1;
  state.job.skippedRows = 0;
  state.records.push({ ...state.rows[0], importJobId: "job-1" });
  await event("COMMITTED", 3);
  await expect(page.getByRole("heading", { name: "Your records have been saved" })).toBeVisible();
  await page.getByRole("link", { name: "View saved records" }).click();
  await expect(page.getByRole("table")).toContainText("Imported January dues");
  await page.getByRole("link", { name: "Imports", exact: true }).click();
  await expect(page.getByText("CSV import", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("record-import-history.png"), fullPage: true });
});

for (const width of [375, 768, 1440])
  test(`record book is usable without horizontal overflow at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "explicit viewports cover admin layouts",
    );
    const { state } = await seed(page);
    state.records = [
      {
        ...ROW,
        payerName:
          "A very long historical payer name that must wrap without overflowing the dashboard",
      },
    ];
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/dashboard/records?community=${COMMUNITY.slug}`);
    await expect(page.getByRole("heading", { name: "Records", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add record", exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`records-${width}.png`), fullPage: true });
  });

for (const [name, mimeType, expected] of [
  ["dues.csv", "application/octet-stream", "text/csv"],
  [
    "dues.xlsx",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
])
  test(`normalizes the browser's multipart file type for ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "multipart contract checked once");
    const { state } = await seed(page);
    await page.goto(`/dashboard/records/imports?community=${COMMUNITY.slug}&upload=1`);
    await page
      .getByLabel("Spreadsheets", { exact: true })
      .setInputFiles({ name, mimeType, buffer: Buffer.from("synthetic request metadata fixture") });
    await page.getByRole("button", { name: "Upload and start imports" }).click();
    await expect
      .poll(() => state.calls.find((call) => call.path === "/file/upload")?.fileContentType)
      .toBe(expected);
  });

for (const width of [375, 768, 1440])
  test(`review workspace and filters fit ${width}px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "explicit admin viewports");
    const { state } = await seed(page);
    state.job = {
      id: "job-1",
      communityId: COMMUNITY.id,
      fileFormat: "XLSX",
      status: "READY_FOR_REVIEW",
      createdAt: "2026-10-18T10:00:00Z",
      reviewTotals: { VALID: 1 },
      timeline: [],
    };
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/dashboard/records/imports/job-1?community=${COMMUNITY.slug}`);
    await expect(page.getByRole("heading", { name: "Review your records" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip selected" })).toHaveCount(0);
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    const panel = page.getByRole("group", { name: "Record filters" });
    await expect(panel).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await panel.getByRole("button", { name: "Done", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.getByRole("heading", { name: "Records", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`review-${width}.png`), fullPage: true });
  });
