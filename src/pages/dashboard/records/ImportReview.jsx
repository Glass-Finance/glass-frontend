import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import ConfirmDialog from "../../../components/dashboard/ConfirmDialog";
import { useRecordImportRows, useImportRowMutation } from "../../../hooks/useRecordImportRows";
import { useDebounce } from "../../../hooks/useDebounce";
import {
  REVIEW_LABELS,
  ISSUE_LABELS,
  recordCounts,
  toggleRowSelection,
  errorDescription,
} from "../../../utils/recordBook";
import RecordsTable from "./RecordsTable";
import RecordFilters from "./RecordFilters";
import RecordFormModal from "./RecordFormModal";
import RecordDeleteSummary from "./RecordDeleteSummary";
import ImportRowPanel from "./ImportRowPanel";
import ImportBulkActions from "./ImportBulkActions";
import { Pager, QueryState, Select } from "./RecordBookUI";
export default function ImportReview({ communityId, job, defaultCurrency, frozen = false }) {
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [opened, setOpened] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDraftOpen, setBulkDraftOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounceSearch = useDebounce((value) => {
    setSearch(value);
    setPage(1);
  }, 300);
  const params = Object.fromEntries(
    Object.entries({ ...filters, search, pageNumber: page, pageSize: 20 }).filter(
      ([, value]) => value !== "" && value != null,
    ),
  );
  const query = useRecordImportRows(communityId, job.id, params, !frozen);
  const create = useImportRowMutation(communityId, job.id, "create");
  const update = useImportRowMutation(communityId, job.id, "update");
  const remove = useImportRowMutation(communityId, job.id, "delete");
  const bulk = useImportRowMutation(communityId, job.id, "bulk");
  const rows = query.data?.content ?? [];
  const counts = recordCounts(job);
  const row = rows.find((r) => r.id === opened?.id) ?? opened;
  function selectPage() {
    if (rows.every((r) => selected.includes(r.id)))
      setSelected((old) => old.filter((id) => !rows.some((r) => r.id === id)));
    else setSelected((old) => [...new Set([...old, ...rows.map((r) => r.id)])].slice(0, 500));
  }
  const changeFilters = (next) => {
    setFilters(next);
    debounceSearch(next.search ?? "");
    setPage(1);
  };
  const editedRowMissing =
    editing &&
    editing !== "new" &&
    !!query.data &&
    !query.isFetching &&
    !rows.some((r) => r.id === editing.id);
  const openedRowMissing =
    opened && !!query.data && !query.isFetching && !rows.some((r) => r.id === opened.id);
  if (frozen && !editing && !opened && !bulkDraftOpen) return null;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Review your records</h2>
          <p className="text-xs text-ink-ghost mt-0.5">
            {counts.ready} ready · {counts.invalid + counts.review} need attention ·{" "}
            {counts.skipped} skipped
          </p>
        </div>
        <Button
          size="sm-tight"
          fullWidth={false}
          variant="outline"
          disabled={frozen}
          onClick={() => setEditing("new")}
        >
          Add missing record
        </Button>
      </div>
      <div className="space-y-4">
        <RecordFilters
          communityId={communityId}
          review
          filters={filters}
          onChange={changeFilters}
          leading={
            <div className="w-48">
              <Select
                compact
                hideLabel
                label="Review status"
                empty="All review states"
                value={filters.reviewStatus}
                options={REVIEW_LABELS}
                onChange={(reviewStatus) => changeFilters({ ...filters, reviewStatus })}
              />
            </div>
          }
        >
          <Select
            compact
            label="Issue"
            value={filters.issueCode}
            options={Object.fromEntries(
              Object.entries(ISSUE_LABELS).map(([code, text]) => [code, text]),
            )}
            onChange={(issueCode) => changeFilters({ ...filters, issueCode })}
          />
          <Select
            compact
            label="Sheet"
            value={filters.sheetName}
            options={Object.fromEntries(
              (job.mapping?.sheets ?? []).map((sheet) => [sheet.sheetName, sheet.sheetName]),
            )}
            onChange={(sheetName) => changeFilters({ ...filters, sheetName })}
          />
        </RecordFilters>
        <ImportBulkActions
          communityId={communityId}
          selected={selected}
          onDraftChange={setBulkDraftOpen}
          frozen={frozen || bulk.isPending}
          onClear={() => setSelected([])}
          onApply={(patch) => bulk.mutateAsync({ payload: { rowIds: selected, patch } })}
        />
        <QueryState query={query} empty={rows.length === 0}>
          <RecordsTable
            review
            rows={rows}
            selected={selected}
            frozen={frozen}
            onSelect={(id) => setSelected((old) => toggleRowSelection(old, id))}
            onSelectPage={selectPage}
            onOpen={setOpened}
          />
        </QueryState>
        <Pager data={query.data} page={page} onChange={setPage} disabled={query.isFetching} />
      </div>
      {opened && !editing && !deleting && (
        <ImportRowPanel
          row={row}
          communityId={communityId}
          frozen={frozen || !!query.error || !!openedRowMissing}
          busy={update.isPending}
          error={update.error}
          onClose={() => {
            setOpened(null);
            update.reset?.();
          }}
          onEdit={() => setEditing(row)}
          onDelete={() => {
            remove.reset?.();
            setDeleting(true);
          }}
          onPatch={(payload) =>
            update
              .mutateAsync({ rowId: row.id, payload })
              .then((saved) => {
                setOpened(saved);
              })
              .catch(() => {})
          }
        />
      )}
      {editing && (
        <RecordFormModal
          key={editing.id ?? "new"}
          communityId={communityId}
          record={
            editing === "new" ? undefined : (rows.find((r) => r.id === editing.id) ?? editing)
          }
          defaultCurrency={defaultCurrency}
          draft
          readOnly={frozen || !!query.error || !!editedRowMissing}
          readOnlyMessage={
            editedRowMissing
              ? "This record is no longer in the refreshed view. Your corrections are preserved. Close the editor, refresh, and find the record in All statuses before reconciling changes."
              : undefined
          }
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            if (editing === "new") await create.mutateAsync({ payload });
            else {
              const saved = await update.mutateAsync({ rowId: editing.id, payload });
              setOpened(saved);
            }
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          presentation="record"
          title="Delete manual addition?"
          description="This removes this pending manual row. Generated spreadsheet rows can only be skipped."
          confirmLabel="Delete manual addition"
          confirming={remove.isPending}
          confirmDisabled={frozen || !!openedRowMissing || !!query.error}
          error={remove.error ? errorDescription(remove.error) : ""}
          onClose={() => {
            if (!remove.isPending) {
              setDeleting(false);
              remove.reset?.();
            }
          }}
          onConfirm={() => {
            if (
              !remove.isPending &&
              row.source === "MANUAL" &&
              !frozen &&
              !openedRowMissing &&
              !query.error
            )
              remove
                .mutateAsync({ rowId: row.id })
                .then(() => {
                  setDeleting(false);
                  setOpened(null);
                  setSelected((old) => old.filter((id) => id !== row.id));
                })
                .catch(() => {});
          }}
        >
          <RecordDeleteSummary row={row} />
        </ConfirmDialog>
      )}
    </section>
  );
}
