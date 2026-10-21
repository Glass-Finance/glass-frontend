// Badge components implementing docs/design-system.md §9.1 — the Figma status,
// role and payment-frequency chips. The wash/label pairs are taken straight
// from the file's Status Badge (1:12211), Role Badge (1:12205) and Payment
// Frequency Badge (1:12311) component sets; do not invent pairings here.
//
// Radius: status and role chips are 4px rectangles (rounded-g-1). Frequency
// pills are the one rounded-full exception recorded in §1.5 — Figma draws
// them at r=24/999 deliberately. Label sizes: status/role 16px, frequency
// 14px, all weight 500 (§7.1). Heights/padding are not measurable via the
// REST API (stroke/height don't serialize on these nodes); px-2.5 py-1 is
// provisional pending a dev-mode measurement.

const BADGES = {
  status: {
    paid: { label: "Paid", cls: "bg-success-wash text-success" },
    unpaid: { label: "Unpaid", cls: "bg-danger-wash text-danger" },
    pending: { label: "Pending", cls: "bg-warning-wash text-warning" },
    radius: "rounded-g-1",
    text: "text-base",
  },
  role: {
    member: { label: "Member", cls: "bg-warning-wash text-warning" },
    admin: { label: "Admin", cls: "bg-accent-purple-tint text-accent-purple" },
    radius: "rounded-g-1",
    text: "text-base",
  },
  freq: {
    weekly: { label: "Weekly", cls: "bg-brand-100 text-brand" },
    monthly: { label: "Monthly", cls: "bg-warning-wash text-warning" },
    "one-time": { label: "One-Time", cls: "bg-accent-purple-tint text-accent-purple" },
    radius: "rounded-full",
    text: "text-sm",
  },
};

export default function Badge({ kind = "status", value, children, className = "" }) {
  const family = BADGES[kind] ?? BADGES.status;
  const entry = family[value];
  if (!entry) {
    if (import.meta.env.DEV) {
      console.warn(`Badge: unknown ${kind} value "${value}"`);
    }
    return null;
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 font-medium whitespace-nowrap ${family.radius} ${family.text} ${entry.cls} ${className}`}
    >
      {children ?? entry.label}
    </span>
  );
}
