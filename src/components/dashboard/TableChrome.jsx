import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { getErrorMessage } from "../../utils/errorHandler";
import EmptyState from "../common/EmptyState";
import LoadingState from "../common/LoadingState";

// ─────────────────────────────────────────────────────────────────────────────
// Table chrome — loading / error / empty / pagination / header framing
// ─────────────────────────────────────────────────────────────────────────────
//
// Lifted out of pages/dashboard/platform-admin/SharedUI.jsx so a community-scoped
// list can use them. Two lists had already copied this markup inline
// (dashboard/settlements/SettlementsList.jsx, dashboard/SystemConfig.jsx) and a
// third copy was the default outcome for the record book; that is what this
// module exists to stop.
//
// 403 copy is a PROP, not a constant. The platform-admin original hardcoded
// "Platform admin rights required to view this data.", which is wrong wording for
// a community admin and was the reason the original was never reused. The prop
// defaults to the platform wording so pages/dashboard/platform-admin/SharedUI.jsx
// can re-export these unchanged and keep its existing behaviour and copy
// (asserted in __tests__/pages/dashboard/platform-admin/UsersSection.test.jsx).
//
// StatusBadge is deliberately NOT here — it is driven by platform-admin's
// STATUS_COLORS map, and a component importing a colour table out of a page
// directory would invert the dependency. Lists with their own status vocabulary
// (the record book's source / direction / review status) should map their own.

export const DEFAULT_FORBIDDEN_MESSAGE = "Platform admin rights required to view this data.";

export function PagerBtn({ children, onClick, disabled }) {
  return (
    <Button
      variant="outline-neutral"
      size="sm"
      fullWidth={false}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

// `page` is 0-indexed, matching pageParams() in
// pages/dashboard/platform-admin/shared.js. Callers holding a 1-based
// pageNumber (Groups.jsx, SettlementsList.jsx) pass page={pageNumber - 1} and
// translate back in onPage.
export function Pager({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  // Windowed to ±2 pages so a long list doesn't render hundreds of buttons.
  const pages = Array.from({ length: totalPages }, (_, i) => i).filter(
    (i) => Math.abs(i - page) <= 2,
  );
  return (
    <div className="flex items-center gap-1">
      <PagerBtn onClick={() => onPage(page - 1)} disabled={page === 0}>
        <ChevronLeft size={13} />
      </PagerBtn>
      {pages.map((i) => (
        // Raw <button>: ui/Button has no icon-only pager-number variant, and a
        // page number has no label to hand to one. Carried over unchanged from
        // platform-admin/SharedUI.jsx.
        <button
          key={i}
          type="button"
          onClick={() => onPage(i)}
          aria-label={`Page ${i + 1}`}
          aria-current={i === page ? "page" : undefined}
          className={`w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
            i === page
              ? "bg-brand text-white border-none"
              : "bg-white text-gray-500 hover:bg-gray-100 border border-surface-container-border"
          }`}
        >
          {i + 1}
        </button>
      ))}
      <PagerBtn onClick={() => onPage(page + 1)} disabled={page >= totalPages - 1}>
        <ChevronRight size={13} />
      </PagerBtn>
    </div>
  );
}

export function TableShell({
  isLoading,
  isEmpty,
  error,
  emptyIcon,
  emptyLabel = "No results found",
  forbiddenMessage = DEFAULT_FORBIDDEN_MESSAGE,
  children,
}) {
  const is403 = error?.response?.status === 403;
  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden border border-surface-container-border">
      {isLoading ? (
        <LoadingState className="py-16" />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 px-6 text-center">
          <p className="text-xs font-semibold text-danger">
            {is403 ? "Access denied" : "Failed to load"}
          </p>
          <p className="text-xs text-gray-400">
            {is403 ? forbiddenMessage : getErrorMessage(error)}
          </p>
        </div>
      ) : isEmpty ? (
        <EmptyState icon={emptyIcon} title={emptyLabel} className="py-16" />
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}

export function SectionHeader({ title, desc, count, isFetching, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
          {count > 0 && (
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {count.toLocaleString()}
            </span>
          )}
          {isFetching && <RefreshCw size={12} className="text-gray-300 animate-spin" />}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
    </div>
  );
}

// Borderless composite control, so it carries a resting border and changes only
// its colour on focus (focus:border-brand) — no focus ring, per the design
// system. The border is also what stops the layout shifting on focus.
export function SearchBar({ value, onChange, placeholder = "Search…", width = 200, label }) {
  return (
    <div className="relative">
      <Search
        size={12}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label ?? placeholder}
        className="pl-8 pr-4 py-2 rounded-lg text-xs text-gray-700 placeholder-gray-400 outline-none border border-hairline-strong bg-white focus:border-brand"
        style={{ width }}
      />
    </div>
  );
}

export function FilterSelect({ value, onChange, options, label }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="px-3 py-2 rounded-lg text-xs text-gray-700 outline-none cursor-pointer border border-hairline-strong bg-white focus:border-brand"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TableFooter({ totalElements, noun, page, totalPages, onPage }) {
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-[11px] text-gray-400">
        {totalElements.toLocaleString()} {noun}
        {totalElements !== 1 ? "s" : ""}
      </p>
      <Pager page={page} totalPages={totalPages} onPage={onPage} />
    </div>
  );
}
