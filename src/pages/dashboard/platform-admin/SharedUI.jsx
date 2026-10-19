import { STATUS_COLORS } from "./shared";

// Re-export shim. The chrome itself now lives in
// src/components/dashboard/TableChrome.jsx, lifted out so community-scoped lists
// stop copying it inline (dashboard/settlements/SettlementsList.jsx and
// dashboard/SystemConfig.jsx already had; the record book would have been a third).
//
// Re-exported rather than re-pointed at each call site so every existing
// platform-admin section keeps working untouched — including its 403 copy, which
// is the platform-admin wording by default and is asserted in
// __tests__/pages/dashboard/platform-admin/UsersSection.test.jsx.
//
// StatusBadge stays here: it is driven by STATUS_COLORS from ./shared, and a
// component importing a colour table out of a page directory inverts the
// dependency. It is also the wrong vocabulary for other lists — the record book
// maps its own source / direction / review-status colours.
export {
  PagerBtn,
  Pager,
  TableShell,
  SectionHeader,
  SearchBar,
  FilterSelect,
  TableFooter,
} from "../../../components/dashboard/TableChrome";

export function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] ?? {
    bg: "bg-gray-100",
    text: "text-gray-500",
  };
  return (
    <span
      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text} whitespace-nowrap`}
    >
      {(status ?? "—").replace(/_/g, " ")}
    </span>
  );
}
