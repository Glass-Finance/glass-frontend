import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useQuery } from "@tanstack/react-query";
import { Download, Receipt, RefreshCw } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import LoadingState from "../../../components/common/LoadingState";
import { getErrorMessage } from "../../../utils/errorHandler";
import { useExportJob } from "../../../hooks/useExportJob";
import {
  getAdminTransaction,
  getAdminTransactions,
  exportAdminTransactions,
} from "../../../api/admin";
import { fmt, fmtDateTime, unwrap, pageParams, initialSearchFromUrl } from "./shared";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  StatusBadge,
  SectionHeader,
  SearchBar,
  FilterSelect,
  TableShell,
  TableFooter,
} from "./SharedUI";

// TransactionStatus enum from the backend — offering anything outside this
// list would send a value the DTO doesn't declare, which the backend rejects
// (or worse, silently ignores, making the filter look broken).
const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "INITIATED", label: "Initiated" },
  { value: "PENDING", label: "Pending" },
  { value: "SUCCESSFUL", label: "Successful" },
  { value: "FAILED", label: "Failed" },
  { value: "ABANDONED", label: "Abandoned" },
];

// The payer, as the backend embeds them. member is preferred when present
// (a community member paying) and user is the fallback (a platform-level
// actor), since a transaction can be attached to either.
function payerName(tx) {
  const m = tx.member;
  if (m) {
    return [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || "—";
  }
  const u = tx.user;
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

function TransactionDetailModal({ transactionId, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-transaction", transactionId],
    queryFn: () => getAdminTransaction(transactionId).then((r) => r.data?.data),
    staleTime: 30_000,
  });

  const currency = data?.currency ?? "NGN";

  return (
    <ModalShell
      className="rounded-g-1!"
      size="wide"
      title="Transaction"
      subtitle={data?.internalReference}
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
              <p className="text-2xl font-bold text-gray-900">{fmt(data.amount, currency)}</p>
              <StatusBadge status={data.status} />
            </div>

            {data.failureReason && (
              <div className="bg-red-50 rounded-g-1 p-3 mb-4 border border-red-100">
                <p className="text-[10px] text-red-400 mb-0.5">Failure reason</p>
                <p className="text-xs text-red-700">{data.failureReason}</p>
              </div>
            )}

            {/* Money breakdown. amountMode decides which figure is the real
                charge, so surface all three rather than guessing which one the
                reader cares about. */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Base amount</p>
                <p className="text-sm font-bold text-gray-900">{fmt(data.baseAmount, currency)}</p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Billed amount</p>
                <p className="text-sm font-bold text-gray-900">
                  {fmt(data.billedAmount, currency)}
                </p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Net</p>
                <p className="text-sm font-bold text-gray-900">{fmt(data.net, currency)}</p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Fees</p>
                <p className="text-sm font-bold text-gray-900">
                  {fmt((data.platformFee ?? 0) + (data.processorFee ?? 0), currency)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Amount mode" value={data.amountMode} />
              <DetailRow label="Provider" value={data.provider} />
              <DetailRow label="Channel" value={data.channel} />
              <DetailRow label="Verification source" value={data.verificationSource} />
              <DetailRow label="Community" value={data.community?.name} />
              <DetailRow label="Payment link" value={data.paymentLink?.title} />
              <DetailRow label="Payer" value={payerName(data)} />
              <DetailRow label="Paid at" value={fmtDateTime(data.paidAt)} />
              <DetailRow label="Internal reference" value={data.internalReference} mono />
              <DetailRow label="Gateway reference" value={data.gatewayReference} mono />
              <DetailRow label="Gateway transaction id" value={data.gatewayTransactionId} mono />
              <DetailRow label="Idempotency key" value={data.idempotencyKey} mono />
              <DetailRow label="Description" value={data.description} />
              <DetailRow label="Created" value={fmtDateTime(data.createdAt)} />
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

export default function TransactionsSection() {
  const [search, setSearch] = useState(initialSearchFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchFromUrl);
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
    queryKey: ["admin-transactions", params],
    queryFn: () => getAdminTransactions(params).then(unwrap),
    staleTime: 30_000,
    // Keeps the previous page on screen while the next loads, so paging
    // doesn't flash the empty/loading state between every click.
    placeholderData: (p) => p,
  });

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="Transactions"
        desc="Every payment transaction across all communities on the platform."
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
              placeholder="Search transactions…"
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
              onClick={() => csvExport.run(() => exportAdminTransactions(params))}
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
        emptyIcon={Receipt}
        emptyLabel="No transactions found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Reference", "Community", "Payer", "Amount", "Status", "Channel", "Created"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((t, i) => (
              <tr
                key={t.id}
                onClick={() => setOpenId(t.id)}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3">
                  <p className="text-[12px] font-mono text-gray-700">
                    {t.internalReference ?? t.id}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono">{t.provider ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">{t.community?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-gray-700">{payerName(t)}</td>
                <td className="px-4 py-3 text-xs font-semibold text-gray-900 whitespace-nowrap">
                  {fmt(t.amount, t.currency)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={t.status} />
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500">{t.channel ?? "—"}</td>
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {fmtDateTime(t.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="transaction"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />

      {openId && <TransactionDetailModal transactionId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
