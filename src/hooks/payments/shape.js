import { normalizeImageObject } from "../../utils/normalizeImageFields";

// Shape the raw obligation response into what the UI expects
//
// SECURITY: every `logo` / `communityLogo` below is a server-controlled image
// URL that reaches an <img src> (Home, PaymentSummary, TransactionDetail,
// ReceiptModal, ManagePayments, CommunitiesHome). Normalize it here, in the one
// module the audit identified as the canonical representation for the
// ["transactions"] / ["obligations"] queries, so every observer of those cached
// entries receives a value that is already safe. Only the URL is touched — the
// rest of the backend's logo object is preserved.
export function shapeObligation(raw) {
  const plType = (raw.paymentLink?.paymentType ?? raw.paymentLink?.type ?? "").toUpperCase();
  return {
    id: raw.id,
    amount: raw.amount,
    amountPaid: raw.amountPaid ?? 0,
    name: raw.paymentLink?.title ?? raw.description ?? "Payment",
    description: raw.paymentLink?.title ?? raw.description ?? "Payment",
    communityName: raw.community?.name,
    communitySlug: raw.community?.slug,
    dueDate: raw.dueAt,
    // recurringPlan field + paymentType on the link both indicate a recurring plan
    type: raw.recurringPlan || plType === "RECURRING" ? "recurring" : "one-time",
    frequency:
      raw.recurringPlan?.frequency ??
      raw.paymentLink?.frequency ??
      raw.paymentLink?.billingFrequency ??
      null,
    interval: raw.recurringPlan?.interval ?? null,
    status: (() => {
      const s = (raw.status ?? "PENDING").toUpperCase();
      return s === "SUCCESSFUL" ? "PAID" : s;
    })(),
    paymentLinkId: raw.paymentLink?.id,
    // Whether the plan this obligation belongs to is still ACTIVE -- an
    // obligation generated before a plan was paused/archived/expired can
    // outlive that change (the backend doesn't retroactively cancel it),
    // so without this a duplicated-then-deactivated plan's stale unpaid
    // obligation keeps showing as due indefinitely even though the plan
    // itself no longer accepts payments.
    linkStatus: (raw.paymentLink?.status ?? "").toUpperCase(),
    obligationId: raw.id,
    logoColor: "var(--color-brand-deep)",
    logoText: (raw.community?.name ?? "C").charAt(0).toUpperCase(),
    logo: normalizeImageObject(raw.community?.logo),
  };
}

export function shapePaymentLink(raw, fallbackCommunitySlug) {
  return {
    id: raw.id,
    amount: raw.amount,
    amountPaid: 0,
    name: raw.title ?? raw.name ?? "Payment",
    description: raw.title ?? raw.name ?? "Payment",
    communityName: raw.community?.name,
    communitySlug: raw.community?.slug ?? fallbackCommunitySlug,
    dueDate: raw.dueAt ?? null,
    type: raw.paymentType === "RECURRING" || raw.recurringPlan ? "recurring" : "one-time",
    frequency: raw.recurringPlan?.frequency ?? raw.frequency ?? raw.billingFrequency ?? null,
    billingDay: raw.recurringPlan?.billingDay ?? raw.billingDay ?? null,
    status: "PENDING",
    linkStatus: (raw.status ?? "").toUpperCase(),
    paymentLinkId: raw.id,
    obligationId: null,
    logoColor: "var(--color-brand-deep)",
    logoText: (raw.community?.name ?? "C").charAt(0).toUpperCase(),
    logo: normalizeImageObject(raw.community?.logo),
    _isLink: true,
  };
}

export function shapeTransaction(raw) {
  return {
    id: raw.id,
    amount: raw.amount,
    amountPaid: raw.amountPaid,
    description: raw.description ?? raw.paymentLink?.title ?? "Payment",
    communityName: raw.community?.name,
    communitySlug: raw.community?.slug,
    // Kept so useTransactions' logo enrichment (which prefers /communities/me
    // and falls back to this value) behaves exactly as it did before this
    // shape became the canonical one for ["transactions"].
    communityLogo: normalizeImageObject(raw.community?.logo),
    date: raw.paidAt ?? raw.createdAt,
    // The backend's enum is SUCCESSFUL — normalise to "success" here so the
    // paid checks in this file (and everywhere else consuming shaped
    // transactions) match on a single value.
    status: (() => {
      const s = (raw.status ?? "").toLowerCase();
      return s === "successful" ? "success" : s;
    })(),
    channel: raw.channel,
    currency: raw.currency ?? "NGN",
    reference: raw.internalReference,
    paymentLinkId: raw.paymentLink?.id,
    obligationId: raw.obligationId,
  };
}

export function shapeAuthorisation(raw) {
  return {
    id: raw.id,
    bank: raw.bank,
    bankCode: raw.bankCode,
    last4: raw.last4 ?? "****",
    expMonth: raw.expMonth ?? raw.exp_month ?? null,
    expYear: raw.expYear ?? raw.exp_year ?? null,
    cardType: raw.cardType ?? raw.brand ?? raw.channel ?? null,
    channel: raw.channel,
    reusable: raw.reusable,
    status: raw.status,
    consents: (raw.consents ?? []).map((c) => ({
      id: c.consentId,
      planStatus: c.planStatus,
      communityName: c.community?.name,
      paymentLinkTitle: c.paymentLink?.title,
      paymentLinkId: c.paymentLink?.id ?? null,
      revoked: !!c.revokedAt,
    })),
  };
}

// /communities/me returns different shapes depending on role:
//   admin/owner → { name, slug, logo, owned: true, ... }
//   member      → { community: { name, slug, logo, ... }, memberRole, owned: false, ... }
// Normalize to always have name/slug/logo at the top level.
export function normalizeCommunity(c) {
  if (!c) return null;
  return {
    ...c,
    name: c.name ?? c.community?.name,
    slug: c.slug ?? c.community?.slug,
    logo: normalizeImageObject(c.logo ?? c.community?.logo),
  };
}
