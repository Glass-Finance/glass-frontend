import { describe, it, expect } from "vitest";
import { notificationTarget, notificationAction } from "../../utils/notificationRouting";

describe("notificationTarget", () => {
  it("prefers the exact notificationType match over any text heuristic", () => {
    const n = { notificationType: "JOIN_REQUEST_CREATED", title: "Payment received" };
    expect(notificationTarget(n)).toBe("/dashboard/join-requests");
  });

  it("appends the notification's own community as a query param on admin dashboard links", () => {
    const n = { notificationType: "PAYMENT_DUE", community: { slug: "acme" } };
    expect(notificationTarget(n)).toBe("/dashboard/admin?community=acme");
  });

  it("falls back to a communityId when community.slug is absent", () => {
    const n = { notificationType: "PAYMENT_DUE", communityId: "cid-1" };
    expect(notificationTarget(n)).toBe("/dashboard/admin?community=cid-1");
  });

  it("falls back to the text heuristic when notificationType is missing", () => {
    const n = { title: "Payment reminder", message: "Your dues are due soon" };
    expect(notificationTarget(n)).toBe("/dashboard/admin");
  });

  it("member-app text heuristic routes an auto-pay mention to /member/auto-pay", () => {
    const n = { title: "Your saved card failed", message: "" };
    expect(notificationTarget(n, { memberApp: true })).toBe("/member/auto-pay");
  });

  it("member-app text heuristic falls back to null when nothing matches", () => {
    const n = { title: "Hello there", message: "" };
    expect(notificationTarget(n, { memberApp: true })).toBeNull();
  });
});

describe("notificationAction", () => {
  it("returns null when there's no better target than the notifications list", () => {
    const n = { title: "Hello there", message: "" };
    expect(notificationAction(n, { memberApp: true })).toBeNull();
  });

  it("returns { to, label } for a resolvable admin target", () => {
    const n = { notificationType: "JOIN_REQUEST_CREATED" };
    expect(notificationAction(n)).toEqual({
      to: "/dashboard/join-requests",
      label: "View join requests",
    });
  });

  it("strips the query string before looking up the label", () => {
    const n = { notificationType: "PAYMENT_DUE", communityId: "cid-1" };
    expect(notificationAction(n)).toEqual({
      to: "/dashboard/admin?community=cid-1",
      label: "Open community dashboard",
    });
  });

  it("falls back to a generic label for a target with no dedicated entry", () => {
    const n = { title: "PLAN update", message: "" };
    expect(notificationAction(n)).toEqual({
      to: "/dashboard/payments",
      label: "View payment plans",
    });
  });
});

it("opens a record import in its own community from the verified notification contract", () => {
  expect(
    notificationTarget({
      notificationType: "RECORD_IMPORT_STATUS",
      communityId: "c",
      relatedEntityType: "RecordImportJob",
      relatedEntityId: "j",
      content: { jobId: "j", communityId: "c" },
    }),
  ).toBe("/dashboard/records/imports/j?community=c");
  expect(
    notificationTarget(
      { notificationType: "RECORD_IMPORT_STATUS", communityId: "c" },
      { memberApp: true },
    ),
  ).toBeNull();
});
