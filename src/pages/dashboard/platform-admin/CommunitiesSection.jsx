import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Building2, SlidersHorizontal, Edit2 } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import Toggle from "../../../components/common/Toggle";
import { Button } from "../../../components/ui/Button";
import { getAdminCommunities, setCommissionOverride } from "../../../api/admin";
import { updateCommunitySettings } from "../../../api/communities";
import { fmt, fmtDate, unwrap, pageParams, withSafeCommunityLogos } from "./shared";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  StatusBadge,
  SectionHeader,
  SearchBar,
  FilterSelect,
  TableShell,
  TableFooter,
} from "./SharedUI";

function CommissionModal({ community, onClose }) {
  const queryClient = useQueryClient();
  const [useDefault, setUseDefault] = useState(!community.commissionRate);
  const [rate, setRate] = useState(String(community.commissionRate ?? ""));
  const [cap, setCap] = useState(
    community.commissionCapMinor ? String(Math.round(community.commissionCapMinor / 100)) : "",
  );

  const mutation = useMutation({
    mutationFn: (payload) => setCommissionOverride(community.slug ?? community.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-communities"] });
      onClose();
    },
    meta: { successMessage: "Commission updated" },
  });

  function submit(e) {
    e.preventDefault();
    mutation.mutate(
      useDefault
        ? { rate: null, capMinor: null }
        : {
            rate: Number(rate) || 0,
            capMinor: cap ? Math.round(Number(cap) * 100) : 0,
          },
    );
  }

  return (
    <ModalShell title="Commission Override" subtitle={community.name} onClose={onClose}>
      <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useDefault}
            onChange={(e) => setUseDefault(e.target.checked)}
            className="w-4 h-4 accent-brand"
          />
          <span className="text-xs font-semibold text-gray-700">Use platform default rate</span>
        </label>

        {!useDefault && (
          <>
            <div>
              <label
                htmlFor="commission-rate"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                Rate{" "}
                <span className="font-normal text-gray-400">(basis points — 100 bps = 1%)</span>
              </label>
              <input
                id="commission-rate"
                type="number"
                min="0"
                max="10000"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full h-12 min-h-8 px-4 py-1 rounded-lg border border-hairline-strong text-placeholder text-gray-800 outline-none transition-colors focus:border-brand"
                placeholder="e.g. 150 for 1.5%"
              />
              {Number(rate) > 0 && (
                <p className="text-[10px] text-gray-400 mt-1">
                  = {(Number(rate) / 100).toFixed(2)}%
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="commission-cap"
                className="block text-xs font-semibold text-gray-700 mb-1.5"
              >
                Cap <span className="font-normal text-gray-400">(₦, leave blank for no cap)</span>
              </label>
              <input
                id="commission-cap"
                type="number"
                min="0"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                className="w-full h-12 min-h-8 px-4 py-1 rounded-lg border border-hairline-strong text-placeholder text-gray-800 outline-none transition-colors focus:border-brand"
                placeholder="e.g. 500"
              />
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline-neutral"
            onClick={onClose}
            fullWidth={false}
            size="sm"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={mutation.isPending}
            fullWidth={false}
            className="flex-1"
          >
            {mutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

// Platform-admin editor for the same two settings a community owner
// controls from Settings -> Member Access (updateCommunitySettings accepts
// the same payload regardless of which role's token calls it).
function CommunitySettingsModal({ community, onClose }) {
  const queryClient = useQueryClient();
  const [requiresMemberApproval, setRequiresMemberApproval] = useState(
    !!community.requiresMemberApproval,
  );
  const [publicVisible, setPublicVisible] = useState(!!community.publicVisible);

  const mutation = useMutation({
    mutationFn: (payload) => updateCommunitySettings(community.slug ?? community.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-communities"] });
      onClose();
    },
    meta: { successMessage: "Community settings updated" },
  });

  function submit(e) {
    e.preventDefault();
    mutation.mutate({ requiresMemberApproval, publicVisible });
  }

  return (
    <ModalShell title="Joining & Visibility" subtitle={community.name} onClose={onClose}>
      <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-1">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-medium text-gray-900 m-0">Require approval to join</p>
            <p className="text-[11px] text-gray-400 mt-0.5 m-0">
              New join requests wait for admin approval instead of joining instantly.
            </p>
          </div>
          <Toggle on={requiresMemberApproval} onChange={setRequiresMemberApproval} showLabel />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-medium text-gray-900 m-0">Show in Discover</p>
            <p className="text-[11px] text-gray-400 mt-0.5 m-0">
              List this community in the public Discover Communities search.
            </p>
          </div>
          <Toggle on={publicVisible} onChange={setPublicVisible} showLabel />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline-neutral"
            onClick={onClose}
            fullWidth={false}
            size="sm"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={mutation.isPending}
            fullWidth={false}
            className="flex-1"
          >
            {mutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

export default function CommunitiesSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [editingCommission, setEditingCommission] = useState(null);
  const [editingSettings, setEditingSettings] = useState(null);
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
    queryKey: ["admin-communities", params],
    queryFn: () => getAdminCommunities(params).then((res) => withSafeCommunityLogos(unwrap(res))),
    staleTime: 60_000,
    placeholderData: (p) => p,
  });

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="Communities"
        desc="All communities registered on the platform."
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
              placeholder="Search communities…"
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
                { value: "PENDING_ONBOARDING", label: "Pending Onboarding" },
                { value: "SUSPENDED", label: "Suspended" },
                { value: "DELETING", label: "Deleting" },
                { value: "DELETED", label: "Deleted" },
              ]}
            />
          </>
        }
      />

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIcon={Building2}
        emptyLabel="No communities found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Community", "Status", "Commission", "Members", "Created", ""].map((h) => (
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
            {items.map((c, i) => (
              <tr
                key={c.id}
                className={`group hover:bg-gray-50 transition-colors ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {c.logo?.url ? (
                      <img
                        src={c.logo.url}
                        alt=""
                        className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-brand-tint flex items-center justify-center text-brand font-bold text-[10px] flex-shrink-0">
                        {(c.name ?? "C")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-[12px] font-semibold text-gray-900 leading-tight">
                        {c.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono">{c.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3">
                  {c.commissionRate > 0 ? (
                    <div>
                      <span className="text-[11px] font-semibold text-gray-800">
                        {(c.commissionRate / 100).toFixed(2)}%
                      </span>
                      {c.commissionCapMinor > 0 && (
                        <span className="text-[10px] text-gray-400 ml-1.5">
                          cap {fmt(c.commissionCapMinor)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400">Platform default</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[12px] text-gray-700">
                    {c.metrics?.totalMembers ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-[11px] text-gray-500">{fmtDate(c.createdAt)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <Button
                      variant="outline-neutral"
                      size="xs"
                      fullWidth={false}
                      onClick={() => setEditingSettings(c)}
                    >
                      <SlidersHorizontal size={11} /> Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      fullWidth={false}
                      onClick={() => setEditingCommission(c)}
                    >
                      <Edit2 size={11} /> Commission
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="community"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />
      {editingCommission && (
        <CommissionModal community={editingCommission} onClose={() => setEditingCommission(null)} />
      )}
      {editingSettings && (
        <CommunitySettingsModal
          community={editingSettings}
          onClose={() => setEditingSettings(null)}
        />
      )}
    </div>
  );
}
