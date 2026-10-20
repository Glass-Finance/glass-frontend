import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useBanks } from "../../hooks/useBanks";
import { useResolveAccount } from "../../hooks/useResolveAccount";
import { useEscapeToClose } from "../../hooks/useKeyboardShortcuts";
import { getErrorMessage } from "../../utils/errorHandler";
import BankSelect from "../common/BankSelect";
import { Button } from "../ui/Button";

const inputCls =
  "w-full h-12 min-h-8 border-[1.5px] border-gray-300 px-4 py-1 rounded-lg text-placeholder text-gray-800 placeholder-gray-400 outline-none focus:border-brand transition-all";

// Bank account entry form — number + bank select, auto-resolves the account
// name via Paystack, falls back to manual entry if resolution fails.
// Originally lived only in PaystackAccount.jsx (the community-owner's own
// payout-account settings); extracted so the platform-admin panel's
// create-account-on-behalf-of-a-community flow can reuse the exact same
// verified UX instead of a second, drifting copy of it.
export default function AccountFormModal({
  onClose,
  onSave,
  isSaving,
  saveError,
  title = "Set up your payment Account",
  subtitle = "This is where Glass will collect and manage dues on behalf of your community.",
}) {
  const { banks } = useBanks();
  const resolveAccount = useResolveAccount();
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankSlug, setBankSlug] = useState("");
  const [accNumber, setAccNumber] = useState("");
  const [accName, setAccName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(""); // non-blocking warning
  const [manualMode, setManualMode] = useState(false); // allow typing accName after resolve fails

  useEscapeToClose(onClose);

  // Auto-resolve account name once we have a full 10-digit number + bank
  useEffect(() => {
    if (!bankCode || accNumber.length !== 10) {
      // Clearing the resolved name/error when the input becomes incomplete
      // is the effect's own reset branch, not a derived-during-render value
      // -- accName/resolveError are edited directly elsewhere below too.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!manualMode) setAccName("");
      setResolveError("");
      return;
    }
    const timer = setTimeout(async () => {
      setResolving(true);
      setResolveError("");
      try {
        const { data } = await resolveAccount.mutateAsync({
          bankCode,
          accountNumber: accNumber,
        });
        // Backend may wrap in { success, data: { accountName } } or return flat
        const name =
          data?.data?.accountName ??
          data?.accountName ??
          (data?.success === false ? null : (data?.name ?? null));
        if (name) {
          setAccName(name);
          setManualMode(false);
        } else {
          setResolveError("Couldn't auto-verify this account. Enter the account name manually.");
          setManualMode(true);
        }
      } catch (err) {
        const message = getErrorMessage(err, "Couldn't auto-verify this account");
        setResolveError(`${message} Enter the account name manually.`);
        setManualMode(true);
      } finally {
        setResolving(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [bankCode, accNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!accName.trim()) {
      setResolveError("Account name is required.");
      return;
    }
    onSave({
      settlementBank: bankName,
      settlementBankCode: bankCode,
      settlementBankSlug: bankSlug,
      accountNumber: accNumber,
      accountName: accName.trim(),
    });
  }

  return (
    <>
      {/* Backdrop — matches ModalShell's treatment used everywhere else
          (0.35 opacity + blur, not a heavier flat 0.55 dark overlay). */}
      <div onClick={onClose} className="fixed inset-0 z-70 bg-black/20" />

      {/* Modal — centred */}
      <div className="fixed inset-0 z-80 flex items-center justify-center p-4">
        <div
          className="w-full max-w-xl rounded-xl p-7 shadow-2xl bg-surface-bg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-1.5">
            <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Close"
              onClick={onClose}
              className="flex-shrink-0 ml-4 mt-0.5"
            >
              <X size={15} />
            </Button>
          </div>
          <p className="text-sm text-gray-400 mb-6">{subtitle}</p>

          <div className="space-y-4">
            {/* Row 1 — account number + bank select */}
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Community Bank Account Number
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={accNumber}
                  onChange={(e) => {
                    setAccNumber(e.target.value.replace(/\D/g, ""));
                    setAccName("");
                  }}
                  placeholder="0457359705"
                  className={inputCls + " flex-1"}
                />
                <div className="flex-1">
                  <BankSelect
                    banks={banks}
                    value={bankCode}
                    onChange={(bank) => {
                      setBankCode(bank.code);
                      setBankName(bank.name);
                      setBankSlug(bank.slug ?? "");
                      setAccName("");
                      setManualMode(false);
                      setResolveError("");
                    }}
                    placeholder="Select bank"
                    triggerClassName={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Row 2 — resolved account name (editable when auto-resolve fails) */}
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">Account Name</label>
              <div className="relative">
                <input
                  type="text"
                  readOnly={!manualMode}
                  value={resolving ? "Verifying account…" : accName}
                  onChange={(e) => manualMode && setAccName(e.target.value)}
                  placeholder={manualMode ? "Type account name" : ""}
                  className={
                    inputCls +
                    (manualMode ? "" : " cursor-default select-none") +
                    (resolving ? " !text-ink-ghost" : " !text-ink")
                  }
                />
                {accName && !resolving && !manualMode && (
                  <Check
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
                  />
                )}
              </div>
            </div>

            {resolveError && (
              <p className={`text-xs ${manualMode ? "text-warning" : "text-danger"}`}>
                {resolveError}
              </p>
            )}
          </div>

          {/* Save error — shown when the API call itself fails (e.g. backend 502) */}
          {saveError && <p className="text-xs text-red-600 mt-4">{saveError}</p>}

          {/* Footer */}
          <div className="flex justify-end mt-4">
            <Button
              onClick={handleSave}
              disabled={resolving || !accName.trim()}
              loading={isSaving}
              fullWidth={false}
              className="px-6"
            >
              {isSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
