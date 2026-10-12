import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isAuthorisationExpired,
  findAuthorisationForPlan,
} from "../../../hooks/payments/authorisation";

// authorisation.js is the module every checkout test MOCKS OUT. It decides
// which saved card is shown to the payer and which one auto-charges a plan, so
// its two exported functions are tested here against their real bodies.

/** Freeze "now" so month-boundary behaviour is deterministic. */
function at(year, month /* 1-12 */, day = 15) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, month - 1, day, 12, 0, 0));
}
function realTime() {
  vi.useRealTimers();
}

describe("isAuthorisationExpired", () => {
  afterEach(realTime);

  it("treats a card expiring in the CURRENT month as still valid", () => {
    // Cards are valid through the LAST DAY of their expiry month, so the
    // comparison must be `<` and not `<=`. Getting this wrong silently blocks
    // Auto-Pay for a whole month for every card on that boundary.
    at(2026, 6);
    expect(isAuthorisationExpired({ expYear: 2026, expMonth: 6 })).toBe(false);
  });

  it("treats a card expiring earlier in the current year as expired", () => {
    at(2026, 6);
    expect(isAuthorisationExpired({ expYear: 2026, expMonth: 5 })).toBe(true);
  });

  it("treats January of a future year as valid", () => {
    at(2026, 12);
    expect(isAuthorisationExpired({ expYear: 2027, expMonth: 1 })).toBe(false);
  });

  it("treats a card from a past year as expired even in a later month", () => {
    at(2026, 1);
    expect(isAuthorisationExpired({ expYear: 2025, expMonth: 12 })).toBe(true);
  });

  it("never expires an authorisation with no expiry data (bank authorisations)", () => {
    at(2026, 6);
    expect(isAuthorisationExpired(null)).toBe(false);
    expect(isAuthorisationExpired(undefined)).toBe(false);
    expect(isAuthorisationExpired({})).toBe(false);
    expect(isAuthorisationExpired({ expYear: 2026 })).toBe(false);
    expect(isAuthorisationExpired({ expMonth: 6 })).toBe(false);
    expect(isAuthorisationExpired({ expYear: 0, expMonth: 0 })).toBe(false);
  });

  it("coerces string-encoded expiry values", () => {
    at(2026, 6);
    expect(isAuthorisationExpired({ expYear: "2026", expMonth: "6" })).toBe(false);
    expect(isAuthorisationExpired({ expYear: "2026", expMonth: "5" })).toBe(true);
  });

  it("survives a current month boundary as the year rolls over", () => {
    at(2027, 1);
    expect(isAuthorisationExpired({ expYear: 2026, expMonth: 12 })).toBe(true);
    expect(isAuthorisationExpired({ expYear: 2027, expMonth: 1 })).toBe(false);
  });
});

describe("findAuthorisationForPlan", () => {
  const active = (id, consents) => ({ id, status: "ACTIVE", consents });
  const consentFor = (paymentLinkId, extra = {}) => ({
    paymentLinkId,
    revoked: false,
    ...extra,
  });

  it("matches strictly by paymentLinkId when both sides have one", () => {
    const authorisations = [
      active("auth-a", [consentFor("pl-1", { paymentLinkTitle: "Dues", communityName: "Alpha" })]),
      active("auth-b", [consentFor("pl-2", { paymentLinkTitle: "Dues", communityName: "Alpha" })]),
    ];

    // Two plans with the SAME title in the SAME community — exactly the case
    // the naive "first ACTIVE authorisation" logic gets wrong. The card that
    // auto-charges plan 2 must be auth-b, not auth-a.
    expect(findAuthorisationForPlan(authorisations, { paymentLinkId: "pl-2" })?.id).toBe("auth-b");
    expect(findAuthorisationForPlan(authorisations, { paymentLinkId: "pl-1" })?.id).toBe("auth-a");
  });

  it("never matches a consent belonging to a different paymentLinkId", () => {
    const authorisations = [
      active("auth-a", [consentFor("pl-1", { paymentLinkTitle: "Dues", communityName: "Alpha" })]),
    ];

    expect(
      findAuthorisationForPlan(authorisations, {
        paymentLinkId: "pl-999",
        title: "Dues",
        communityName: "Alpha",
      }),
    ).toBeNull();
  });

  it("falls back to title + community when the caller has no paymentLinkId", () => {
    const authorisations = [
      active("auth-a", [
        consentFor(null, { paymentLinkTitle: "Monthly Dues", communityName: "Alpha" }),
      ]),
    ];

    expect(
      findAuthorisationForPlan(authorisations, { title: "Monthly Dues", communityName: "Alpha" })
        ?.id,
    ).toBe("auth-a");
  });

  it("does not fall back to title + community across a community boundary", () => {
    const authorisations = [
      active("auth-a", [consentFor(null, { paymentLinkTitle: "Dues", communityName: "Alpha" })]),
    ];

    expect(
      findAuthorisationForPlan(authorisations, { title: "Dues", communityName: "Beta" }),
    ).toBeNull();
  });

  it("skips revoked consents and non-ACTIVE authorisations", () => {
    const authorisations = [
      active("revoked-auth", [
        consentFor("pl-1", { paymentLinkTitle: "Dues", communityName: "Alpha", revoked: true }),
      ]),
      { ...active("inactive-auth", [consentFor("pl-1")]), status: "INACTIVE" },
      active("live-auth", [consentFor("pl-1")]),
    ];

    expect(findAuthorisationForPlan(authorisations, { paymentLinkId: "pl-1" })?.id).toBe(
      "live-auth",
    );
  });

  it("matches a status supplied in lower case", () => {
    const authorisations = [{ id: "auth-a", status: "active", consents: [consentFor("pl-1")] }];
    expect(findAuthorisationForPlan(authorisations, { paymentLinkId: "pl-1" })?.id).toBe("auth-a");
  });

  it("returns null for empty, missing, and unmatched inputs", () => {
    expect(findAuthorisationForPlan([], { paymentLinkId: "pl-1" })).toBeNull();
    expect(findAuthorisationForPlan(null, { paymentLinkId: "pl-1" })).toBeNull();
    expect(findAuthorisationForPlan(undefined, { paymentLinkId: "pl-1" })).toBeNull();
    expect(findAuthorisationForPlan()).toBeNull();
    expect(
      findAuthorisationForPlan([active("a", [consentFor("pl-9")])], { paymentLinkId: "pl-1" }),
    ).toBeNull();
  });

  it("picks the correct card when one authorisation carries several consents", () => {
    // Backend contract: reusing a card across plans attaches the SAME
    // authorisation to the new plan rather than duplicating it, so a single
    // authorisation can legitimately hold multiple consents.
    const shared = active("shared-auth", [consentFor("pl-1"), consentFor("pl-2")]);
    const authorisations = [shared, active("other", [consentFor("pl-3")])];

    expect(findAuthorisationForPlan(authorisations, { paymentLinkId: "pl-2" })?.id).toBe(
      "shared-auth",
    );
    expect(findAuthorisationForPlan(authorisations, { paymentLinkId: "pl-3" })?.id).toBe("other");
  });

  // ── KNOWN LIMITATION, pinned deliberately (see report) ────────────────────
  // A consent with NO paymentLinkId causes the matcher to fall through to
  // title + community. Two distinct plans in one community sharing a title
  // would therefore both resolve to the same consent. The module's own comment
  // states the backend has no such ambiguity — consents ARE scoped per
  // recurring plan — so this only bites on a malformed/legacy payload. It is
  // NOT rewritten here: doing so silently would change which card charges a
  // plan, which is a product decision, not a test decision.
  it("KNOWN LIMITATION: an id-less consent falls back to title+community for every same-titled plan", () => {
    const authorisations = [
      active("auth-a", [consentFor(null, { paymentLinkTitle: "Dues", communityName: "Alpha" })]),
    ];

    const first = findAuthorisationForPlan(authorisations, {
      paymentLinkId: "pl-1",
      title: "Dues",
      communityName: "Alpha",
    });
    const second = findAuthorisationForPlan(authorisations, {
      paymentLinkId: "pl-2",
      title: "Dues",
      communityName: "Alpha",
    });

    expect(first?.id).toBe("auth-a");
    expect(second?.id).toBe("auth-a");
    expect(first).toBe(second);
  });
});
