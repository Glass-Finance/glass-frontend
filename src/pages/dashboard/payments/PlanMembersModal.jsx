import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { TextInput } from "../../../components/ui/TextInput";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Search, Filter } from "lucide-react";
import { getPaymentLinkMembers } from "../../../api/payments";
import { getCommunityObligations } from "../../../api/transactions";
import { waiveObligation } from "../../../api/communities";
import { exportCommunityObligations } from "../../../api/exports";
import { useExportJob } from "../../../hooks/useExportJob";
import { useEscapeToClose } from "../../../hooks/useKeyboardShortcuts";
import { useCommunityGroups, isArchivedGroup } from "../../../hooks/useGroups";
import ConfirmDialog from "../../../components/dashboard/ConfirmDialog";
import { formatNaira, toTitleCase, formatDate } from "../../../utils/format";
import { toastSuccess, toastWarning, toastInfo } from "../../../utils/toast";
import { getErrorMessage } from "../../../utils/errorHandler";
import { toast } from "sonner";
import LoadingState from "../../../components/common/LoadingState";
import { isPaidObligationStatus, isOverdueObligationStatus } from "../../../utils/paymentStatus";

// A row's rolled-up status is waivable when it represents money still owed:
// anything that isn't paid, already waived, or absent (NONE = the member has
// no obligation record for this link yet, so there is nothing to waive).
function isWaivableStatus(status) {
  return status !== "NONE" && status !== "WAIVED" && !isPaidObligationStatus(status);
}

// ── Plan members modal ────────────────────────────────────────────────────────
export default function PlanMembersModal({ plan, communityId, onClose }) {
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [groupId, setGroupId] = useState("");
  const [selected, setSelected] = useState([]);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [waiving, setWaiving] = useState(false);
  const [waiveError, setWaiveError] = useState("");
  const queryClient = useQueryClient();

  // While the waive confirm dialog is open it owns Escape (its ModalShell
  // handler), so the members modal must not also close underneath it.
  useEscapeToClose(onClose, !waiveOpen);

  const { data: groupsData } = useCommunityGroups(communityId, { pageSize: 200 });
  const groups = (groupsData?.content ?? []).filter((g) => !isArchivedGroup(g));

  const { data: planMembersData, isLoading } = useQuery({
    queryKey: ["plan-members", communityId, plan.id, groupId],
    queryFn: async () => {
      const res = await getPaymentLinkMembers(communityId, plan.id, {
        pageSize: 500,
        // groupId is a server-side filter (PaymentLinkMemberResponse rows are
        // resolved from the link's audience), so narrowing to a group like a
        // class/cohort refetches rather than slicing the already-loaded page.
        ...(groupId ? { groupId } : {}),
      });
      const raw = res.data?.data;
      return Array.isArray(raw) ? raw : (raw?.content ?? []);
    },
    enabled: !!(communityId && plan.id),
    staleTime: 1000 * 60,
  });

  // This endpoint already returns the authoritative member identity, rolled-up
  // obligation status, and aggregate amounts for this payment link.
  const planMembers = planMembersData ?? [];

  function resolveMember(m) {
    const f = m.firstName ?? "";
    const l = m.lastName ?? "";
    return {
      name: `${f} ${l}`.trim() || null,
      email: m.email ?? null,
      joinedAt: m.joinedAt ?? null,
    };
  }

  function getName(m) {
    const r = resolveMember(m);
    return toTitleCase(r.name ?? r.email ?? "Member");
  }
  function getEmail(m) {
    return resolveMember(m).email ?? "—";
  }
  function getJoinedAt(m) {
    return m.joinedAt ?? null;
  }

  function getStatus(m) {
    return (m.obligationStatus ?? "NONE").toUpperCase();
  }
  function getAmountPaid(m) {
    return m.amountPaid ?? 0;
  }
  function getAmountDue(m) {
    return m.totalAmountDue ?? 0;
  }

  function statusStyle(s) {
    if (s === "PAID") return { cls: "bg-success-wash text-success-strong", label: "Paid" };
    if (s === "OVERDUE") return { cls: "bg-danger-wash-2 text-danger-bright", label: "Overdue" };
    if (s === "DUE") return { cls: "bg-warning-wash text-warning", label: "Due" };
    if (s === "WAIVED") return { cls: "bg-[#f5f6fa] text-ink-muted", label: "Waived" };
    if (s === "NONE") return { cls: "bg-[#f5f6fa] text-ink-faint", label: "N/A" };
    return { cls: "bg-warning-wash text-warning", label: "Pending" };
  }

  const filtered = planMembers.filter((m) => {
    const q = search.toLowerCase();
    if (q && !getName(m).toLowerCase().includes(q) && !getEmail(m).toLowerCase().includes(q))
      return false;
    if (statusFilter === "Paid" && !isPaidObligationStatus(getStatus(m))) return false;
    if (statusFilter === "Unpaid" && isPaidObligationStatus(getStatus(m))) return false;
    if (statusFilter === "Overdue" && !isOverdueObligationStatus(getStatus(m))) return false;
    return true;
  });

  const paidCount = planMembers.filter((m) => isPaidObligationStatus(getStatus(m))).length;
  const totalCount = planMembers.length;
  const totalCollected = planMembers.reduce((sum, m) => sum + getAmountPaid(m), 0);

  // Real backend export job (see useExportJob.js) instead of a client-side
  // CSV -- that silently capped at whatever page of members was already
  // loaded and had no escaping for commas/quotes in names. This does mean
  // it always exports every member on this plan rather than just the
  // current search/selection subset, since the export job has no way to
  // filter by an arbitrary client-side member-id list.
  const { run: runExport, isExporting } = useExportJob();
  function exportCsv() {
    runExport(() => exportCommunityObligations(communityId, { paymentLinkId: plan.id }, "CSV"));
  }

  // ── Waive ──────────────────────────────────────────────────────────────────
  // Selected rows narrowed to the ones that can actually be waived: they need
  // a memberId (rows without one are name-keyed in `selected` and can't be
  // matched to an obligation record) and an unpaid rolled-up status.
  const selectedIds = new Set(selected);
  const waivableMembers = planMembers.filter(
    (m) => m.memberId && selectedIds.has(m.memberId) && isWaivableStatus(getStatus(m)),
  );
  const waivableCount = waivableMembers.length;

  function changeGroup(e) {
    setGroupId(e.target.value);
    // Rows are refetched per group, so a selection over the old row set
    // would silently carry over to different members.
    setSelected([]);
  }

  function openWaive() {
    setWaiveError("");
    setReason("");
    setWaiveOpen(true);
  }

  async function confirmWaive() {
    if (waiving) return;
    setWaiving(true);
    setWaiveError("");
    try {
      // PaymentLinkMemberResponse rows carry no obligation id (only rolled-up
      // status + counts), so resolve the actual obligation records for this
      // link and match them to the selection. paymentLinkId is a server-side
      // filter (ObligationQueryDto); the client-side plan check below is a
      // belt-and-braces guard if it is ever ignored.
      const res = await getCommunityObligations(communityId, {
        paymentLinkId: plan.id,
        pageSize: 1000,
      });
      const raw = res.data?.data;
      const obligations = Array.isArray(raw) ? raw : (raw?.content ?? []);
      const ids = new Set(selected);
      const targets = obligations.filter((o) => {
        // Rows key on PaymentLinkMemberResponse.memberId; obligations expose
        // the payer as `member` (community-member shape) or `user`. Match
        // either id kind, mirroring memberIdsMatch in useMembersWithPayments.
        const ref = o.member ?? o.user;
        const refId = typeof ref === "string" ? ref : ref?.id;
        const refUserId = typeof ref === "object" && ref ? (ref.userId ?? ref.user?.id) : null;
        const hit = (refId != null && ids.has(refId)) || (refUserId != null && ids.has(refUserId));
        if (!hit) return false;
        if (o.paymentLink?.id && o.paymentLink.id !== plan.id) return false;
        const s = (o.status ?? "").toUpperCase();
        return s !== "WAIVED" && !isPaidObligationStatus(s);
      });

      if (targets.length === 0) {
        toastInfo("Nothing to waive", {
          description: "No unpaid obligations found for the selected members.",
        });
        setWaiveOpen(false);
        setReason("");
        setSelected([]);
        return;
      }

      // No bulk endpoint exists — one PATCH per obligation, run together and
      // reported as a count rather than failing the whole batch on one reject.
      const payload = reason.trim() ? { reason: reason.trim() } : {};
      const results = await Promise.allSettled(
        targets.map((o) => waiveObligation(communityId, o.id, payload)),
      );
      const okCount = results.filter((r) => r.status === "fulfilled").length;
      const failedCount = results.length - okCount;
      if (failedCount === 0) {
        toastSuccess(`Waived ${okCount} ${okCount === 1 ? "obligation" : "obligations"}`);
      } else if (okCount === 0) {
        const first = results.find((r) => r.status === "rejected");
        toast.error(getErrorMessage(first?.reason, `Could not waive ${failedCount} obligations`));
      } else {
        toastWarning("Some obligations could not be waived", {
          description: `${okCount} waived · ${failedCount} failed`,
        });
      }

      // Waived status rolls up into this modal's rows, the dashboard's
      // obligations/overview, and the plan cards' paid counts — all four
      // key families those read from.
      queryClient.invalidateQueries({ queryKey: ["plan-members"] });
      queryClient.invalidateQueries({ queryKey: ["obligations"] });
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      queryClient.invalidateQueries({ queryKey: ["community", communityId] });
      setWaiveOpen(false);
      setReason("");
      setSelected([]);
    } catch (err) {
      // Keep the dialog open so the reason/selection aren't lost on a
      // transient failure — ConfirmDialog renders this where the user clicked.
      setWaiveError(getErrorMessage(err, "Could not waive obligations. Please try again."));
    } finally {
      setWaiving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-6 bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-bg rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-black">
              {toTitleCase(plan.name)} — Members
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isLoading
                ? "Loading…"
                : `${paidCount} / ${totalCount} paid · ${formatNaira(totalCollected)} collected`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="xs"
              fullWidth={false}
              onClick={exportCsv}
              disabled={isExporting}
            >
              {isExporting ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Close"
              onClick={onClose}
              className=""
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-surface-container-border flex-1 max-w-xs focus-within:border-[#002FA7] transition-colors">
            <Search size={12} className="text-gray-400 flex-shrink-0" />
            <input
              aria-label="Search members"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className="flex-1 bg-transparent border-none outline-none text-xs text-gray-600 placeholder-gray-400"
            />
          </div>
          <div className="relative">
            <Button
              variant="outline-neutral"
              size="sm"
              fullWidth={false}
              onClick={() => setFilterOpen((o) => !o)}
            >
              <Filter size={12} /> Filter
              {(statusFilter || groupId) && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
              )}
            </Button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute left-0 top-full mt-2 bg-white rounded-xl border border-surface-container-border shadow-lg z-20 p-4 w-52">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white mb-3"
                  >
                    <option value="">All</option>
                    <option>Paid</option>
                    <option>Unpaid</option>
                    <option>Overdue</option>
                  </select>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Group</label>
                  <select
                    value={groupId}
                    onChange={changeGroup}
                    className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-xs bg-white mb-3"
                  >
                    <option value="">All groups</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      variant="outline-neutral"
                      size="xs"
                      onClick={() => {
                        setStatusFilter("");
                        setGroupId("");
                        setSelected([]);
                        setFilterOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button variant="primary" size="xs" onClick={() => setFilterOpen(false)}>
                      Apply
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0">
              <tr className="border-y border-gray-100 bg-gray-50">
                <th className="px-5 py-2.5 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all members"
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? filtered.map((m) => m.memberId ?? getName(m)) : [],
                      )
                    }
                  />
                </th>
                {["Member", "Email", "Status", "Paid", "Total Due", "Date Joined"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7}>
                    <LoadingState className="py-10" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-4">
                    <div className="border-2 border-dashed border-gray-200 rounded-lg py-3 px-3 text-center">
                      <span className="text-xs text-gray-400">
                        {planMembers.length === 0
                          ? "No members enrolled in this plan"
                          : "No members match your filter"}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((m, i) => {
                  const key = m.memberId ?? i;
                  const s = statusStyle(getStatus(m));
                  return (
                    <tr
                      key={key}
                      className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${getName(m)}`}
                          checked={selected.includes(key)}
                          onChange={() =>
                            setSelected((p) =>
                              p.includes(key) ? p.filter((x) => x !== key) : [...p, key],
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-brand whitespace-nowrap">
                        {getName(m)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{getEmail(m)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${s.cls}`}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-800">
                        {formatNaira(getAmountPaid(m))}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatNaira(getAmountDue(m))}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(getJoinedAt(m))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: count + selection / waive actions */}
        {!isLoading && planMembers.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-xs text-gray-400">
                Showing {filtered.length} of {planMembers.length} members
              </span>
              {selected.length > 0 && (
                <>
                  <span className="text-xs font-semibold text-ink">
                    · {selected.length} selected
                  </span>
                  <Button
                    variant="tertiary"
                    size="xs"
                    fullWidth={false}
                    onClick={() => setSelected([])}
                  >
                    Clear selection
                  </Button>
                  {waivableCount === 0 && (
                    <span className="text-xs text-gray-400">(no unpaid obligations selected)</span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {statusFilter && (
                <Button
                  variant="tertiary"
                  size="xs"
                  fullWidth={false}
                  onClick={() => setStatusFilter("")}
                >
                  Clear filter
                </Button>
              )}
              {waivableCount > 0 && (
                <Button variant="primary" size="sm" fullWidth={false} onClick={openWaive}>
                  Waive ({waivableCount})
                </Button>
              )}
            </div>
          </div>
        )}

        {waiveOpen && (
          <ConfirmDialog
            title="Waive obligations"
            subtitle={`${toTitleCase(plan.name)} · ${waivableCount} unpaid ${waivableCount === 1 ? "obligation" : "obligations"}`}
            description="Waived obligations stop counting as due for these members — they will not be asked to pay them for this plan. Paid and already-waived obligations are never affected."
            confirmLabel={`Waive ${waivableCount}`}
            confirmingLabel="Waiving…"
            danger={false}
            confirming={waiving}
            error={waiveError}
            onConfirm={confirmWaive}
            onClose={() => setWaiveOpen(false)}
          >
            <div>
              <label
                htmlFor="waive-reason"
                className="block text-xs font-medium text-gray-700 mb-1"
              >
                Reason (optional)
              </label>
              <TextInput
                id="waive-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Certificate fee waived for this cohort"
                disabled={waiving}
              />
            </div>
          </ConfirmDialog>
        )}
      </div>
    </div>
  );
}

// ── Dropdown menu item ────────────────────────────────────────────────────────
