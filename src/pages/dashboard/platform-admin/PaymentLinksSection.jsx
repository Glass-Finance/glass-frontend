import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { getAdminPaymentLinks } from "../../../api/admin";
import { unwrap, pageParams, fmt, fmtDate } from "./shared";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  StatusBadge,
  SectionHeader,
  SearchBar,
  FilterSelect,
  TableShell,
  TableFooter,
} from "./SharedUI";

export default function PaymentLinksSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(0);
  const debouncedSet = useDebounce((v) => {
    setDebouncedSearch(v);
    setPage(0);
  });

  const params = {
    ...pageParams(page),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status !== "ALL" ? { status } : {}),
    ...(type !== "ALL" ? { paymentType: type } : {}),
    includeMetrics: true,
  };

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-payment-links", params],
    queryFn: () => getAdminPaymentLinks(params).then(unwrap),
    staleTime: 0, // Admin operations need immediate consistency
    placeholderData: (p) => p,
    refetchOnMount: "always",
  });

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="Payment Links"
        desc="All payment links across all communities."
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
              placeholder="Search payment links…"
              width={220}
            />
            <FilterSelect
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "ACTIVE", label: "Active" },
                { value: "DRAFT", label: "Draft" },
                { value: "PAUSED", label: "Paused" },
                { value: "EXPIRED", label: "Expired" },
                { value: "DELETED", label: "Deleted" },
              ]}
            />
            <FilterSelect
              value={type}
              onChange={(v) => {
                setType(v);
                setPage(0);
              }}
              options={[
                { value: "ALL", label: "All types" },
                { value: "ONE_TIME", label: "One-time" },
                { value: "RECURRING", label: "Recurring" },
              ]}
            />
          </>
        }
      />

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIcon={Wallet}
        emptyLabel="No payment links found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {[
                "Title",
                "Community",
                "Type",
                "Amount",
                "Collected",
                "Paid / Total",
                "Status",
                "Created",
              ].map((h) => (
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
            {items.map((l, i) => (
              <tr
                key={l.id}
                className={`hover:bg-gray-50 transition-colors ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3 max-w-[180px]">
                  <p className="text-[12px] font-semibold text-gray-900 truncate">{l.title}</p>
                  <p className="text-[10px] text-gray-400 font-mono truncate">{l.referenceCode}</p>
                </td>
                <td className="px-4 py-3 max-w-[140px]">
                  <p className="text-[11px] text-gray-600 truncate">{l.community?.name}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={l.paymentType} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-[12px] text-gray-700">{fmt(l.amount, l.currency)}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-[12px] text-gray-700">
                    {fmt(l.metrics?.amountCollected, l.currency)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {l.metrics?.audienceSize > 0 ? (
                    <span className="text-[11px] text-gray-600">
                      {l.metrics.membersFullyPaid} / {l.metrics.audienceSize}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-[11px] text-gray-500">{fmtDate(l.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="payment link"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />
    </div>
  );
}
