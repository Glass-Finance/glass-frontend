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
        state.calls.push({ path, contentType: request.headers()["content-type"] });
        await json(route, 201, {
          success: true,
          data: { id: "file-1", success: true, originalFileName: "dues.csv" },
        });
        return true;
      }
      const base = `/communities/${COMMUNITY.id}/records`;
      if (path === base && method === "GET") {
        await ok(route, pageOf(state.records));
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
        await ok(route, pageOf(state.rows));
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
  expect(state.calls[0].payload.amount).toBe(1250.5);
  await page.getByRole("button", { name: "Import spreadsheet", exact: true }).click();
  await page.getByLabel("Spreadsheets", { exact: true }).setInputFiles({
    name: "dues.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("name,amount\nAda,1250.50"),
  });
  await page.getByRole("button", { name: "Upload and start imports" }).click();
  await expect(page).toHaveURL(/imports\/job-1/);
  await expect(page.getByRole("heading", { name: "Waiting to start" })).toBeVisible();
  expect(state.calls.find((call) => call.path === "/file/upload").contentType).toMatch(
    /multipart\/form-data; boundary=/,
  );
  state.job.status = "READY_FOR_REVIEW";
  await event("READY_FOR_REVIEW", 2);
  await expect(page.getByRole("heading", { name: "Review your records" })).toBeVisible();
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
