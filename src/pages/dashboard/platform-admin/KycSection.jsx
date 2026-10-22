import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, User as UserIcon } from "lucide-react";
import { decideKyc, setKycAttemptPolicy } from "../../../api/admin";
import { useDebounce } from "../../../hooks/useDebounce";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { TextInput } from "../../../components/ui/TextInput";
import {
  SectionHeader,
  SearchBar,
  FilterSelect,
  TableShell,
  TableFooter,
  StatusBadge,
} from "./SharedUI";
import { pageParams, fmtDateTime } from "./shared";
import {
  useAdminKycAttempt,
  useAdminKycAttempts,
  useInvalidateAdminKyc,
} from "../../../hooks/useAdminKyc";
import AdminUserKycActions, {
  AdminUserKycDialog,
} from "../../../components/dashboard/AdminUserKycActions";
import {
  idTypeLabel,
  isKycInReview,
  KYC_STATUS_FILTER_OPTIONS,
  KYC_ID_TYPE_FILTER_OPTIONS,
  KYC_DEFAULT_STATUS_FILTER,
} from "../../../utils/kycStatus";
import { getErrorMessage } from "../../../utils/errorHandler";

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-[11px] text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-[11px] text-gray-800 text-right break-words min-w-0">
        {value ?? "—"}
      </span>
    </div>
  );
}

function KycDetailModal({ attemptId, onClose }) {
  const queryClient = useQueryClient();
  const [userAction, setUserAction] = useState(null);
  const invalidateUserKyc = useInvalidateAdminKyc();
  const [mode, setMode] = useState(null); // "APPROVE" | "REJECT" | "POLICY" | null
  const [reason, setReason] = useState("");
  const [policyAllowed, setPolicyAllowed] = useState(false);
  const [formError, setFormError] = useState("");

  const detail = useAdminKycAttempt(attemptId);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-kyc-attempts"] });
    queryClient.invalidateQueries({ queryKey: ["admin-kyc-attempt", attemptId] });
    if (detail.data?.user?.id) invalidateUserKyc(detail.data.user.id);
  };

  const decide = useMutation({
    mutationFn: ({ decision, reason: r }) => decideKyc(attemptId, { decision, reason: r }),
    onSuccess: () => {
      invalidate();
      setMode(null);
      setReason("");
    },
    meta: {
      successMessage: (vars) => (vars.decision === "APPROVE" ? "KYC approved" : "KYC rejected"),
    },
    onError: (err) => {
      const status = err?.response?.status;
      if (status === 409) {
        invalidate();
        setFormError("This attempt changed — details reloaded. Review the latest state.");
      } else {
        setFormError(getErrorMessage(err, "Action failed."));
      }
    },
  });

  const policy = useMutation({
    mutationFn: ({ allowed, reason: r }) =>
      setKycAttemptPolicy(detail.data?.user?.id, { allowed, reason: r }),
    onSuccess: () => {
      invalidate();
      setMode(null);
      setReason("");
    },
    meta: { successMessage: "Attempt policy updated" },
    onError: (err) => setFormError(getErrorMessage(err, "Policy update failed.")),
  });

  const d = detail.data;
  const busy = decide.isPending || policy.isPending;
  const evidence = d?.evidence;
  const reviewReasons = evidence?.reviewReasons ?? [];

  function submitReason() {
    setFormError("");
    const r = reason.trim();
    if (!r) {
      setFormError("A user-visible reason is required.");
      return;
    }
    if (mode === "APPROVE" || mode === "REJECT") decide.mutate({ decision: mode, reason: r });
    else if (mode === "POLICY") policy.mutate({ allowed: policyAllowed, reason: r });
  }

  // Replace the evidence dialog during a user-level action; do not stack
  // dialogs or let historical attempt state determine profile eligibility.
  if (userAction && d?.user?.id) {
    return (
      <AdminUserKycDialog
        userId={d.user.id}
        action={userAction}
        onClose={() => setUserAction(null)}
      />
    );
  }

  return (
    <ModalShell
      size="wide"
      title="KYC attempt"
      subtitle={d?.id ? `Attempt ${d.id.slice(0, 8)}…` : "Loading…"}
      onClose={onClose}
      footer={
        !d ? null : mode ? (
          <div>
            <p className="text-[11px] font-semibold text-gray-700 m-0 mb-2">
              {mode === "APPROVE" && "Approve reason"}
              {mode === "REJECT" && "Reject reason"}
              {mode === "POLICY" && "Attempt policy"}
            </p>
            {mode === "POLICY" && (
              <label className="flex items-center gap-2 text-[11px] text-gray-600 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyAllowed}
                  onChange={(e) => setPolicyAllowed(e.target.checked)}
                />
                Allow new attempts
              </label>
            )}
            <TextInput
              label="User-visible reason"
              hideLabel
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="User-visible reason…"
            />
            {formError && <p className="text-[11px] text-danger mt-2 mb-0">{formError}</p>}
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant={mode === "REJECT" ? "danger" : "brand"}
                loading={busy}
                onClick={submitReason}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline-neutral"
                onClick={() => {
                  setMode(null);
                  setReason("");
                  setFormError("");
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {isKycInReview(d.status) && d.canApprove !== false && (
              <Button size="sm" onClick={() => setMode("APPROVE")}>
                Approve
              </Button>
            )}
            {isKycInReview(d.status) && (
              <Button size="sm" variant="danger" onClick={() => setMode("REJECT")}>
                Reject
              </Button>
            )}
            {d.user?.id && <AdminUserKycActions userId={d.user.id} onAction={setUserAction} />}
            {d.user?.id && (
              <Button size="sm" variant="secondary" onClick={() => setMode("POLICY")}>
                Attempt policy
              </Button>
            )}
          </div>
        )
      }
    >
      <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
        {detail.isLoading && <p className="text-xs text-gray-400">Loading detail…</p>}
        {detail.isError && (
          <p className="text-xs text-danger">
            {getErrorMessage(detail.error, "Failed to load attempt detail.")}
          </p>
        )}

        {d && (
          <>
            <div className="flex items-center justify-between gap-2 mb-3">
              <StatusBadge status={d.status} />
              <span className="text-[11px] text-gray-400">{fmtDateTime(d.createdAt)}</span>
            </div>

            <div className="bg-white rounded-xl border border-surface-container-border p-3 mb-3">
              <Row
                label="User"
                value={
                  d.user
                    ? `${[d.user.firstName, d.user.lastName].filter(Boolean).join(" ") || d.user.username || "—"}` +
                      (d.user.email ? ` · ${d.user.email}` : "")
                    : "—"
                }
              />
              <Row label="User ID" value={d.user?.id} />
              <Row label="External ref" value={d.externalUserReference} />
              <Row label="ID type" value={idTypeLabel(d.idType)} />
              <Row
                label="ID number"
                value={d.idNumber ? "••••" + String(d.idNumber).slice(-4) : "—"}
              />
              <Row label="Country" value={d.country} />
              <Row label="Provider" value={d.providerName} />
              <Row label="Environment" value={d.environment} />
              <Row label="Provider status" value={d.providerStatus} />
              <Row label="Job ID" value={d.providerJobId} />
              <Row label="Submitted" value={fmtDateTime(d.submittedAt)} />
              <Row label="Decided" value={fmtDateTime(d.decidedAt)} />
              <Row label="Decision reason" value={d.decisionReason} />
              <Row label="Revoked reason" value={d.revokedReason} />
            </div>

            {Array.isArray(d.reviewReasons) && d.reviewReasons.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                <p className="text-[11px] font-semibold text-amber-800 m-0 mb-1">Review reasons</p>
                <p className="text-[11px] text-amber-700 m-0">{d.reviewReasons.join(", ")}</p>
              </div>
            )}

            {evidence && (
              <div className="bg-white rounded-xl border border-surface-container-border p-3 mb-3">
                <p className="text-[11px] font-semibold text-gray-500 m-0 mb-1">Evidence</p>
                <Row
                  label="Authority name"
                  value={[evidence.authorityFirstName, evidence.authorityLastName]
                    .filter(Boolean)
                    .join(" ")}
                />
                <Row label="DOB" value={evidence.authorityDateOfBirth} />
                <Row label="Provider reason" value={evidence.providerReason} />
                <Row label="Smile Secure" value={evidence.smileSecure?.status} />
                <Row label="Fraud risk" value={evidence.fraudRisk?.riskLevel} />
                {reviewReasons.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {reviewReasons.map((rr, i) => (
                      <div key={`${rr.code}-${i}`} className="text-[11px] text-gray-600">
                        <span className="font-semibold">{rr.code}</span>
                        {rr.message ? ` — ${rr.message}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {d.matchedAccounts && Object.keys(d.matchedAccounts).length > 0 && (
              <div className="bg-white rounded-xl border border-surface-container-border p-3 mb-3">
                <p className="text-[11px] font-semibold text-gray-500 m-0 mb-1">Matched accounts</p>
                {Object.entries(d.matchedAccounts).map(([ref, v]) => (
                  <Row
                    key={ref}
                    label={ref}
                    value={`${v.accountState ?? "—"} / ${v.kycStatus ?? "—"}`}
                  />
                ))}
              </div>
            )}

            {d.canApprove === false &&
              Array.isArray(d.approvalBlockingReasons) &&
              d.approvalBlockingReasons.length > 0 && (
                <p className="text-[11px] text-danger mb-2">
                  Evidence-review approval blocked: {d.approvalBlockingReasons.join(", ")}
                </p>
              )}
          </>
        )}
      </div>
    </ModalShell>
  );
}

export default function KycSection() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(KYC_DEFAULT_STATUS_FILTER);
  const [idType, setIdType] = useState("ALL");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);
  const debouncedSet = useDebounce((v) => {
    setDebouncedSearch(v);
    setPage(0);
  });

  const params = {
    ...pageParams(page),
    ...(debouncedSearch ? { userId: debouncedSearch } : {}),
    ...(status !== "ALL" ? { status } : {}),
    ...(idType !== "ALL" ? { idType } : {}),
  };

  const { data, isLoading, isFetching, error } = useAdminKycAttempts(params);

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="KYC"
        desc="Identity verification attempts. Default queue is In review."
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
              placeholder="Search user ID…"
            />
            <FilterSelect
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
              options={KYC_STATUS_FILTER_OPTIONS}
            />
            <FilterSelect
              value={idType}
              onChange={(v) => {
                setIdType(v);
                setPage(0);
              }}
              options={KYC_ID_TYPE_FILTER_OPTIONS}
            />
          </>
        }
      />

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIcon={ShieldCheck}
        emptyLabel="No KYC attempts found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["User", "Status", "ID type", "Provider", "Review reasons", "Created", ""].map(
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
            {items.map((a, i) => (
              <tr
                key={a.id}
                onClick={() => setOpenId(a.id)}
                className={`group hover:bg-gray-50 transition-colors cursor-pointer ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <UserIcon size={12} className="text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-gray-900 truncate">
                        {[a.user?.firstName, a.user?.lastName].filter(Boolean).join(" ") ||
                          a.user?.email ||
                          "—"}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">{a.user?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-[12px] text-gray-700">{idTypeLabel(a.idType)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-gray-500">
                    {a.providerStatus ?? a.providerName ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-gray-500">
                    {Array.isArray(a.reviewReasons) && a.reviewReasons.length
                      ? a.reviewReasons.join(", ")
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-[11px] text-gray-400">{fmtDateTime(a.createdAt)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="xs"
                    fullWidth={false}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(a.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 ml-auto"
                  >
                    <ShieldCheck size={11} /> Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="attempt"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />

      {openId && <KycDetailModal attemptId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
