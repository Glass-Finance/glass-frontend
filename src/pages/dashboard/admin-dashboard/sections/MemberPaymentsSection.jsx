import { Download, Search, ChevronDown, MoreHorizontal } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import ReceiptDownloadButton from "../../../../components/dashboard/ReceiptDownloadButton";
import { toTitleCase, formatDate } from "../../../../utils/format";
import TimerIcon from "../../../../assets/dashboard/timer.webp";
import { Skeleton } from "../../../../components/common/SkeletonUI";
import { formatNaira, statusStyle } from "../helpers";

export default function MemberPaymentsSection({
  transactions,
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
  return (
    <div
      data-tour="member-payments-table"
      className="bg-surface-container rounded-xl border border-surface-container-border"
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
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search members, payments, receipts..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-gray-600 placeholder-gray-400"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs self-end sm:self-auto">
          Sort by:
          <Button variant="outline-neutral" size="sm" fullWidth={false} onClick={onToggleSort}>
            {sortDir === "desc" ? "Recent" : "Oldest"}{" "}
            <ChevronDown size={11} className={sortDir === "asc" ? "rotate-180" : ""} />
          </Button>
        </div>
      </div>

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
              <th className="hidden lg:table-cell px-5 py-2.5 text-left text-xs font-normal text-gray-400 whitespace-nowrap">
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
                    <td className="hidden lg:table-cell px-5 py-3 text-xs text-black">
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
    </div>
  );
}
