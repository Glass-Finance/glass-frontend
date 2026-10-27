import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Download, RefreshCw, Landmark } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import LoadingState from "../../../components/common/LoadingState";
import { getErrorMessage } from "../../../utils/errorHandler";
import { useExportJob } from "../../../hooks/useExportJob";
import {
  getAdminSettlement,
  getAdminSettlements,
  syncAdminSettlements,
  exportAdminSettlements,
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

function SettlementDetailModal({ settlementId, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-settlement", settlementId],
    queryFn: () => getAdminSettlement(settlementId).then((r) => r.data?.data),
    staleTime: 30_000,
  });
  const transactions = data?.transactions ?? [];

  return (
    <ModalShell
      className="rounded-g-1!"
      title="Settlement"
      subtitle={data?.gatewaySettlementId}
      onClose={onClose}
    >
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <LoadingState className="py-10" />
        ) : error ? (
          <p className="text-xs text-danger">{getErrorMessage(error)}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Gross</p>
                <p className="text-sm font-bold text-gray-900">{fmt(data.gross, data.currency)}</p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Net</p>
                <p className="text-sm font-bold text-gray-900">{fmt(data.net, data.currency)}</p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Fees + Deductions</p>
                <p className="text-sm font-bold text-gray-900">
                  {fmt((data.fees ?? 0) + (data.deductions ?? 0), data.currency)}
                </p>
              </div>
              <div className="bg-white rounded-g-1 p-3 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Variance</p>
                <p
                  className={`text-sm font-bold ${data.variance ? "text-red-600" : "text-gray-900"}`}
                >
                  {fmt(data.variance, data.currency)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-900">
                Matched Transactions ({data.matchedTransactionCount ?? transactions.length})
              </p>
              <StatusBadge status={data.status} />
            </div>

            {data.failureReason && <p className="text-xs text-danger mb-3">{data.failureReason}</p>}

            {transactions.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                No transactions linked to this settlement.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {transactions.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white rounded-g-1 p-3 flex items-center justify-between gap-3 border border-surface-container-border"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-gray-700 truncate">{t.reference}</p>
                      <p className="text-[10px] text-gray-400">{fmtDateTime(t.paidAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {t.matched ? (
                        <ShieldCheck size={13} className="text-success" />
                      ) : (
                        <ShieldAlert size={13} className="text-danger" />
                      )}
                      <span className="text-xs font-semibold text-gray-900">
                        {fmt(t.net, t.currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}

export default function SettlementsSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [openSettlementId, setOpenSettlementId] = useState(null);
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

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-settlements", params],
    queryFn: () => getAdminSettlements(params).then(unwrap),
    staleTime: 30_000,
    placeholderData: (p) => p,
  });

  const sync = useMutation({
    mutationFn: () => syncAdminSettlements({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-settlements"] }),
    meta: { successMessage: "Settlement sync queued — new settlements will appear shortly." },
  });

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="Settlements"
        desc="Gateway settlement batches and their matched transactions."
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
              placeholder="Search settlements…"
            />
            <FilterSelect
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "PENDING", label: "Pending" },
                // SettlementStatus has no MATCHED member -- the settled state is
                // SUCCESS (and PROCESSING while it is still moving). The option
                // used to send "MATCHED", which binds to nothing and so always
                // returned an empty page.
                { value: "SUCCESS", label: "Matched" },
                { value: "MISMATCHED", label: "Mismatched" },
              ]}
            />
            <Button
              variant="outline-neutral"
              size="xs"
              fullWidth={false}
              onClick={() => csvExport.run(() => exportAdminSettlements(params))}
              disabled={csvExport.isExporting}
            >
              <Download size={12} /> {csvExport.isExporting ? "Exporting…" : "Export"}
            </Button>
            <Button
              variant="primary"
              size="xs"
              fullWidth={false}
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              <RefreshCw size={12} className={sync.isPending ? "animate-spin" : ""} /> Sync Now
            </Button>
          </>
        }
      />

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIcon={Landmark}
        emptyLabel="No settlements found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Settlement", "Gross", "Fees", "Net", "Status", "Variance", "Settled At"].map(
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
            {items.map((s, i) => (
              <tr
                key={s.id}
                onClick={() => setOpenSettlementId(s.id)}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3">
                  <p className="text-[12px] font-mono text-gray-700">
                    {s.gatewaySettlementId ?? s.id}
                  </p>
                  <p className="text-[10px] text-gray-400">{s.matchedTransactionCount ?? 0} txns</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">{fmt(s.gross, s.currency)}</td>
                <td className="px-4 py-3 text-xs text-gray-700">
                  {fmt((s.fees ?? 0) + (s.deductions ?? 0), s.currency)}
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-gray-900">
                  {fmt(s.net, s.currency)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td
                  className={`px-4 py-3 text-xs ${s.variance ? "text-red-600 font-semibold" : "text-gray-400"}`}
                >
                  {fmt(s.variance, s.currency)}
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {fmtDateTime(s.settledAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="settlement"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />

      {openSettlementId && (
        <SettlementDetailModal
          settlementId={openSettlementId}
          onClose={() => setOpenSettlementId(null)}
        />
      )}
    </div>
  );
}
