import { useState } from "react";
import { Info, X, Trash2, AlertTriangle } from "lucide-react";
import { useEscapeToClose } from "../../../../hooks/useKeyboardShortcuts";
import { useActiveCommunityId } from "../../../../hooks/useActiveCommunityId";
import { useCommunityAccount } from "../../../../hooks/useCommunityAccount";
import { useCommunity } from "../../../../hooks/useCommunity";
import AccountFormModal from "../../../../components/dashboard/AccountFormModal";
import LoadingState from "../../../../components/common/LoadingState";
import SuccessBadge from "../../../../components/common/SuccessBadge";
import { Button } from "../../../../components/ui/Button";
import { formatNairaCompact as formatNaira, formatDate } from "../../../../utils/format";
import { getErrorMessage } from "../../../../utils/errorHandler";
import banksData from "nigerian-bank-icons/assets/banks.json";
import { normalizeImageUrl } from "../../../../utils/normalizeImageFields";

// Exclude generic placeholder entries — banks without real logos use colored initials.
const BANK_LOGO_BY_CODE = Object.fromEntries(
  banksData.filter((b) => !b.logo.includes("default-image")).map((b) => [b.code, b.logo]),
);

// Map common Nigerian bank names to their brand colours
function bankColorCls(name = "") {
  const n = name.toLowerCase();
  if (n.includes("guaranty") || n.includes("guarantee") || n.includes("gtb") || n.includes("gt "))
    return "bg-[#E05C00]";
  if (n.includes("access")) return "bg-[#C8102E]";
  if (n.includes("zenith")) return "bg-[#841B2D]";
  if (n.includes("first bank") || n.includes("firstbank")) return "bg-[#003087]";
  if (n.includes("uba") || n.includes("united bank")) return "bg-[#C8102E]";
  if (n.includes("stanbic")) return "bg-[#009EE0]";
  if (n.includes("union bank")) return "bg-[#2B5B3F]";
  if (n.includes("sterling")) return "bg-[#9B2335]";
  if (n.includes("fidelity")) return "bg-[#005B98]";
  if (n.includes("polaris")) return "bg-[#6C2382]";
  if (n.includes("wema")) return "bg-[#5C068C]";
  return "bg-brand";
}

// Two-letter initials from the bank name
function bankInitials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BK";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function BankAvatar({ bankCode, bankName, storedLogoUrl }) {
  const [imgFailed, setImgFailed] = useState(false);
  // Prefer logo URL stored at account-save time (from Paystack API), then package map.
  // Ignore URLs that are the generic placeholder.
  // SECURITY: `storedLogoUrl` is server-supplied (the bank logo recorded with the
  // settlement account), so validate that branch. The `BANK_LOGO_BY_CODE`
  // fallback comes from the bundled nigerian-bank-icons package and is left
  // untouched — it is not attacker-influenced.
  const logoUrl =
    normalizeImageUrl(
      storedLogoUrl && !storedLogoUrl.includes("default-image") ? storedLogoUrl : null,
    ) ??
    BANK_LOGO_BY_CODE[bankCode] ??
    null;
  if (logoUrl && !imgFailed) {
    return (
      <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden border border-surface-container-border bg-white flex items-center justify-center">
        <img
          src={logoUrl}
          alt={bankName}
          className="w-full h-full object-contain p-0.5"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }
  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${bankColorCls(bankName)}`}
    >
      {bankInitials(bankName)}
    </div>
  );
}

// Status pill next to the account name — PENDING accounts haven't cleared
// verification yet, so this shouldn't look identical to a settled one.
function StatusBadge({ status }) {
  if (!status) return null;
  const styles = {
    ACTIVE: "bg-success-wash text-[#027A48]",
    VERIFIED: "bg-success-wash text-[#027A48]",
    PENDING: "bg-[#FFFAEB] text-[#B54708]",
    UNVERIFIED: "bg-[#FFFAEB] text-[#B54708]",
    FAILED: "bg-[#FEF3F2] text-[#B42318]",
    REJECTED: "bg-[#FEF3F2] text-[#B42318]",
    NEED_MORE_INFORMATION: "bg-[#FFF7ED] text-[#C2410C]",
    DISABLED: "bg-[#F2F4F7] text-[#475467]",
  };
  const cls = styles[status] ?? "bg-[#F2F4F7] text-[#475467]";
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${cls}`}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

// Confirm-delete modal for removing the payout account
function RemoveAccountModal({ onClose, onConfirm, isDeleting }) {
  useEscapeToClose(onClose);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-70 bg-black/20" />
      <div className="fixed inset-0 z-80 flex items-center justify-center p-4">
        <div
          className="w-full max-w-sm rounded-xl p-6 bg-surface-bg"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-[16px] font-bold text-gray-900 mb-1.5">Remove payout account?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Glass won't be able to settle collected payments until you add a new payout account.
            This can't be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              onClick={onClose}
              disabled={isDeleting}
              fullWidth={false}
              variant="outline-neutral"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              loading={isDeleting}
              fullWidth={false}
              variant="critical"
              size="sm"
            >
              {isDeleting ? "Removing…" : "Remove Account"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Change / Add account modal
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function PaystackAccount() {
  const communityId = useActiveCommunityId();
  const { account, isLoading, create, update, remove } = useCommunityAccount(communityId);
  const { data: community } = useCommunity(communityId);
  const [showModal, setShowModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [removeError, setRemoveError] = useState("");

  const bankName =
    account?.settlementBank ?? account?.bankName ?? account?.bank ?? account?.bankTitle ?? "";
  const bankCode = account?.settlementBankCode ?? account?.bankCode ?? account?.code ?? "";
  const communityName = community?.name ?? "";

  async function handleSave({
    settlementBank,
    settlementBankCode,
    settlementBankSlug,
    accountNumber,
    accountName,
  }) {
    const body = {
      settlementBank,
      settlementBankCode,
      settlementBankSlug,
      accountNumber,
      accountName,
    };
    setSaveError("");
    try {
      if (account?.id) {
        await update.mutateAsync({ accountId: account.id, payload: body });
      } else {
        await create.mutateAsync(body);
      }
      setShowModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1800);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Couldn't save the account. Please try again."));
    }
  }

  async function handleRemove() {
    setRemoveError("");
    try {
      await remove.mutateAsync(account.id);
      setShowRemoveModal(false);
    } catch (err) {
      setRemoveError(getErrorMessage(err, "Couldn't remove the account. Please try again."));
    }
  }

  return (
    <div className="flex flex-col gap-10 w-full">
      {isLoading ? (
        <LoadingState />
      ) : account ? (
        <div className="bg-surface-container rounded-2xl p-6 border border-surface-container-border">
          <p className="text-sm font-bold text-gray-900 mb-0.5">Current Payout Account</p>
          <p className="text-xs text-gray-400 mb-4">
            All payments collected from members
            {communityName ? ` in ${communityName}` : ""} are disbursed to this account.
          </p>
          <div className="-mx-6 border-b border-gray-100 mb-5" />

          {(account.status === "REJECTED" || account.status === "NEED_MORE_INFORMATION") &&
            account.verificationComment && (
              <div
                className={`flex items-start gap-2.5 rounded-xl px-4 py-3.5 mb-5 ${account.status === "REJECTED" ? "bg-[#FEF3F2]" : "bg-[#FFF7ED]"}`}
              >
                <AlertTriangle
                  size={14}
                  className={`flex-shrink-0 mt-0.5 ${account.status === "REJECTED" ? "text-[#B42318]" : "text-[#C2410C]"}`}
                />
                <div>
                  <p
                    className={`text-xs font-semibold mb-0.5 ${account.status === "REJECTED" ? "text-[#B42318]" : "text-[#C2410C]"}`}
                  >
                    {account.status === "REJECTED"
                      ? "This account was rejected"
                      : "More information needed"}
                  </p>
                  <p
                    className={`text-xs leading-relaxed ${account.status === "REJECTED" ? "text-[#B42318]" : "text-[#C2410C]"}`}
                  >
                    {account.verificationComment}
                  </p>
                </div>
              </div>
            )}

          {/* Bank row + stats — sit directly in the outer card per Figma,
              no separate nested card/background around them. */}
          <div className="flex items-center justify-between gap-4 pb-4 mb-4 border-b border-stacked-container">
            <div className="flex items-center gap-3 min-w-0">
              <BankAvatar
                bankCode={bankCode}
                bankName={bankName}
                storedLogoUrl={account?.settlementBankLogo ?? account?.bankLogo ?? account?.logo}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {account.accountName ?? account.name ?? "—"}
                  </p>
                  <StatusBadge status={account.status} />
                </div>
                <p className="text-xs text-gray-400">
                  {account.accountNumber ?? account.number ?? account.acctNumber ?? "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="tertiary"
                size="xs"
                fullWidth={false}
                onClick={() => setShowModal(true)}
              >
                Change Account
              </Button>
              <Button
                variant="tertiary"
                size="icon-sm"
                onClick={() => {
                  setRemoveError("");
                  setShowRemoveModal(true);
                }}
                title="Remove payout account"
                aria-label="Remove payout account"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          </div>
          {removeError && <p className="text-xs text-danger mb-4 -mt-2">{removeError}</p>}
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Received</p>
              <p className="text-sm font-bold text-gray-900">
                {formatNaira(
                  account.totalReceivedAmount ??
                    account.totalReceived ??
                    account.totalAmount ??
                    account.totalSettlement,
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Last Payout</p>
              <p className="text-sm font-bold text-gray-900">
                {formatDate(
                  account.lastPayoutAt ??
                    account.lastPayout ??
                    account.lastSettlementAt ??
                    account.lastSettledAt,
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Account Added</p>
              <p className="text-sm font-bold text-gray-900">
                {formatDate(account.createdAt ?? account.addedAt ?? account.dateCreated)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        // No account yet — prompt to add one
        <div className="bg-surface-container rounded-2xl p-6 text-center border border-surface-container-border">
          <p className="text-sm font-bold text-gray-900 mb-1">No Payout Account Set Up</p>
          <p className="text-xs text-gray-400 mb-5">
            Add a bank account so Glass can settle your community's collected payments.
          </p>
          <Button onClick={() => setShowModal(true)} fullWidth={false} size="sm" className="px-5">
            Add Payout Account
          </Button>
        </div>
      )}

      {/* Info notice */}
      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3.5 bg-brand-wash">
        <Info size={14} className="text-brand flex-shrink-0 mt-0.5" />
        <p className="text-xs text-brand leading-relaxed">
          Payouts are processed automatically based on your payout frequency settings. Changing your
          account takes effect on the next payout cycle.
        </p>
      </div>

      {showModal && (
        <AccountFormModal
          onClose={() => {
            setShowModal(false);
            setSaveError("");
          }}
          onSave={handleSave}
          isSaving={create.isPending || update.isPending}
          saveError={saveError}
        />
      )}

      {showRemoveModal && (
        <RemoveAccountModal
          onClose={() => {
            setShowRemoveModal(false);
            setRemoveError("");
          }}
          onConfirm={handleRemove}
          isDeleting={remove.isPending}
        />
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/20">
          <div className="bg-surface-bg rounded-2xl p-8 shadow-2xl">
            <SuccessBadge message="Your Payout Account Is Now Set!" />
          </div>
        </div>
      )}
    </div>
  );
}
