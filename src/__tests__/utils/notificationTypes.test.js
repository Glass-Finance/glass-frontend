import { describe, it, expect } from "vitest";
import {
  isPaymentNotificationType,
  isPaymentReceivedType,
  isSelfAccountType,
  notificationVisual,
  notificationCategory,
  notificationTypeTarget,
  NOTIFICATION_TYPES,
} from "../../utils/notificationTypes";

describe("isPaymentNotificationType", () => {
  it("is true for a payment-lifecycle type", () => {
    expect(isPaymentNotificationType("PAYMENT_OVERDUE")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(isPaymentNotificationType("payment_overdue")).toBe(true);
  });
  it("is false for a non-payment type or missing type", () => {
    expect(isPaymentNotificationType("JOIN_REQUEST_CREATED")).toBe(false);
    expect(isPaymentNotificationType(undefined)).toBe(false);
  });
});

describe("isPaymentReceivedType", () => {
  it("is true only for PAYMENT_RECEIVED, not other payment types", () => {
    expect(isPaymentReceivedType("PAYMENT_RECEIVED")).toBe(true);
    expect(isPaymentReceivedType("PAYMENT_DUE")).toBe(false);
  });
});

describe("isSelfAccountType", () => {
  it("is true for account-level types", () => {
    expect(isSelfAccountType("PASSWORD_UPDATED")).toBe(true);
  });
  it("is false for community/payment types", () => {
    expect(isSelfAccountType("JOIN_REQUEST_CREATED")).toBe(false);
  });
});

describe("notificationVisual", () => {
  it("returns the icon/color pair for a known type", () => {
    const v = notificationVisual("PAYMENT_RECEIVED");
    expect(v).not.toBeNull();
    expect(v.fg).toBe("var(--color-success-strong)");
  });
  it("returns null for an unknown type", () => {
    expect(notificationVisual("SOMETHING_MADE_UP")).toBeNull();
  });
});

describe("notificationCategory", () => {
  it("buckets an urgent type correctly", () => {
    expect(notificationCategory("PAYMENT_FAILED")).toBe("urgent");
  });
  it("buckets a routine payment type as 'payment'", () => {
    expect(notificationCategory("PAYMENT_RECEIVED")).toBe("payment");
  });
  it("buckets a membership type as 'member'", () => {
    expect(notificationCategory("JOIN_REQUEST_CREATED")).toBe("member");
  });
  it("returns null (not a guessed fallback) for an unknown type", () => {
    expect(notificationCategory("SOMETHING_MADE_UP")).toBeNull();
  });
});

describe("notificationTypeTarget", () => {
  it("routes an admin join-request notification to the join-requests page", () => {
    expect(notificationTypeTarget("JOIN_REQUEST_CREATED")).toBe("/dashboard/join-requests");
  });

  it("appends the community ref to routes that take one (admin)", () => {
    expect(notificationTypeTarget("PAYMENT_DUE", { communityRef: "abc" })).toBe(
      "/dashboard/admin?community=abc",
    );
  });

  it("omits the query string when no community ref is known", () => {
    expect(notificationTypeTarget("PAYMENT_DUE")).toBe("/dashboard/admin");
  });

  it("routes the same type differently for the member app", () => {
    expect(notificationTypeTarget("JOIN_REQUEST_CREATED", { memberApp: true })).toBe(
      "/member/communities",
    );
  });

  it("returns null for GENERAL and for an unrecognized type", () => {
    expect(notificationTypeTarget("GENERAL")).toBeNull();
    expect(notificationTypeTarget("SOMETHING_MADE_UP")).toBeNull();
  });

  it("returns null for a member-app type with no member-side destination (e.g. SETTLEMENT_COMPLETED)", () => {
    expect(notificationTypeTarget("SETTLEMENT_COMPLETED", { memberApp: true })).toBeNull();
  });
});

// The backend's NotificationType enum had ten values this file did not list:
// KYC_APPROVED, KYC_REJECTED, KYC_REVOKED, PHONE_VERIFICATION,
// PHONE_UPDATE_VERIFICATION, EMAIL_UPDATE_VERIFICATION, LOGIN_VERIFICATION,
// AUTO_DEBIT_UPCOMING, COMMUNITY_ACCOUNT_NEEDS_INFO and
// COMMUNITY_ACCOUNT_REJECTED. All ten are live — the backend emits every one.
//
// A missing type is not a crash: notificationCategory() returns null and the
// admin panel falls back to a text heuristic (see categorizeHeuristic in
// pages/dashboard/Notifications.jsx). But the heuristic files anything without
// FAIL/URGENT/ALERT/OVERDUE/SUSPEND under "payment", so a KYC REJECTION
// landed under "Payment Activity", and a missing visual meant no icon at all.
//
// These tests are the guard for the NEXT time the backend adds a type.

describe("backend notification type parity", () => {
  const BACKEND_TYPES = [
    "ACCOUNT_VERIFICATION",
    "ACCOUNT_REGISTRATION",
    "PASSWORD_RESET",
    "COMMUNITY_INVITE_SENT",
    "COMMUNITY_INVITE_ACCEPTED",
    "COMMUNITY_INVITE_REVOKED",
    "COMMUNITY_INVITE_EXPIRED",
    "COMMUNITY_ACCOUNT_VERIFIED",
    "COMMUNITY_ACCOUNT_NEEDS_INFO",
    "COMMUNITY_ACCOUNT_REJECTED",
    "JOIN_REQUEST_CREATED",
    "JOIN_REQUEST_APPROVED",
    "JOIN_REQUEST_REJECTED",
    "JOIN_REQUEST_REVOKED",
    "COMMUNITY_SETTINGS_CHANGED",
    "RECORD_IMPORT_STATUS",
    "KYC_APPROVED",
    "KYC_REJECTED",
    "KYC_REVOKED",
    "PHONE_VERIFICATION",
    "PHONE_UPDATE_VERIFICATION",
    "EMAIL_UPDATE_VERIFICATION",
    "LOGIN_VERIFICATION",
    "AUTO_DEBIT_UPCOMING",
    "PAYMENT_REQUEST_CREATED",
    "PAYMENT_DUE",
    "PAYMENT_OVERDUE",
    "PAYMENT_REMINDER_DUE",
    "PAYMENT_REMINDER_OVERDUE",
    "PAYMENT_RECEIVED",
    "PAYMENT_FAILED",
    "PAYMENT_AUTHORIZATION_DISABLED",
    "REFUND_REQUESTED",
    "SETTLEMENT_COMPLETED",
    "RECONCILIATION_FINDINGS",
    "PROFILE_UPDATED",
    "PROFILE_IMAGE_UPDATED",
    "PASSWORD_UPDATED",
    "EMAIL_UPDATED",
    "ACCOUNT_DELETION_VERIFICATION",
    "ACCOUNT_DELETION_REQUESTED",
  ];

  it("lists every backend notification type", () => {
    const missing = BACKEND_TYPES.filter((t) => !NOTIFICATION_TYPES.includes(t));
    expect(missing).toEqual([]);
  });

  it("gives every backend type a category, so none falls to the text heuristic", () => {
    const uncategorised = BACKEND_TYPES.filter((t) => notificationCategory(t) === null);
    expect(uncategorised).toEqual([]);
  });

  it("gives every backend type an icon, except the self-account ones by design", () => {
    // Self-account types deliberately show the reader's own photo instead.
    const iconless = BACKEND_TYPES.filter(
      (t) => notificationVisual(t) === null && !isSelfAccountType(t),
    );
    expect(iconless).toEqual([]);
  });

  it("gives every backend type a destination on at least one surface", () => {
    const unrouted = BACKEND_TYPES.filter(
      (t) =>
        notificationTypeTarget(t) === null &&
        notificationTypeTarget(t, { memberApp: true }) === null,
    );
    expect(unrouted).toEqual([]);
  });

  it("files a KYC rejection as urgent rather than letting the heuristic file it as payment", () => {
    // "REJECTED" contains none of FAIL/URGENT/ALERT/OVERDUE/SUSPEND, so the
    // heuristic would have put a blocked verification under Payment Activity.
    expect(notificationCategory("KYC_REJECTED")).toBe("urgent");
    expect(notificationCategory("KYC_REVOKED")).toBe("urgent");
    expect(notificationCategory("KYC_APPROVED")).toBe("member");
  });

  it("files an upcoming auto-debit as payment activity", () => {
    expect(notificationCategory("AUTO_DEBIT_UPCOMING")).toBe("payment");
  });

  it("routes a member's verification decisions to the member's own screens", () => {
    expect(notificationTypeTarget("KYC_REJECTED", { memberApp: true })).toBe(
      "/member/verify-identity",
    );
    expect(notificationTypeTarget("KYC_APPROVED", { memberApp: true })).toBe(
      "/member/verify-identity/history",
    );
    expect(notificationTypeTarget("PHONE_VERIFICATION", { memberApp: true })).toBe(
      "/member/verify-phone",
    );
    expect(notificationTypeTarget("EMAIL_UPDATE_VERIFICATION", { memberApp: true })).toBe(
      "/member/update-email",
    );
    expect(notificationTypeTarget("LOGIN_VERIFICATION", { memberApp: true })).toBe(
      "/member/security/authentication",
    );
    expect(notificationTypeTarget("AUTO_DEBIT_UPCOMING", { memberApp: true })).toBe(
      "/member/auto-pay",
    );
  });

  it("keeps the community account review staff-facing, like COMMUNITY_ACCOUNT_VERIFIED", () => {
    // These notify community STAFF, so a member has no member-app destination.
    for (const type of ["COMMUNITY_ACCOUNT_NEEDS_INFO", "COMMUNITY_ACCOUNT_REJECTED"]) {
      expect(notificationTypeTarget(type)).toBe("/dashboard/settings/community/profile");
      expect(notificationTypeTarget(type, { memberApp: true })).toBeNull();
    }
  });
});
