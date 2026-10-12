import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "../../hooks/usePageTitle";
import { Users, Plus, Pencil, Archive, ArchiveRestore, Trash2, UserPlus } from "lucide-react";
import { useActiveCommunityId } from "../../hooks/useActiveCommunityId";
import { useCommunityGroups, useGroupMutations, isArchivedGroup } from "../../hooks/useGroups";
import { getErrorMessage } from "../../utils/errorHandler";
import { useKycGate } from "../../hooks/useKycGate";
import { isKycGatedCommunityRequestError } from "../../utils/kycStatus";
import LoadingState from "../../components/common/LoadingState";
import EmptyState from "../../components/common/EmptyState";
import { Button } from "../../components/ui/Button";
import ConfirmDialog from "../../components/dashboard/ConfirmDialog";
import CommunityStaffKycNotice from "../../components/dashboard/CommunityStaffKycNotice";
import KycWizardModal from "../../components/kyc/KycWizardModal";
import GroupFormModal from "./groups/GroupFormModal";
import GroupMembersModal from "./groups/GroupMembersModal";

const PAGE_SIZE = 20;

export default function Groups() {
  usePageTitle("Groups");
  const communityId = useActiveCommunityId();

  const [search, setSearch] = useState("");
  // 1-based, because the backend is: createPageable() does
  // PageRequest.of(pageNumber - 1, ...), so 0 becomes PageRequest.of(-1, ...)
  // and the request is rejected with 400 "Illegal Argument Entered". The
  // backend's own default is AppConstant.PAGE_NUMBER = 1. useKyc.js already
  // follows the same 1-based convention.
  const [pageNumber, setPageNumber] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null); // null | { group } | "new"
  const [managing, setManaging] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  // `status` is sent only when the toggle is OFF, and asks the backend for
  // ACTIVE groups. The toggle's existing meaning -- "hide archived unless I ask"
  // -- is preserved: on, no status filter is sent and the list shows everything.
  // Filtering server-side (rather than hiding rows in this component) also keeps
  // totalElements/totalPages honest, which client-side filtering got wrong once
  // the list was more than one page long.
  const params = useMemo(
    () => ({
      search: search.trim() || undefined,
      pageNumber,
      pageSize: PAGE_SIZE,
      status: showArchived ? undefined : "ACTIVE",
    }),
    [search, pageNumber, showArchived],
  );

  const { data, isLoading, isError, error, refetch } = useCommunityGroups(communityId, params);
  const { remove, archive, unarchive, create, update } = useGroupMutations(communityId);
  const queryClient = useQueryClient();

  // The KYC notice's "Start/Continue verification" action opens the same
  // KycWizardModal the other community surfaces use (CommunitiesHome,
  // MyCommunities) -- one verification flow, not a second one. The modal owns
  // the whole lifecycle: its own useKycFlow handles the steps, the bounded
  // status polling and the errors. All this page owes it is a way in, a way
  // out, and a resume.
  const [kycWizardOpen, setKycWizardOpen] = useState(false);
  // Dismissal never resumes: closing just puts the notice back.
  const closeKycWizard = () => {
    setKycWizardOpen(false);
    kycGate.closeGate();
  };
  // onComplete fires only on an APPROVED outcome (useKycFlow), so this is the
  // one path where the account's permissions have actually changed.
  //
  // The community queries MUST be invalidated here. The KYC flow only
  // invalidates its own ["kyc", ...] keys, so without this the list would keep
  // serving the pre-approval 403 (staleTime is 30s for groups, 2min for
  // members) and the page would drop out of the KYC branch into the generic
  // "Couldn't load groups." error -- verifying would appear to break the page.
  // Invalidating the ["community", communityId] prefix is the established
  // scope here (useCommunity.js, useInitiatePayment.js do the same), and covers
  // groups, members and the other community sub-queries in one call.
  const completeKycWizard = () => {
    setKycWizardOpen(false);
    kycGate.completeGate();
    queryClient.invalidateQueries({ queryKey: ["community", communityId] });
  };

  // A community staff member whose KYC isn't approved is downgraded to
  // COMMUNITY_MEMBER permissions server-side, so this list 403s even though
  // their role is correct. That deserves an explanation, not a bare error --
  // but only when we actually know the KYC status, so a 403 from any other
  // cause (or during a summary outage) still falls through to the generic
  // message below. Not enforced on load: this states the situation rather than
  // blocking the page.
  const kycGate = useKycGate();
  const kycGated = isKycGatedCommunityRequestError(error, kycGate.status, {
    isLoading: kycGate.isLoading,
    isError: kycGate.isError,
    exempt: kycGate.exempt,
  });

  // The backend has already applied the status filter, so this is not filtered
  // again here. isArchivedGroup still drives the per-row Archived badge and the
  // archive/restore button.
  const rows = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;

  async function run(action, group) {
    try {
      await action.mutateAsync(group.id);
    } catch {
      // Archived/restored is a one-click row action with nothing to keep open
      // on failure, and the global handler already toasts the reason.
    }
  }

  if (!communityId) {
    return (
      <div className="px-4 md:px-8 py-6">
        <h1 className="text-xl font-bold text-black mb-1">Groups</h1>
        <p className="text-sm text-gray-400">
          Pick a community first — groups belong to a single community.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 md:px-8 py-6 overflow-y-auto min-h-0">
      <div className="mb-5 flex-shrink-0 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-black mb-1">Groups</h1>
          <p className="text-sm text-gray-400">
            Split your members into named groups, then bill a whole group at once.
          </p>
        </div>
        <Button
          onClick={() => setEditing("new")}
          fullWidth={false}
          size="sm"
          className="px-3.5 inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> New group
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-shrink-0">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPageNumber(0);
          }}
          placeholder="Search groups"
          aria-label="Search groups"
          className="flex-1 max-w-xs text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {kycGated ? (
        <CommunityStaffKycNotice
          status={kycGate.status}
          subject="your groups"
          onVerify={() => setKycWizardOpen(true)}
          className="mb-4"
        />
      ) : isError ? (
        <p className="text-sm text-danger mb-4">
          {getErrorMessage(error, "Couldn't load groups.")}{" "}
          <Button variant="tertiary" size="xs" fullWidth={false} onClick={() => refetch()}>
            Retry
          </Button>
        </p>
      ) : isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        // Full-page state built from the compact `icon` layout, so it has to
        // ask for the page-level action size explicitly -- see EmptyState.
        <EmptyState
          icon={Users}
          title={search ? "No groups match that search" : "No groups yet"}
          description={
            search
              ? "Try a different name."
              : "Groups let you bill a subset of your members — a choir, a floor, a staff team — without picking names one at a time."
          }
          action={!search ? () => setEditing("new") : undefined}
          actionLabel={!search ? "Create your first group" : undefined}
          actionSize="lg-tight"
        />
      ) : (
        <ul className="flex flex-col gap-2 mb-4">
          {rows.map((group) => {
            const archived = isArchivedGroup(group);
            return (
              <li
                key={group.id}
                className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3 bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 truncate">{group.name}</span>
                    {archived ? (
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                        Archived
                      </span>
                    ) : null}
                  </div>
                  {group.description ? (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{group.description}</p>
                  ) : null}
                </div>

                {!archived ? (
                  <Button
                    variant="tertiary"
                    size="xs"
                    fullWidth={false}
                    onClick={() => setManaging(group)}
                    title="Manage members"
                  >
                    <UserPlus size={13} /> Members
                  </Button>
                ) : null}
                <Button
                  variant="tertiary"
                  size="icon-sm"
                  onClick={() => setEditing({ group })}
                  aria-label={`Edit ${group.name}`}
                  className=""
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="tertiary"
                  size="sm"
                  fullWidth={false}
                  onClick={() => run(archived ? unarchive : archive, group)}
                  title={archived ? "Restore group" : "Archive group"}
                  aria-label={`${archived ? "Restore" : "Archive"} ${group.name}`}
                >
                  {archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </Button>
                <Button
                  variant="tertiary"
                  size="icon-sm"
                  onClick={() => {
                    setDeleteError("");
                    setConfirmDelete(group);
                  }}
                  title="Delete group"
                  aria-label={`Delete ${group.name}`}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-xs text-gray-500 mb-2">
          <Button
            variant="tertiary"
            size="xs"
            fullWidth={false}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            Previous
          </Button>
          <span>
            Page {pageNumber} of {totalPages} · {totalElements} total
          </span>
          <Button
            variant="tertiary"
            size="xs"
            fullWidth={false}
            onClick={() => setPageNumber((p) => p + 1)}
            disabled={pageNumber >= totalPages}
          >
            Next
          </Button>
        </div>
      ) : null}

      {editing ? (
        <GroupFormModal
          key={editing === "new" ? "new" : editing.group.id}
          group={editing === "new" ? null : editing.group}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            try {
              if (editing === "new") await create.mutateAsync(payload);
              else await update.mutateAsync({ groupId: editing.group.id, ...payload });
              setEditing(null);
            } catch {
              // Global handler toasts; leave the modal open with the values intact.
            }
          }}
          saving={create.isPending || update.isPending}
        />
      ) : null}

      {managing ? (
        <GroupMembersModal
          communityId={communityId}
          group={managing}
          onClose={() => setManaging(null)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={`Delete "${confirmDelete.name}"?`}
          subtitle="This cannot be undone."
          description="Only an empty group can be deleted. If this group still has members in it, delete will be rejected — archive it instead, which keeps the members and can be undone."
          confirmLabel="Delete group"
          confirmingLabel="Deleting…"
          confirming={remove.isPending}
          error={deleteError}
          onClose={() => setConfirmDelete(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(confirmDelete.id);
              setConfirmDelete(null);
            } catch (err) {
              setDeleteError(getErrorMessage(err, "Couldn't delete this group. Please try again."));
            }
          }}
        />
      ) : null}

      {/* `kycGate.gateOpen` is OR'd in so a gate opened by enforce() elsewhere
          still drives this modal — the same shape CommunitiesHome uses. */}
      <KycWizardModal
        open={kycWizardOpen || kycGate.gateOpen}
        onClose={closeKycWizard}
        onComplete={completeKycWizard}
        historyPath="/dashboard/verify-identity/history"
      />
    </div>
  );
}
