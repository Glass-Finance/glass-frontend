import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useQuery } from "@tanstack/react-query";
import { Download, FileClock, RefreshCw } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import LoadingState from "../../../components/common/LoadingState";
import { getErrorMessage } from "../../../utils/errorHandler";
import { useExportJob } from "../../../hooks/useExportJob";
import {
  getAdminObligation,
  getAdminObligations,
  exportAdminObligations,
} from "../../../api/admin";
import { fmt, fmtDateTime, unwrap, pageParams } from "./shared";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  StatusBadge,
  SectionHeader,
  SearchBar,
  FilterSelect,
  TableShell,
  TableFooter,
} from "./SharedUI";

// ObligationStatus enum from the backend.
const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "DUE", label: "Due" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PAID", label: "Paid" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "WAIVED", label: "Waived" },
  { value: "CANCELLED", label: "Cancelled" },
];

// memberRef is the human-facing handle ops use to identify a payer; fall back
// to the name, then email, since not every obligation row carries all three.
function payerName(o) {
  const m = o.member;
  if (m) {
    return [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.memberRef || "—";
  }
  const u = o.user;
  if (u) {
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "—";
  }
  return "—";
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-xs text-gray-900 break-all ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
    </div>
  );
}

function ObligationDetailModal({ obligationId, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-obligation", obligationId],
    queryFn: () => getAdminObligation(obligationId).then((r) => r.data?.data),
    staleTime: 30_000,
  });

  const amount = data?.amount;
  const paid = data?.amountPaid;
  // Only show outstanding when there's something actually outstanding —
  // a fully-paid obligation reading "₦0 outstanding" is noise, and a partial
  // one is the case ops actually scan for.
  const outstanding =
    amount != null && paid != null && Number(amount) - Number(paid) > 0
      ? Number(amount) - Number(paid)
      : null;

  return (
    <ModalShell
      className="rounded-g-1!"
      title="Obligation"
      subtitle={data?.member?.memberRef}
      onClose={onClose}
    >
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <LoadingState className="py-10" />
        ) : error ? (
          <p className="text-xs text-danger">{getErrorMessage(error)}</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <p className="text-2xl font-bold text-gray-900">{fmt(amount, "NGN")}</p>
              <StatusBadge status={data.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Amount paid</p>
                <p className="text-sm font-bold text-gray-900">{fmt(paid, "NGN")}</p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Outstanding</p>
                <p
                  className={`text-sm font-bold ${outstanding != null ? "text-red-600" : "text-gray-900"}`}
                >
                  {outstanding != null ? fmt(outstanding, "NGN") : "—"}
                </p>
              </div>
            </div>

            {/* Retry counters matter here: an obligation can look merely
                OVERDUE while auto-debit has already burned every attempt, in
                which case waiting will never resolve it. */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Attempts</p>
                <p className="text-sm font-bold text-gray-900">{data.attemptCount ?? 0}</p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Auto-debit</p>
                <p className="text-sm font-bold text-gray-900">{data.autoDebitAttemptCount ?? 0}</p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Manual</p>
                <p className="text-sm font-bold text-gray-900">{data.manualAttemptCount ?? 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Amount mode" value={data.amountMode} />
              <DetailRow label="Community" value={data.community?.name} />
              <DetailRow label="Payer" value={payerName(data)} />
              <DetailRow label="Payment link" value={data.paymentLink?.title} />
              <DetailRow label="Recurring plan" value={data.recurringPlan?.title} />
              <DetailRow label="Cycle start" value={fmtDateTime(data.cycleStart)} />
              <DetailRow label="Due at" value={fmtDateTime(data.dueAt)} />
              <DetailRow
                label="Grace period"
                value={data.gracePeriod != null ? `${data.gracePeriod}h` : "—"}
              />
              <DetailRow label="Last attempt" value={fmtDateTime(data.lastAttemptAt)} />
              <DetailRow label="Next retry" value={fmtDateTime(data.nextRetryAt)} />
              <DetailRow
                label="Retries exhausted"
                value={data.retryExhaustedAt ? fmtDateTime(data.retryExhaustedAt) : "No"}
              />
              <DetailRow label="Created" value={fmtDateTime(data.createdAt)} />
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

export default function ObligationsSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const csvExport = useExportJob();
  const debouncedSet = useDebounce((v) => {
    setDebouncedSearch(v);
    setPage(0);
  });

  const params = {
    ...pageParams(page),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status !== "ALL" ? { status } : {}),
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-obligations", params],
    queryFn: () => getAdminObligations(params).then(unwrap),
    staleTime: 30_000,
    placeholderData: (p) => p,
  });

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="Obligations"
        desc="Recurring and one-off payment obligations owed by members across all communities."
        count={data?.totalElements ?? 0}
        isFetching={isFetching && !isLoading}
        right={
          <>
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                debouncedSet(v);
              }}
              placeholder="Search obligations…"
            />
            <FilterSelect
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
              options={STATUS_OPTIONS}
            />
            <Button
              variant="outline-neutral"
              size="xs"
              fullWidth={false}
              onClick={() => csvExport.run(() => exportAdminObligations(params))}
              disabled={csvExport.isExporting}
            >
              <Download size={12} /> {csvExport.isExporting ? "Exporting…" : "Export"}
            </Button>
            <Button variant="outline-neutral" size="xs" fullWidth={false} onClick={() => refetch()}>
              <RefreshCw size={12} /> Refresh
            </Button>
          </>
        }
      />

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIcon={FileClock}
        emptyLabel="No obligations found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Payer", "Community", "Amount", "Paid", "Status", "Due", "Attempts"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((o, i) => (
              <tr
                key={o.id}
                onClick={() => setOpenId(o.id)}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3">
                  <p className="text-xs text-gray-700">{payerName(o)}</p>
                  {o.member?.memberRef && (
                    <p className="text-[10px] text-gray-400 font-mono">{o.member.memberRef}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">{o.community?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                  {fmt(o.amount)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                  {fmt(o.amountPaid)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {fmtDateTime(o.dueAt)}
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {o.attemptCount ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="obligation"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />

      {openId && <ObligationDetailModal obligationId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
