import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../components/ui/Button";
import { RefreshCw } from "lucide-react";
import LoadingState from "../../../components/common/LoadingState";
import { getAdminBalances } from "../../../api/admin";
import { fmt, fmtDate } from "./shared";
import { SectionHeader } from "./SharedUI";

export default function BalancesSection() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-balances"],
    queryFn: () => getAdminBalances({}).then((r) => r.data?.data),
    staleTime: 60_000,
  });

  const balances = data?.balances ?? [];
  const currency = data?.currency ?? "NGN";

  return (
    <div>
      <SectionHeader
        title="Platform Balances"
        desc="Aggregate ledger balances across all communities."
        isFetching={isFetching && !isLoading}
        right={
          <Button variant="outline-neutral" size="xs" fullWidth={false} onClick={() => refetch()}>
            <RefreshCw size={12} /> Refresh
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState className="py-20" />
      ) : error ? (
        <p className="text-xs text-danger text-center py-10">{error.message}</p>
      ) : (
        <>
          {/* Residual / reconciliation — /admin/balances returns already
              major-unit decimals (e.g. 0.00 = ₦0.00), not kobo, so minor
              is false here. Shown to 2dp since this is a reconciliation
              figure — rounding to whole naira could hide a real
              discrepancy that should surface as "Out of balance". */}
          <div className="bg-surface-container rounded-g-1 p-5 mb-4 flex items-center justify-between border border-surface-container-border">
            <div>
              <p className="text-xs text-gray-400 mb-1">Platform Residual</p>
              <p className="text-2xl font-bold text-gray-900">
                {fmt(data?.residual, currency, { minor: false, decimals: 2 })}
              </p>
            </div>
            <span
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full ${data?.reconciles ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
            >
              {data?.reconciles ? "Reconciled" : "Out of balance"}
            </span>
          </div>

          {/* Balance entries — same major-unit + 2dp treatment as above */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {balances.map((b) => (
              <div
                key={b.code}
                className="bg-surface-container rounded-g-1 p-5 border border-surface-container-border"
              >
                <p className="text-[10px] text-gray-400 font-mono mb-1">{b.code}</p>
                <p className="text-[15px] font-bold text-gray-900 mb-0.5">
                  {fmt(b.amount, b.currency ?? currency, {
                    minor: false,
                    decimals: 2,
                  })}
                </p>
                <p className="text-xs text-gray-500">{b.displayName}</p>
              </div>
            ))}
          </div>

          {data?.to && (
            <p className="text-[11px] text-gray-400 text-right mt-3">As of {fmtDate(data.to)}</p>
          )}
        </>
      )}
    </div>
  );
}
