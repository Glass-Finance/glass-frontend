import { Plus, Upload } from "lucide-react";
import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useRecordBookAccess } from "../../hooks/useRecordBookAccess";
import { useCommunityRecords, useRecordMutation } from "../../hooks/useCommunityRecords";
import { useDebounce } from "../../hooks/useDebounce";
import { Button } from "../../components/ui/Button";
import ConfirmDialog from "../../components/dashboard/ConfirmDialog";
import RecordsHeader from "./records/RecordsHeader";
import RecordFilters from "./records/RecordFilters";
import RecordsTable from "./records/RecordsTable";
import RecordDeleteSummary from "./records/RecordDeleteSummary";
import RecordDetailPanel from "./records/RecordDetailPanel";
import RecordFormModal from "./records/RecordFormModal";
import { ErrorNotice, QueryState, Pager } from "./records/RecordBookUI";

export default function Records() {
  usePageTitle("Records");
  const access = useRecordBookAccess();
  return (
    <div className="px-4 md:px-6 py-6 h-full overflow-y-auto">
      {(access.loading || access.error || !access.read) && (
        <RecordsHeader identifier={access.identifier} />
      )}
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
  const [search, setSearch] = useState("");
  const debounceSearch = useDebounce((value) => {
    setSearch(value);
    setPage(1);
  }, 300);
  const params = Object.fromEntries(
    Object.entries({
      ...filters,
      search,
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
    <div>
      <RecordsHeader identifier={access.identifier}>
        {access.create && (
          <Button size="sm-tight" fullWidth={false} onClick={() => setEditing("new")}>
            <Plus size={13} />
            Add record
          </Button>
        )}
        {access.import && (
          <Button
            variant={access.create ? "outline" : "primary"}
            size="sm-tight"
            fullWidth={false}
            onClick={() =>
              navigate(
                `/dashboard/records/imports?community=${encodeURIComponent(access.identifier)}&upload=1`,
              )
            }
          >
            <Upload size={13} />
            Import spreadsheet
          </Button>
        )}
      </RecordsHeader>
      {searchParams.get("importJobId") && (
        <p className="text-sm text-ink-muted">Showing records saved from this import.</p>
      )}
      <section className="space-y-4">
        <RecordFilters
          communityId={access.id}
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            debounceSearch(next.search ?? "");
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
          presentation="record"
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
          onConfirm={() => {
            if (!remove.isPending)
              remove.mutate({ recordId: deleting.id }, { onSuccess: () => setDeleting(null) });
          }}
        >
          <RecordDeleteSummary row={deleting} />
        </ConfirmDialog>
      )}
    </div>
  );
}
