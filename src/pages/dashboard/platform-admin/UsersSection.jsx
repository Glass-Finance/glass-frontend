import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, ShieldCheck, EyeOff, MoreVertical, Users } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { toTitleCase } from "../../../utils/format";
import { kycStatusLabel } from "../../../utils/kycStatus";
import { getInitials } from "../../../utils/getInitials";
import { suspendUser, unsuspendUser, markUserForDeletion, anonymizeUser } from "../../../api/admin";
import { pageParams, fmtDateTime, initialSearchFromUrl } from "./shared";
import { useAdminUsers, canManageUserKyc, userKycAction } from "../../../hooks/useAdminKyc";
import { AdminUserKycDialog } from "../../../components/dashboard/AdminUserKycActions";
import { useAuth } from "../../../store/AuthContext";
import { useDebounce } from "../../../hooks/useDebounce";
import { SearchBar, TableShell, TableFooter } from "./SharedUI";
import UserDetailModal from "./UserDetailModal";

// Status filter tabs (design: Users (interactive)). "Unverified" maps to the
// AdminUserQueryDto.emailVerified flag; the rest map to `enabled`. There is
// deliberately no KYC filter here — that was a design-only column param the
// panel never wired, and the KYC section already covers the queue.
const FILTERS = [
  { value: "ALL", label: "All users" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "UNVERIFIED", label: "Unverified" },
];

// Backend requires a non-blank reason on mark-deletion, but the design's
// confirm step is type-the-identifier rather than a reason box — so the audit
// trail records what the operator actually did here instead of inventing a
// reason on their behalf.
const DELETE_REASON = "Confirmed by typing the account identifier before deletion";

function displayName(u) {
  return [u.userData?.firstName, u.userData?.lastName]
    .filter(Boolean)
    .map((s) => toTitleCase(s.trim()))
    .join(" ");
}

function SuspendModal({ user, onClose }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (payload) => suspendUser(user.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onClose();
    },
    meta: { successMessage: "User suspended" },
  });

  return (
    <ModalShell title="Suspend User" subtitle={user.email} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ reason });
        }}
        className="px-6 py-5 flex flex-col gap-4"
      >
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            className="w-full px-3 py-2.5 rounded-lg text-xs text-gray-800 outline-none resize-none transition-colors border border-[#D0D0D0] focus:border-brand"
            placeholder="Why is this user being suspended?"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            fullWidth={false}
            variant="outline-neutral"
            size="sm"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!reason.trim()}
            loading={mutation.isPending}
            fullWidth={false}
            variant="critical"
            size="sm"
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {mutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ShieldAlert size={12} />
            )}
            {mutation.isPending ? "Suspending…" : "Suspend"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function UnsuspendModal({ user, onClose, onConfirm, unsuspending }) {
  return (
    <ModalShell title="Unsuspend User" subtitle={user.email} onClose={onClose}>
      <div className="px-6 py-5 flex flex-col gap-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          This restores <strong>{user.email}</strong>'s access to the Platform. They'll be able to
          sign in and use their Account again.
        </p>
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={onClose}
            disabled={unsuspending}
            fullWidth={false}
            variant="outline-neutral"
            size="sm"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            loading={unsuspending}
            fullWidth={false}
            variant="success"
            size="sm"
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {unsuspending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ShieldCheck size={12} />
            )}
            {unsuspending ? "Unsuspending…" : "Unsuspend"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

// IRREVERSIBLE confirm (design: Admin – Users (confirm)): type the account
// identifier to arm the button. Falls back to the user id when there is no
// email on file, so the flow still works for the anonymised-looking rows.
function DeleteConfirmModal({ user, onClose, onConfirm, deleting }) {
  const [typed, setTyped] = useState("");
  const name = displayName(user) || "this user";
  const target = user.email ?? user.id;
  const matches = typed.trim() === target;

  return (
    <ModalShell title={`Delete ${name}?`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (matches && !deleting) onConfirm();
        }}
        className="px-6 py-5 flex flex-col gap-4"
      >
        <p className="text-xs text-gray-600 leading-relaxed">
          This permanently deletes the user and cannot be undone. To confirm, type{" "}
          <strong className="break-all">{target}</strong> below.
        </p>
        <div>
          <label
            htmlFor="delete-confirm-identifier"
            className="block text-xs font-semibold text-gray-700 mb-1.5"
          >
            Confirmation
          </label>
          <input
            id="delete-confirm-identifier"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="w-full px-3 py-2.5 rounded-lg text-xs text-gray-800 outline-none transition-colors border border-[#D0D0D0] focus:border-brand"
            placeholder={user.email ? "Type the email to confirm" : "Type the ID to confirm"}
          />
        </div>
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={onClose}
            disabled={deleting}
            fullWidth={false}
            variant="outline-neutral"
            size="sm"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!matches}
            loading={deleting}
            fullWidth={false}
            variant="critical"
            size="sm"
            className="flex-1"
          >
            Delete user
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function AnonymizeModal({ user, onClose, onConfirm, anonymizing }) {
  const [reason, setReason] = useState("");

  return (
    <ModalShell title="Anonymize User" subtitle={user.email} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason);
        }}
        className="px-6 py-5 flex flex-col gap-4"
      >
        <p className="text-xs text-gray-600 leading-relaxed">
          Immediately scrubs <strong>{user.email}</strong>'s personal data, bypassing the grace
          period. <strong>This cannot be undone.</strong> Only works on an account already marked
          for deletion -- if it isn't, this will be rejected.
        </p>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            className="w-full px-3 py-2.5 rounded-lg text-xs text-gray-800 outline-none resize-none transition-colors border border-[#D0D0D0] focus:border-brand"
            placeholder="Why is this account being anonymized now?"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={onClose}
            disabled={anonymizing}
            fullWidth={false}
            variant="outline-neutral"
            size="sm"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!reason.trim()}
            loading={anonymizing}
            fullWidth={false}
            variant="critical"
            size="sm"
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {anonymizing ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />}
            {anonymizing ? "Anonymizing…" : "Anonymize Now"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function MenuButton({ danger = false, children, onClick }) {
  return (
    <Button
      variant="tertiary"
      size="sm"
      fullWidth={false}
      onClick={onClick}
      className={`w-full justify-start! px-3! py-2! h-auto! text-[13px]! font-medium! rounded-none! ${
        danger ? "text-danger! hover:bg-red-50!" : "text-ink! hover:bg-surface-sunken!"
      }`}
    >
      {children}
    </Button>
  );
}

// Row overflow menu (design: Admin – Users (menu)). Suspend only exists for
// enabled rows — suspended rows get the inline Unsuspend button instead — and
// the two destructive actions sit under the IRREVERSIBLE divider in red.
function RowMenu({ user, kycAction, onKycAction, onSuspend, onDelete, onAnonymize }) {
  return (
    <div
      role="menu"
      aria-label={`Actions for ${displayName(user) || user.email || user.id}`}
      className="absolute right-0 top-full mt-1 z-60 w-52 bg-white rounded-g-2 border border-surface-container-border shadow-xl py-1.5"
    >
      {kycAction && (
        <MenuButton onClick={() => onKycAction(kycAction)}>
          {kycAction === "APPROVE" ? "Approve manually" : "Revoke KYC"}
        </MenuButton>
      )}
      {user.enabled && <MenuButton onClick={onSuspend}>Suspend</MenuButton>}
      <div className="my-1.5 border-t border-surface-sunken" />
      <p className="m-0 px-3 pt-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Irreversible
      </p>
      <MenuButton danger onClick={onDelete}>
        Delete user…
      </MenuButton>
      <MenuButton danger onClick={onAnonymize}>
        Anonymize…
      </MenuButton>
    </div>
  );
}

export default function UsersSection() {
  const queryClient = useQueryClient();
  const { user: actor } = useAuth();
  const canKyc = canManageUserKyc(actor?.role);
  const [search, setSearch] = useState(initialSearchFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchFromUrl);
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [openMenu, setOpenMenu] = useState(null);
  const [kycDialog, setKycDialog] = useState(null);
  const [suspending, setSuspending] = useState(null);
  const [unsuspending, setUnsuspending] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [anonymizing, setAnonymizing] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const debouncedSet = useDebounce((v) => {
    setDebouncedSearch(v);
    setPage(0);
  });

  const params = {
    ...pageParams(page),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(filter === "ACTIVE"
      ? { enabled: true }
      : filter === "SUSPENDED"
        ? { enabled: false }
        : filter === "UNVERIFIED"
          ? { emailVerified: false }
          : {}),
  };

  const { data, isLoading, isFetching, error } = useAdminUsers(params);

  // Outside click and Escape both close the overflow menu; the transparent
  // backdrop also stops a click on another row from opening details behind it.
  useEffect(() => {
    if (!openMenu) return undefined;
    const handler = (e) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openMenu]);

  const unsuspend = useMutation({
    mutationFn: (userId) => unsuspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setUnsuspending(null);
    },
    meta: { successMessage: "User unsuspended" },
  });

  const markForDeletion = useMutation({
    mutationFn: ({ userId, reason }) => markUserForDeletion(userId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeleting(null);
    },
    meta: { successMessage: "User marked for deletion" },
  });

  const anonymize = useMutation({
    mutationFn: ({ userId, reason }) => anonymizeUser(userId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setAnonymizing(null);
    },
    meta: { successMessage: "User anonymized" },
  });

  const items = data?.content ?? [];

  return (
    <div>
      {/* Header — breadcrumb + h1 with the total chip (design: Users) */}
      <nav className="text-xs text-gray-400 mb-1.5" aria-label="Breadcrumb">
        <span>Operations</span>
        <span className="mx-1.5">/</span>
        <span className="text-gray-600">Users</span>
      </nav>
      <div className="flex items-center gap-2.5">
        <h1 className="m-0 text-2xl font-bold text-gray-900">Users</h1>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stacked-container text-ink-muted">
          {(data?.totalElements ?? 0).toLocaleString()}
        </span>
        {isFetching && !isLoading && (
          <Loader2 size={13} className="text-gray-400 animate-spin" aria-label="Refreshing" />
        )}
      </div>
      <p className="m-0 mt-1 mb-5 text-sm text-gray-400">All registered platform users.</p>

      {/* Filter tabs + search */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div
          role="group"
          aria-label="Filter users"
          className="inline-flex items-center gap-1 p-1 rounded-g-2 bg-surface-sunken border border-surface-container-border"
        >
          {FILTERS.map((tab) => {
            const active = filter === tab.value;
            return (
              <Button
                key={tab.value}
                variant={active ? "outline-neutral" : "tertiary"}
                size="xs"
                fullWidth={false}
                aria-pressed={active}
                onClick={() => {
                  setFilter(tab.value);
                  setPage(0);
                }}
                className={
                  active
                    ? "bg-white! shadow-sm! border-black/10! text-gray-900! font-semibold!"
                    : "text-gray-500! hover:text-gray-700!"
                }
              >
                {tab.label}
              </Button>
            );
          })}
        </div>
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            debouncedSet(v);
          }}
          placeholder="Search name or email"
          width={260}
        />
      </div>

      {openMenu && (
        <div className="fixed inset-0 z-50" aria-hidden="true" onClick={() => setOpenMenu(null)} />
      )}

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIcon={Users}
        emptyLabel="No users found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["User", "Role", "Status", "Verified", "KYC", "Last Login", "Communities", ""].map(
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
            {items.map((u, i) => {
              const name = displayName(u);
              const kycAction = canKyc ? userKycAction(u) : null;
              const initials = getInitials({
                firstName: u.userData?.firstName,
                lastName: u.userData?.lastName,
                email: u.email,
              });
              return (
                <tr
                  key={u.id}
                  onClick={() => setViewingUser(u.id)}
                  className={`group cursor-pointer hover:bg-gray-50 transition-colors ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-brand-tint text-brand text-[11px] font-bold flex items-center justify-center flex-shrink-0 select-none">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <Button
                          variant="tertiary"
                          size="xs"
                          fullWidth={false}
                          aria-label={`View details for ${u.email ?? u.id}`}
                          className="block! max-w-full text-left! px-0! py-0! h-auto! truncate! hover:bg-transparent! text-gray-900!"
                        >
                          {name || (
                            <span className="italic font-normal text-gray-400">No name</span>
                          )}
                        </Button>
                        <p className="m-0 text-[11px] text-gray-400 truncate">
                          {u.email || <span className="italic">No email on file</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.isPlatformAdmin ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-tint text-brand">
                        Platform Admin
                      </span>
                    ) : u.platformRole ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stacked-container text-ink-muted">
                        {u.platformRole}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">User</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.enabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                    >
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0"
                      />
                      {u.enabled ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {u.emailVerified ? (
                      <span className="text-[11px] font-medium text-success">✓ Verified</span>
                    ) : (
                      <span className="text-[11px] text-gray-400">Unverified</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[11px] text-gray-500">
                      {u.kycStatus ? kycStatusLabel(u.kycStatus) : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[11px] text-gray-500">{fmtDateTime(u.lastLoginAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-gray-600">
                      {u.metrics?.totalRelatedCommunities ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {!u.enabled && (
                        <Button
                          variant="outline-neutral"
                          size="xs"
                          onClick={() => setUnsuspending(u)}
                          disabled={unsuspend.isPending}
                          fullWidth={false}
                        >
                          Unsuspend
                        </Button>
                      )}
                      <div className="relative inline-block">
                        <Button
                          variant="tertiary"
                          size="icon-sm"
                          aria-label={`Actions for ${name || u.email || u.id}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenu === u.id}
                          onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                        >
                          <MoreVertical size={15} />
                        </Button>
                        {openMenu === u.id && (
                          <RowMenu
                            user={u}
                            kycAction={kycAction}
                            onKycAction={(action) => {
                              setOpenMenu(null);
                              setKycDialog({ userId: u.id, action });
                            }}
                            onSuspend={() => {
                              setOpenMenu(null);
                              setSuspending(u);
                            }}
                            onDelete={() => {
                              setOpenMenu(null);
                              setDeleting(u);
                            }}
                            onAnonymize={() => {
                              setOpenMenu(null);
                              setAnonymizing(u);
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="user"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />
      {suspending && <SuspendModal user={suspending} onClose={() => setSuspending(null)} />}
      {viewingUser && <UserDetailModal userId={viewingUser} onClose={() => setViewingUser(null)} />}
      {kycDialog && (
        <AdminUserKycDialog
          userId={kycDialog.userId}
          action={kycDialog.action}
          onClose={() => setKycDialog(null)}
        />
      )}
      {unsuspending && (
        <UnsuspendModal
          user={unsuspending}
          onClose={() => setUnsuspending(null)}
          onConfirm={() => unsuspend.mutate(unsuspending.id)}
          unsuspending={unsuspend.isPending}
        />
      )}
      {deleting && (
        <DeleteConfirmModal
          user={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => markForDeletion.mutate({ userId: deleting.id, reason: DELETE_REASON })}
          deleting={markForDeletion.isPending}
        />
      )}
      {anonymizing && (
        <AnonymizeModal
          user={anonymizing}
          onClose={() => setAnonymizing(null)}
          onConfirm={(reason) => anonymize.mutate({ userId: anonymizing.id, reason })}
          anonymizing={anonymize.isPending}
        />
      )}
    </div>
  );
}
