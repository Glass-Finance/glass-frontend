import { ChevronDown } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { toTitleCase, formatDate } from "../../../../utils/format";
import { formatNaira, statusStyle, freqStyle } from "../helpers";
import { isPaidObligationStatus } from "../../../../utils/paymentStatus";

export default function YourPaymentsSection({
  rows,
  sortDir,
  onToggleSort,
  filter,
  filterOpen,
  onToggleFilterOpen,
  onFilterSelect,
  onPayNow,
}) {
  return (
    <div className="bg-surface-container rounded-g-2 md:rounded-xl border border-surface-container-border p-3 md:p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-black">Your Payments</span>
        <div className="flex items-center gap-2">
          <Button variant="outline-neutral" size="xs" fullWidth={false} onClick={onToggleSort}>
            Sort
            <ChevronDown size={11} className={sortDir === "asc" ? "rotate-180" : ""} />
          </Button>
          <div className="relative">
            <Button
              variant="outline-neutral"
              size="xs"
              fullWidth={false}
              onClick={onToggleFilterOpen}
            >
              Filter <ChevronDown size={11} />
            </Button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-surface-container-border shadow-lg z-20 min-w-[110px] overflow-hidden">
                {[
                  { key: null, label: "All" },
                  { key: "unpaid", label: "Unpaid" },
                  { key: "paid", label: "Paid" },
                ].map((opt) => (
                  <button
                    key={String(opt.key)}
                    onClick={() => onFilterSelect(opt.key)}
                    className={`w-full px-3 py-2 text-left text-xs cursor-pointer border-none ${
                      filter === opt.key
                        ? "bg-blue-50 font-medium text-brand"
                        : "bg-transparent text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Table shell (headers) stays visible even with nothing due -- a
          single dashed ghost row below stands in for real rows rather than
          the generic icon-in-a-circle EmptyState, so this still reads as
          "an empty table" instead of losing its shape entirely. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-100 bg-stacked-container">
              {[
                { label: "Plan" },
                { label: "Frequency" },
                { label: "Amount" },
                // Figma's mobile table (node 371:20116) drops Due Date and
                // keeps Plan/Frequency/Amount/Status/Action, so the column
                // gives a narrow phone back ~90px instead of scrolling.
                { label: "Due Date", className: "hidden md:table-cell" },
                { label: "Status" },
                { label: "Action" },
              ].map((h) => (
                <th
                  key={h.label}
                  className={`p-2 text-left text-xs font-normal text-gray-400 ${h.className ?? ""}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 px-2">
                  <div className="border-2 border-dashed border-gray-200 rounded-lg py-3 px-3 text-center">
                    <span className="text-xs text-gray-400">Nothing due right now</span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isPaid = isPaidObligationStatus(row.status);
                const s = statusStyle(isPaid ? "paid" : "unpaid");
                const f = freqStyle(row);
                return (
                  <tr key={row.id} className="border-b border-gray-50">
                    <td className="py-3 px-2 text-xs font-medium text-gray-800">
                      {toTitleCase(row.name)}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${f.cls}`}>
                        {f.label}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs font-medium text-black">
                      {formatNaira(row.amount)}
                    </td>
                    <td className="hidden md:table-cell py-3 px-2 text-xs text-gray-500">
                      {row.dueDate ? formatDate(row.dueDate) : "—"}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {isPaid ? (
                        <Button variant="outline" size="xs" fullWidth={false} disabled>
                          Pay Now
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="xs"
                          fullWidth={false}
                          onClick={() => onPayNow(row)}
                        >
                          Pay Now
                        </Button>
                      )}
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
