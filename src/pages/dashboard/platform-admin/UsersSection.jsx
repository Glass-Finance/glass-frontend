import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, ShieldCheck, Users, Trash2, EyeOff } from "lucide-react";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { toTitleCase } from "../../../utils/format";
import { suspendUser, unsuspendUser, markUserForDeletion, anonymizeUser } from "../../../api/admin";
import { pageParams, fmtDateTime, initialSearchFromUrl } from "./shared";
import { useAdminUsers } from "../../../hooks/useAdminKyc";
import AdminUserKycActions from "../../../components/dashboard/AdminUserKycActions";
import { kycStatusLabel } from "../../../utils/kycStatus";
import { useDebounce } from "../../../hooks/useDebounce";
import { SectionHeader, SearchBar, FilterSelect, TableShell, TableFooter } from "./SharedUI";
import UserDetailModal from "./UserDetailModal";

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
            className="w-full px-3 py-2.5 rounded-lg text-xs text-gray-800 outline-none resize-none transition-colors border border-[#D0D0D0] focus:border-[#002FA7]"
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

function MarkForDeletionModal({ user, onClose, onConfirm, marking }) {
  const [reason, setReason] = useState("");

  return (
    <ModalShell title="Mark User for Deletion" subtitle={user.email} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason);
        }}
        className="px-6 py-5 flex flex-col gap-4"
      >
        <p className="text-xs text-gray-600 leading-relaxed">
          Schedules <strong>{user.email}</strong>'s account for deletion. It enters the standard
          grace period before anything is permanently removed -- use Anonymize afterward to skip the
          wait.
        </p>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            className="w-full px-3 py-2.5 rounded-lg text-xs text-gray-800 outline-none resize-none transition-colors border border-[#D0D0D0] focus:border-[#002FA7]"
            placeholder="Why is this account being marked for deletion?"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            onClick={onClose}
            disabled={marking}
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
            loading={marking}
            fullWidth={false}
            variant="critical"
            size="sm"
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            {marking ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {marking ? "Marking…" : "Mark for Deletion"}
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
            className="w-full px-3 py-2.5 rounded-lg text-xs text-gray-800 outline-none resize-none transition-colors border border-[#D0D0D0] focus:border-[#002FA7]"
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

export default function UsersSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(initialSearchFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearchFromUrl);
  const [enabledFilter, setEnabledFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [suspending, setSuspending] = useState(null);
  const [unsuspending, setUnsuspending] = useState(null);
  const [markingDeletion, setMarkingDeletion] = useState(null);
  const [anonymizing, setAnonymizing] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const debouncedSet = useDebounce((v) => {
    setDebouncedSearch(v);
    setPage(0);
  });

  const params = {
    ...pageParams(page),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(enabledFilter !== "ALL" ? { enabled: enabledFilter === "ACTIVE" } : {}),
  };

  const { data, isLoading, isFetching, error } = useAdminUsers(params);

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
      setMarkingDeletion(null);
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
      <SectionHeader
        title="Users"
        desc="All registered platform users."
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
              placeholder="Search users…"
              width={220}
            />
            <FilterSelect
              value={enabledFilter}
              onChange={(v) => {
                setEnabledFilter(v);
                setPage(0);
              }}
              options={[
                { value: "ALL", label: "All users" },
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
              ]}
            />
          </>
        }
      />

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
            {items.map((u, i) => (
              <tr
                key={u.id}
                onClick={() => setViewingUser(u.id)}
                className={`group cursor-pointer hover:bg-gray-50 transition-colors ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3">
                  <Button
                    variant="tertiary"
                    size="xs"
                    fullWidth={false}
                    aria-label={`View details for ${u.email ?? u.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setViewingUser(u.id);
                    }}
                  >
                    {[u.userData?.firstName, u.userData?.lastName]
                      .filter(Boolean)
                      .map((s) => toTitleCase(s.trim()))
                      .join(" ") || "—"}
                  </Button>
                  <p className="text-[11px] text-gray-400">{u.email}</p>
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
                    className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.enabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                  >
                    {u.enabled ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`text-[11px] font-medium ${u.emailVerified ? "text-success" : "text-gray-400"}`}
                  >
                    {u.emailVerified ? "Yes" : "No"}
                  </span>
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
                <td className="px-4 py-3 text-right">
                  <div
                    className="flex flex-wrap items-center justify-end gap-1.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <AdminUserKycActions userId={u.id} user={u} />
                    {u.enabled ? (
                      <Button
                        variant="outline-caution"
                        size="xs"
                        onClick={() => setSuspending(u)}
                        fullWidth={false}
                        className="flex items-center gap-1"
                      >
                        <ShieldAlert size={11} /> Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="success"
                        size="xs"
                        onClick={() => setUnsuspending(u)}
                        disabled={unsuspend.isPending}
                        fullWidth={false}
                        className="flex items-center gap-1"
                      >
                        <ShieldCheck size={11} /> Unsuspend
                      </Button>
                    )}
                    <Button
                      variant="outline-caution"
                      size="xs"
                      onClick={() => setMarkingDeletion(u)}
                      title="Mark for deletion"
                      fullWidth={false}
                      className="flex items-center gap-1"
                    >
                      <Trash2 size={11} /> Delete
                    </Button>
                    <Button
                      onClick={() => setAnonymizing(u)}
                      title="Anonymize now (requires the account already be marked for deletion)"
                      fullWidth={false}
                      variant="critical"
                      size="xs"
                      className="flex items-center gap-1"
                    >
                      <EyeOff size={11} /> Anonymize
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
        noun="user"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />
      {suspending && <SuspendModal user={suspending} onClose={() => setSuspending(null)} />}
      {viewingUser && <UserDetailModal userId={viewingUser} onClose={() => setViewingUser(null)} />}
      {unsuspending && (
        <UnsuspendModal
          user={unsuspending}
          onClose={() => setUnsuspending(null)}
          onConfirm={() => unsuspend.mutate(unsuspending.id)}
          unsuspending={unsuspend.isPending}
        />
      )}
      {markingDeletion && (
        <MarkForDeletionModal
          user={markingDeletion}
          onClose={() => setMarkingDeletion(null)}
          onConfirm={(reason) => markForDeletion.mutate({ userId: markingDeletion.id, reason })}
          marking={markForDeletion.isPending}
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
