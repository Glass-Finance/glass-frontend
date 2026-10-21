import { useState } from "react";
import {
  Download,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
} from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import ReceiptDownloadButton from "../../../../components/dashboard/ReceiptDownloadButton";
import { toTitleCase, formatDate } from "../../../../utils/format";
import TimerIcon from "../../../../assets/dashboard/timer.webp";
import { Skeleton } from "../../../../components/common/SkeletonUI";
import { formatNaira, statusStyle } from "../helpers";

export default function MemberPaymentsSection({
  transactions,
  total = 0,
  page = 0,
  pageCount = 1,
  onPageChange,
  planOptions = [],
  planFilter = null,
  onPlanFilterChange,
  statusFilter = null,
  onStatusFilterChange,
  onClearFilters,
  isLoading,
  error = null,
  search,
  onSearchChange,
  sortDir,
  onToggleSort,
  onExport,
  isExporting,
  communityId,
  resolveMemberName,
  community,
  onRowClick,
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const hasFilters = !!(planFilter || statusFilter);
  const statusOptions = [
    { value: "PAID", label: "Paid" },
    { value: "UNPAID", label: "Unpaid" },
  ];
  return (
    <div
      data-tour="member-payments-table"
      className="bg-surface-container rounded-g-2 md:rounded-xl border border-surface-container-border"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <span className="text-sm font-medium">Member Payments</span>
        <Button
          variant="outline-neutral"
          size="xs"
          fullWidth={false}
          onClick={onExport}
          disabled={isExporting || !communityId}
          title="Export all transactions for this community as CSV"
        >
          <Download size={12} /> {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-5 py-3 gap-2">
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-surface-container-border w-full sm:flex-1 sm:min-w-0 sm:max-w-xs focus-within:border-[#002FA7] transition-colors">
          <Search size={12} className="text-gray-400 flex-shrink-0" />
          <input
            aria-label="Search members and payments"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search members, payments, receipts..."
            className="flex-1 bg-transparent border-none outline-none text-base md:text-xs text-gray-600 placeholder-gray-400"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs self-end sm:self-auto">
          Sort by:
          <Button variant="outline-neutral" size="xs" fullWidth={false} onClick={onToggleSort}>
            {sortDir === "desc" ? "Recent" : "Oldest"}{" "}
            <ChevronDown size={11} className={sortDir === "asc" ? "rotate-180" : ""} />
          </Button>
          {/* Same dropdown shape as YourPaymentsSection's Filter, widened to
              carry a plan list above the status pair. Figma's mobile table
              (node 393:19990) drives it from the chips below. */}
          <div className="relative">
            <Button
              variant="outline-neutral"
              size="xs"
              fullWidth={false}
              onClick={() => setFilterOpen((o) => !o)}
              aria-expanded={filterOpen}
              title="Filter payments"
            >
              Filter <ChevronDown size={11} />
            </Button>
            {filterOpen && (
              <>
                <div
                  className="fixed inset-0 z-20 md:hidden"
                  aria-hidden="true"
                  onClick={() => setFilterOpen(false)}
                />
                <div
                  role="menu"
                  aria-label="Filter payments"
                  className="absolute right-0 top-full mt-1 bg-white rounded-g-2 border border-surface-container-border shadow-lg z-30 min-w-[180px] overflow-hidden"
                >
                  <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400">Plan</div>
                  {planOptions.length === 0 ? (
                    <div className="px-3 pb-2 text-xs text-gray-400">No plans yet</div>
                  ) : (
                    planOptions.map((name) => (
                      <button
                        key={name}
                        role="menuitem"
                        onClick={() => {
                          onPlanFilterChange?.(planFilter === name ? null : name);
                          setFilterOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs cursor-pointer border-none ${
                          planFilter === name
                            ? "bg-blue-50 font-medium text-brand"
                            : "bg-transparent text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {name}
                      </button>
                    ))
                  )}
                  <div className="h-px bg-[var(--color-hairline)] my-1" />
                  <div className="px-3 pt-1 pb-1 text-[11px] font-medium text-gray-400">Status</div>
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      role="menuitem"
                      onClick={() => {
                        onStatusFilterChange?.(statusFilter === opt.value ? null : opt.value);
                        setFilterOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs cursor-pointer border-none ${
                        statusFilter === opt.value
                          ? "bg-blue-50 font-medium text-brand"
                          : "bg-transparent text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active filters, as Figma's chips row (node 393:19990). Hidden until
          something is selected so the desktop layout stays as it was. */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
          {planFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint text-brand text-sm font-medium pl-2.5 pr-1 py-1">
              {planFilter}
              <button
                onClick={() => onPlanFilterChange?.(null)}
                aria-label={`Remove ${planFilter} filter`}
                className="flex items-center justify-center w-4 h-4 p-0 border-none bg-transparent cursor-pointer text-brand"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {statusFilter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint text-brand text-sm font-medium pl-2.5 pr-1 py-1">
              {statusFilter === "PAID" ? "Paid" : "Unpaid"}
              <button
                onClick={() => onStatusFilterChange?.(null)}
                aria-label="Remove status filter"
                className="flex items-center justify-center w-4 h-4 p-0 border-none bg-transparent cursor-pointer text-brand"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <button
            onClick={() => onClearFilters?.()}
            className="text-sm font-medium text-brand border-none bg-transparent cursor-pointer p-0"
          >
            Clear All
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-y border-hairline bg-surface-bg">
              <th className="px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap">
                Member
              </th>
              <th className="px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap">
                Plan
              </th>
              <th className="px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap">
                Amount
              </th>
              <th className="hidden md:table-cell px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap">
                Date
              </th>
              <th className="px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap">
                Email
              </th>
              <th className="px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap">
                Status
              </th>
              <th className="hidden sm:table-cell px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[#f3f4f8]">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-5 py-3">
                      <Skeleton className="h-3 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              // Must precede the empty-row check: a failed fetch resolves to
              // an empty array, so without this the table shows "No
              // transactions found" rather than telling the admin the load
              // actually failed. Same colSpan as the empty row so the header
              // alignment is unchanged.
              <tr>
                <td colSpan={7} className="px-5 py-4 text-center text-xs text-danger">
                  Couldn't load member payments.
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-lg py-3 px-3 text-center">
                    <span className="text-xs text-gray-400">No transactions found</span>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx, i) => {
                const s = statusStyle(tx.status ?? "pending");
                const isPaid = ["success", "successful", "paid"].includes(
                  (tx.status ?? "").toLowerCase(),
                );
                return (
                  <tr
                    key={tx.id ?? i}
                    onClick={() => tx.id && onRowClick(tx.id)}
                    className={`border-b border-[#f3f4f8] hover:bg-[#fafbff] transition-colors ${tx.id ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <td className="px-5 py-3 text-xs font-medium text-brand">
                      {resolveMemberName(tx) ??
                        tx.member?.user?.email ??
                        tx.user?.email ??
                        tx.email ??
                        "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-accent-gold" />
                        <span className="text-xs text-black">
                          {toTitleCase(tx.planName ?? tx.description) ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-black">{formatNaira(tx.amount)}</td>
                    <td className="hidden md:table-cell px-5 py-3 text-xs text-black">
                      {formatDate(tx.paidAt ?? tx.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-xs text-black">
                      {tx.member?.user?.email ??
                        tx.user?.email ??
                        tx.payer?.email ??
                        tx.member?.email ??
                        tx.email ??
                        "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                    <td
                      className="hidden sm:table-cell px-5 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <ReceiptDownloadButton
                          tx={{
                            amount: tx.amount,
                            description: tx.planName ?? tx.description,
                            communityName: community?.name,
                            communityLogo: community?.logo,
                            date: tx.paidAt ?? tx.createdAt,
                            channel: tx.channel,
                            reference: tx.internalReference ?? tx.id,
                            status: tx.status,
                            payerPhoto:
                              tx.member?.profileImage?.url ?? tx.user?.profileImage?.url ?? null,
                            feeMinor:
                              tx.feeMinor ??
                              tx.fee ??
                              (tx.amountPaid != null &&
                              tx.amount != null &&
                              tx.amountPaid > tx.amount
                                ? tx.amountPaid - tx.amount
                                : null),
                          }}
                          payerName={resolveMemberName(tx)}
                          payerEmail={tx.member?.user?.email ?? tx.user?.email ?? tx.email}
                          disabled={!isPaid}
                          iconSize={11}
                          title={
                            isPaid
                              ? "Download receipt"
                              : "Receipts are only available for successful payments"
                          }
                          buttonClassName="flex items-center justify-center"
                        />
                        <Button
                          variant="tertiary"
                          size="icon-sm"
                          disabled
                          title="Send reminder — coming soon"
                          aria-label="Send reminder — coming soon"
                        >
                          <img
                            src={TimerIcon}
                            className="w-2.5 h-2.5 object-contain"
                            alt="Send reminder"
                          />
                        </Button>
                        <Button
                          variant="tertiary"
                          size="icon-sm"
                          disabled
                          title="More options — coming soon"
                          aria-label="More options — coming soon"
                        >
                          <MoreHorizontal size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — same shape as settings/admin/SystemConfig: a count, a
          Previous chevron, a windowed page list, a Next chevron. Rendered at
          every breakpoint, since the list is client-side either way. */}
      {!isLoading && !error && pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <p className="text-xs text-gray-400 m-0">
            {total} payment{total === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Previous page"
              title="Previous"
              onClick={() => onPageChange?.(Math.max(0, page - 1))}
              disabled={page === 0}
              className=""
            >
              <ChevronLeft size={13} />
            </Button>
            {Array.from({ length: pageCount }, (_, i) => i)
              .filter((i) => Math.abs(i - page) <= 2)
              .map((i) => (
                <button
                  key={i}
                  onClick={() => onPageChange?.(i)}
                  aria-current={i === page ? "page" : undefined}
                  className={`w-7 h-7 flex items-center justify-center rounded-g-2 text-xs font-medium cursor-pointer transition-all ${
                    i === page
                      ? "bg-brand text-white border-none"
                      : "bg-white text-gray-500 hover:bg-surface-sunken border border-surface-container-border"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Next page"
              title="Next"
              onClick={() => onPageChange?.(Math.min(pageCount - 1, page + 1))}
              disabled={page >= pageCount - 1}
              className=""
            >
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
