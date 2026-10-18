import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRecordBookAccess } from "../../hooks/useRecordBookAccess";
import { useCommunityRecords, useRecordMutation } from "../../hooks/useCommunityRecords";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import ConfirmDialog from "../../components/dashboard/ConfirmDialog";
import RecordsTabs from "./records/RecordsTabs";
import RecordFilters from "./records/RecordFilters";
import RecordsTable from "./records/RecordsTable";
import RecordDetailPanel from "./records/RecordDetailPanel";
import RecordFormModal from "./records/RecordFormModal";
import { ErrorNotice, QueryState, Pager } from "./records/RecordBookUI";

export default function Records() {
  usePageTitle("Records");
  const access = useRecordBookAccess();
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-xl font-semibold">Records</h1>
      <p className="text-sm text-ink-muted">
        Your community's historical payments, expenses, and other activity.
      </p>
      <RecordsTabs identifier={access.identifier} />
      {access.loading ? (
        <p role="status">Loading access…</p>
      ) : access.error ? (
        <ErrorNotice error={access.error} />
      ) : !access.read ? (
        <ErrorNotice message="You don't have permission to view this community's records." />
      ) : (
        <RecordsContent key={access.id} access={access} />
      )}
    </div>
  );
}
function RecordsContent({ access }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const debounced = useDebounce(filters.search ?? "", 300);
  const params = Object.fromEntries(
    Object.entries({
      ...filters,
      search: debounced,
      importJobId: searchParams.get("importJobId"),
      pageNumber: page,
      pageSize: 20,
    }).filter(([, value]) => value !== "" && value != null),
  );
  const query = useCommunityRecords(access.id, params);
  const create = useRecordMutation(access.id, "create");
  const update = useRecordMutation(access.id, "update");
  const remove = useRecordMutation(access.id, "delete");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        {access.create && (
          <Button size="md" fullWidth={false} onClick={() => setEditing("new")}>
            Add record
          </Button>
        )}
        {access.import && (
          <Button
            variant="outline"
            size="md"
            fullWidth={false}
            onClick={() =>
              navigate(
                `/dashboard/records/imports?community=${encodeURIComponent(access.identifier)}&upload=1`,
              )
            }
          >
            Import spreadsheet
          </Button>
        )}
      </div>
      {searchParams.get("importJobId") && (
        <p className="text-sm text-ink-muted">Showing records saved from this import.</p>
      )}
      <section className="rounded-g-2 md:rounded-g-3 border border-black/10 bg-white p-3 md:p-5 space-y-5">
        <RecordFilters
          communityId={access.id}
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
        {filters.occurredOnFrom &&
          filters.occurredOnTo &&
          filters.occurredOnFrom > filters.occurredOnTo && (
            <ErrorNotice message="From date must be on or before To date." />
          )}
        <QueryState query={query} empty={query.data?.content?.length === 0}>
          <RecordsTable rows={query.data?.content ?? []} onOpen={(row) => setDetail(row.id)} />
        </QueryState>
        <Pager data={query.data} page={page} onChange={setPage} disabled={query.isFetching} />
      </section>
      {detail && (
        <RecordDetailPanel
          communityId={access.id}
          identifier={access.identifier}
          recordId={detail}
          canEdit={access.update}
          canDelete={access.delete}
          onEdit={(row) => {
            setDetail(null);
            setEditing(row);
          }}
          onDelete={(row) => {
            setDetail(null);
            setDeleting(row);
          }}
          onClose={() => setDetail(null)}
        />
      )}
      {editing && (
        <RecordFormModal
          communityId={access.id}
          defaultCurrency={access.community.defaultCurrency}
          record={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(payload) =>
            editing === "new"
              ? create.mutateAsync({ payload })
              : update.mutateAsync({ recordId: editing.id, payload })
          }
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete record?"
          description="This removes the historical record. It does not reverse a payment or change any balance."
          confirmLabel="Delete record"
          confirming={remove.isPending}
          error={remove.error ? "The record could not be deleted. Refresh and try again." : ""}
          onClose={() => {
            if (!remove.isPending) {
              setDeleting(null);
              remove.reset();
            }
          }}
          onConfirm={() =>
            remove.mutate({ recordId: deleting.id }, { onSuccess: () => setDeleting(null) })
          }
        />
      )}
    </div>
  );
}
