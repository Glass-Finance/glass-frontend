import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Scale, ShieldCheck } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import {
  getAdminReconciliationRuns,
  triggerReconciliationRun,
  triggerFullReconciliationRun,
  getAdminReconciliationFindings,
  reviewReconciliationFinding,
  resolveReconciliationFinding,
} from "../../../api/admin";
import { fmt, fmtDate, fmtDateTime, unwrap, pageParams } from "./shared";
import { StatusBadge, SectionHeader, FilterSelect, TableShell, TableFooter } from "./SharedUI";

function ReconciliationRunsTable() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-reconciliation-runs", page],
    queryFn: () => getAdminReconciliationRuns(pageParams(page)).then(unwrap),
    staleTime: 30_000,
    placeholderData: (p) => p,
    refetchInterval: 10_000, // runs are async -- keep the list current without a manual refresh while one is in flight
  });

  const runPassOne = useMutation({
    mutationFn: () => triggerReconciliationRun(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reconciliation-runs"] }),
    meta: { successMessage: "Pass-1 reconciliation run started." },
  });
  const runFull = useMutation({
    mutationFn: () => triggerFullReconciliationRun({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reconciliation-runs"] }),
    meta: { successMessage: "Full reconciliation run started." },
  });

  const items = data?.content ?? [];
  const busy = runPassOne.isPending || runFull.isPending;

  return (
    <div className="mb-8">
      <SectionHeader
        title="Reconciliation Runs"
        desc="Internal ledger reconciliation against gateway settlements."
        count={data?.totalElements ?? 0}
        isFetching={isFetching && !isLoading}
        right={
          <>
            <Button
              variant="outline-neutral"
              size="xs"
              fullWidth={false}
              onClick={() => runPassOne.mutate()}
              disabled={busy}
            >
              <RefreshCw size={12} className={runPassOne.isPending ? "animate-spin" : ""} /> Run
              Pass 1
            </Button>
            <Button
              variant="primary"
              size="xs"
              fullWidth={false}
              onClick={() => runFull.mutate()}
              disabled={busy}
            >
              <RefreshCw size={12} className={runFull.isPending ? "animate-spin" : ""} /> Run Full
            </Button>
          </>
        }
      />

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIcon={Scale}
        emptyLabel="No reconciliation runs yet"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Run", "Status", "Window", "Residual", "Reconciles", "Findings", "Reports"].map(
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
            {items.map((r, i) => (
              <tr
                key={r.id}
                className={i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}
              >
                <td className="px-4 py-3">
                  <p className="text-[12px] font-semibold text-gray-900">
                    {(r.runType ?? "").replace(/_/g, " ")}
                  </p>
                  <p className="text-[10px] text-gray-400">{fmtDateTime(r.startedAt)}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {fmtDate(r.windowFrom)} – {fmtDate(r.windowTo)}
                </td>
                <td
                  className={`px-4 py-3 text-xs ${r.residual ? "text-red-600 font-semibold" : "text-gray-400"}`}
                >
                  {fmt(r.residual, "NGN", { minor: false, decimals: 2 })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.reconciles ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                  >
                    {r.reconciles ? "Reconciled" : "Out of balance"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">
                  {r.findingsTotal ?? 0}
                  {r.findingsNew > 0 && (
                    <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                      {r.findingsNew} new
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.csvReport?.url && (
                      <a
                        href={r.csvReport.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-brand hover:underline"
                      >
                        CSV
                      </a>
                    )}
                    {r.pdfReport?.url && (
                      <a
                        href={r.pdfReport.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-brand hover:underline"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="run"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />
    </div>
  );
}

function FindingReviewModal({ finding, mode, onClose }) {
  const queryClient = useQueryClient();
  const [annotation, setAnnotation] = useState("");

  const review = useMutation({
    mutationFn: () => reviewReconciliationFinding(finding.id, { annotation }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reconciliation-findings"] });
      onClose();
    },
    meta: { successMessage: "Finding marked reviewed." },
  });
  const resolve = useMutation({
    mutationFn: () => resolveReconciliationFinding(finding.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reconciliation-findings"] });
      onClose();
    },
    meta: { successMessage: "Finding resolved." },
  });

  const isResolve = mode === "resolve";

  return (
    <ModalShell
      className="rounded-g-1!"
      title={isResolve ? "Resolve Finding" : "Review Finding"}
      subtitle={finding.findingKey}
      onClose={onClose}
    >
      <div className="p-6">
        <div className="bg-white rounded-g-1 p-3 mb-4 border border-surface-container-border">
          <p className="text-xs font-semibold text-gray-900 mb-1">
            {(finding.findingType ?? "").replace(/_/g, " ")}
          </p>
          <p className="text-xs text-gray-500 mb-2">{finding.summary}</p>
          <div className="flex items-center gap-2">
            <StatusBadge status={finding.severity} />
            <StatusBadge status={finding.status} />
          </div>
        </div>

        {isResolve ? (
          <p className="text-xs text-gray-600 leading-relaxed mb-4">
            Marks this finding as closed and removes it from the New/Reviewed queues — it won't be
            surfaced again by future reconciliation runs. Use this once the discrepancy is actually
            accounted for (matched manually, refunded, or confirmed as expected); it doesn't touch
            the underlying ledger or settlement records.
          </p>
        ) : (
          <>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Annotation (optional)
            </label>
            <textarea
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              rows={3}
              placeholder="Notes for this review…"
              className="w-full border border-gray-300 px-3 py-2.5 rounded-g-1 text-xs outline-none focus:border-brand mb-4 transition-all resize-none"
            />
          </>
        )}

        <div className="flex gap-2">
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
            onClick={() => (isResolve ? resolve.mutate() : review.mutate())}
            loading={review.isPending || resolve.isPending}
            fullWidth={false}
            className="flex-1"
          >
            {review.isPending || resolve.isPending
              ? "Saving…"
              : isResolve
                ? "Resolve"
                : "Mark Reviewed"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function ReconciliationFindingsTable() {
  const [status, setStatus] = useState("NEW");
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null); // { finding, mode: "review" | "resolve" }

  const params = {
    ...pageParams(page),
    ...(status !== "ALL" ? { status } : {}),
  };

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-reconciliation-findings", params],
    queryFn: () => getAdminReconciliationFindings(params).then(unwrap),
    staleTime: 30_000,
    placeholderData: (p) => p,
  });

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="Findings"
        desc="Discrepancies surfaced by reconciliation runs."
        count={data?.totalElements ?? 0}
        isFetching={isFetching && !isLoading}
        right={
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "NEW", label: "New" },
              { value: "REVIEWED", label: "Reviewed" },
              { value: "RESOLVED", label: "Resolved" },
            ]}
          />
        }
      />

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIcon={ShieldCheck}
        emptyLabel="No findings — everything reconciles"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Finding", "Severity", "Amount", "Variance", "Status", "Occurred", ""].map((h) => (
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
            {items.map((f, i) => (
              <tr
                key={f.id}
                className={`group ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3">
                  <p className="text-[12px] font-semibold text-gray-900">
                    {(f.findingType ?? "").replace(/_/g, " ")}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate max-w-xs">{f.summary}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={f.severity} />
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">{fmt(f.amount, f.currency)}</td>
                <td
                  className={`px-4 py-3 text-xs ${f.variance ? "text-red-600 font-semibold" : "text-gray-400"}`}
                >
                  {fmt(f.variance, f.currency)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={f.status} />
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {fmtDateTime(f.occurredAt)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {f.status !== "RESOLVED" && (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 justify-end transition-opacity">
                      <Button
                        variant="outline-neutral"
                        size="xs"
                        fullWidth={false}
                        onClick={() => setModal({ finding: f, mode: "review" })}
                      >
                        Review
                      </Button>
                      <Button
                        variant="success"
                        size="xs"
                        fullWidth={false}
                        onClick={() => setModal({ finding: f, mode: "resolve" })}
                      >
                        Resolve
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="finding"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />

      {modal && (
        <FindingReviewModal
          finding={modal.finding}
          mode={modal.mode}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default function ReconciliationSection() {
  return (
    <div>
      <ReconciliationRunsTable />
      <ReconciliationFindingsTable />
    </div>
  );
}
