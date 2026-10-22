import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useQuery } from "@tanstack/react-query";
import { Download, ScrollText, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import LoadingState from "../../../components/common/LoadingState";
import { getErrorMessage } from "../../../utils/errorHandler";
import { useExportJob } from "../../../hooks/useExportJob";
import { getAdminAuditLog, getAdminAuditLogs, exportAdminAuditLogs } from "../../../api/admin";
import { fmtDateTime, unwrap, pageParams } from "./shared";
import { useDebounce } from "../../../hooks/useDebounce";
import { SectionHeader, SearchBar, FilterSelect, TableShell, TableFooter } from "./SharedUI";

// AuditEventResult is a two-value enum on the backend.
const RESULT_OPTIONS = [
  { value: "ALL", label: "All results" },
  { value: "SUCCESS", label: "Success" },
  { value: "FAILED", label: "Failed" },
];

// AuditEvent is a ~95-value enum (every login, payment, KYC, settlement,
// export and reconciliation transition the backend records). A dropdown of
// all of them would be unusable, so there is deliberately no `event` filter
// here — `search` covers it, along with entityType/result and the date range
// the backend also accepts. A fixed short list would have hidden most events
// behind a filter that looks complete.
function ResultCell({ result }) {
  if (result === "SUCCESS") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700">
        <CheckCircle2 size={12} /> Success
      </span>
    );
  }
  if (result === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
        <XCircle size={12} /> Failed
      </span>
    );
  }
  return <span className="text-[11px] text-gray-400">—</span>;
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-xs text-gray-900 break-all ${mono ? "font-mono" : ""}`}>{value ?? "—"}</p>
    </div>
  );
}

// oldValue/newValue arrive as free-form JSON captured at write time. They are
// rendered as pretty-printed text via JSON.stringify, never injected as HTML —
// they carry whatever the audited entity happened to contain, including
// user-supplied strings, so innerHTML here would be a stored-XSS sink.
function JsonBlock({ label, value }) {
  if (value == null) return null;
  let text;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <div>
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      <pre className="bg-gray-50 rounded-lg p-3 text-[11px] font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap break-all border border-surface-container-border">
        {text}
      </pre>
    </div>
  );
}

function AuditLogDetailModal({ auditLogId, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit-log", auditLogId],
    queryFn: () => getAdminAuditLog(auditLogId).then((r) => r.data?.data),
    staleTime: 30_000,
  });

  return (
    <ModalShell size="wide" title="Audit log" subtitle={data?.event} onClose={onClose}>
      <div className="p-6 max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <LoadingState className="py-10" />
        ) : error ? (
          <p className="text-xs text-danger">{getErrorMessage(error)}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 mb-5">
              <p className="text-sm font-bold text-gray-900">{data.description ?? data.event}</p>
              <ResultCell result={data.result} />
            </div>

            {data.comment && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-surface-container-border">
                <p className="text-[10px] text-gray-400 mb-0.5">Comment</p>
                <p className="text-xs text-gray-700">{data.comment}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5">
              <DetailRow label="Event" value={data.event} />
              <DetailRow label="Occurred at" value={fmtDateTime(data.occurredAt)} />
              <DetailRow label="Actor" value={data.actorUserId} mono />
              <DetailRow label="Actor role" value={data.platformRoleName} />
              <DetailRow label="Entity type" value={data.entityType} />
              <DetailRow label="Entity id" value={data.entityId} mono />
              <DetailRow label="Community id" value={data.communityId} mono />
              <DetailRow label="Correlation id" value={data.correlationId} mono />
              <DetailRow label="IP address" value={data.ipAddress} mono />
              <DetailRow label="User agent" value={data.userAgent} />
            </div>

            {/* The list response is evidence-free by design; the change diff
                only exists on this detail payload. */}
            <div className="flex flex-col gap-4">
              <JsonBlock label="Previous value" value={data.oldValue} />
              <JsonBlock label="New value" value={data.newValue} />
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

export default function AuditLogsSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [result, setResult] = useState("ALL");
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
    ...(result !== "ALL" ? { result } : {}),
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-audit-logs", params],
    queryFn: () => getAdminAuditLogs(params).then(unwrap),
    staleTime: 30_000,
    placeholderData: (p) => p,
  });

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="Audit Logs"
        desc="Platform-wide record of privileged actions and system events."
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
              placeholder="Search audit logs…"
              width={220}
            />
            <FilterSelect
              value={result}
              onChange={(v) => {
                setResult(v);
                setPage(0);
              }}
              options={RESULT_OPTIONS}
            />
            <Button
              variant="outline-neutral"
              size="xs"
              fullWidth={false}
              onClick={() => csvExport.run(() => exportAdminAuditLogs(params))}
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
        emptyIcon={ScrollText}
        emptyLabel="No audit logs found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Event", "Description", "Entity", "Result", "Occurred"].map((h) => (
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
            {items.map((a, i) => (
              <tr
                key={a.id}
                onClick={() => setOpenId(a.id)}
                className={`hover:bg-gray-50 transition-colors cursor-pointer ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3">
                  <p className="text-[12px] font-mono text-gray-700">{a.event}</p>
                  {a.platformRoleName && (
                    <p className="text-[10px] text-gray-400">{a.platformRoleName}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700 max-w-[280px] truncate">
                  {a.description ?? "—"}
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500 font-mono">
                  {a.entityType ? `${a.entityType}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <ResultCell result={a.result} />
                </td>
                <td className="px-4 py-3 text-[11px] text-gray-500 whitespace-nowrap">
                  {fmtDateTime(a.occurredAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="audit log"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />

      {openId && <AuditLogDetailModal auditLogId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
