import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useQuery } from "@tanstack/react-query";
import { Download, ScrollText, RefreshCw, CheckCircle2, XCircle, X } from "lucide-react";
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
      <pre className="bg-gray-50 rounded-g-1 p-3 text-[11px] font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap break-all border border-surface-container-border">
        {text}
      </pre>
    </div>
  );
}

function humanize(value) {
  if (!value) return "";
  const s = String(value).replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// One label/value strip in the drawer — the design's rows are stacked
// label-over-value pairs separated by hairlines, not the old modal's 2-col grid.
function DrawerRow({ label, value, mono = false }) {
  return (
    <div className="px-6 py-3.5 border-b border-surface-sunken">
      <p className="m-0 text-[11px] text-gray-400 mb-1">{label}</p>
      <p className={`m-0 text-[13px] text-gray-900 break-all ${mono ? "font-mono" : ""}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

// Right-side drawer for one audit event (design: Admin – Audit logs (event
// detail)). Opens over the list instead of the old centred modal so the row
// you clicked stays visible for context.
function AuditEventDrawer({ auditLogId, onClose }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-audit-log", auditLogId],
    queryFn: () => getAdminAuditLog(auditLogId).then((r) => r.data?.data),
    staleTime: 30_000,
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const rawIds = [
    ["actor", data?.actorUserId],
    ["entity", data?.entityId],
    ["community", data?.communityId],
    ["correlation", data?.correlationId],
  ].filter(([, v]) => v);

  return (
    <div className="fixed inset-0 z-70">
      {/* Invisible click-catcher: the design leaves the list undimmed, so this
          closes the drawer on an outside click without a backdrop tint. */}
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Audit event"
        className="absolute top-0 right-0 h-full w-full max-w-[460px] bg-white shadow-2xl border-l border-surface-container-border flex flex-col"
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-surface-sunken shrink-0">
          <h2 className="m-0 text-sm font-bold text-gray-900">Audit event</h2>
          <Button variant="tertiary" size="icon-sm" onClick={onClose} aria-label="Close">
            <X size={15} />
          </Button>
        </header>

        <div className="min-h-0 overflow-y-auto flex-1">
          {isLoading ? (
            <LoadingState className="py-10" />
          ) : error ? (
            <p className="m-0 px-6 py-8 text-xs text-danger">{getErrorMessage(error)}</p>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-surface-sunken">
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-tint text-brand uppercase tracking-wide">
                  {(data.event ?? "").split("_")[0]}
                </span>
                <span className="text-sm font-bold text-gray-900">{humanize(data.event)}</span>
              </div>

              <DrawerRow label="Result" value={<ResultCell result={data.result} />} />
              <DrawerRow label="Description" value={data.description} />
              {data.comment && <DrawerRow label="Comment" value={data.comment} />}
              <DrawerRow label="Occurred at" value={fmtDateTime(data.occurredAt)} />
              <DrawerRow label="Actor" value={data.platformRoleName} />
              <DrawerRow label="Entity" value={data.entityType} />
              <DrawerRow label="IP address" value={data.ipAddress} mono />
              <DrawerRow label="User agent" value={data.userAgent} />

              {rawIds.length > 0 && (
                <div className="px-6 py-3.5 border-b border-surface-sunken">
                  <p className="m-0 text-[11px] text-gray-400 mb-1.5">Raw IDs</p>
                  <div className="flex flex-col gap-1">
                    {rawIds.map(([label, value]) => (
                      <p key={label} className="m-0 text-[11px] text-gray-700 break-all">
                        <span className="text-gray-400">{label}</span> {value}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* The list response is evidence-free by design; the change diff
                  only exists on this detail payload. */}
              <div className="px-6 py-4 flex flex-col gap-4">
                <JsonBlock label="Previous value" value={data.oldValue} />
                <JsonBlock label="New value" value={data.newValue} />
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
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

      {openId && <AuditEventDrawer auditLogId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
