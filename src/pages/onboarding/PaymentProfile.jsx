/**
 * PaymentProfile.jsx — wired to API
 *
 * Flow:
 *   1. User enters account number + selects bank
 *   2. Resolve account → GET /api/v1/finance/resolve-account?bankCode=&accountNumber=
 *      → shows account name for confirmation
 *   3. Save → POST /api/v1/communities/{communityId}/account
 *      { settlementBank, settlementBankCode, accountNumber }
 *   4. Show success modal, then navigate to AddMembers with communityId/slug in state
 *
 * Banks list → GET /api/v1/finance/banks (fetched on mount)
 */
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Check, ArrowLeft } from "lucide-react";
import CloudImage from "../../components/common/CloudImage";
import SuccessBadge from "../../components/common/SuccessBadge";
import { getBanks, resolveAccount } from "../../api/members";
import { notifyError, getErrorMessage } from "../../utils/errorHandler";
import { useCommunityAccount } from "../../hooks/useCommunityAccount";
import { saveOnboardingProgress, readOnboardingProgress } from "../../utils/onboardingProgress";
import BankSelect from "../../components/common/BankSelect";
import StepIndicator from "../../components/onboarding/StepIndicator";
import OnboardingStepsSidebar from "../../components/onboarding/OnboardingStepsSidebar";
import { useAuth } from "../../store/AuthContext";
import { Button } from "../../components/ui/Button";

const COMPLETED_STEP_IDS = ["choose-path", "paying-member", "organization"];

const inputCls =
  "w-full h-12 min-h-8 border-[1.5px] border-gray-200 px-4 py-1 rounded-lg text-placeholder text-gray-800 placeholder-gray-400 outline-none focus:border-brand transition-all";

function SuccessModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-[rgba(20,20,30,0.45)]">
      <div className="w-full lg:w-auto lg:min-w-[480px] bg-white rounded-t-[24px] lg:rounded-2xl px-8 py-10 lg:px-12 lg:py-16 flex flex-col items-center shadow-2xl">
        <SuccessBadge message="Your Payment Account Is Now Set!" />
        <div className="h-[env(safe-area-inset-bottom,0px)] lg:hidden" />
      </div>
    </div>
  );
}

export default function PaymentProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Falls back to whatever OrganizationProfile persisted right after
  // creating this community -- location.state alone doesn't survive a
  // reload or a forced re-login, and by this point the community already
  // exists on the backend, so losing this link strands it with no way
  // back short of re-doing everything from scratch.
  const savedProgress = readOnboardingProgress();
  const { email, isPaying, communityId, communitySlug, communityName } =
    location.state ?? savedProgress;
  const {
    create: saveAccount,
    update: updateAccount,
    account: existingAccount,
  } = useCommunityAccount(communityId);

  const [banks, setBanks] = useState([]);
  // Restores whatever was typed here before a reload/forced re-login wiped
  // React state -- the existingAccount prefill effect below still wins once
  // it loads, since it unconditionally overwrites these once the backend
  // confirms an actually-saved account.
  const [bankCode, setBankCode] = useState(savedProgress.bankCode ?? "");
  const [bankName, setBankName] = useState(savedProgress.bankName ?? "");
  const [bankSlug, setBankSlug] = useState(savedProgress.bankSlug ?? "");
  const [accNumber, setAccNumber] = useState(savedProgress.accNumber ?? "");
  const [accName, setAccName] = useState(savedProgress.accName ?? "");
  const [resolving, setResolving] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [accNumberTouched, setAccNumberTouched] = useState(false);

  // Only worth flagging once the field's been left, not while still typing —
  // a 10-digit account number is the norm but nothing else here validates
  // length as the user goes, so a shorter one just silently never resolves
  // with no feedback at all otherwise.
  const accNumberIncomplete = accNumberTouched && accNumber.length > 0 && accNumber.length < 10;

  // Fetch banks on mount
  useEffect(() => {
    getBanks()
      .then(({ data }) => {
        if (!data.success) return;
        // The bank list has been observed to contain duplicate codes —
        // dedupe so React's key={b.code} stays unique.
        const seen = new Set();
        const unique = (data.data ?? []).filter((b) => {
          if (seen.has(b.code)) return false;
          seen.add(b.code);
          return true;
        });
        setBanks(unique);
      })
      .catch((err) =>
        notifyError(err, {
          context: "Load banks",
          fallback: "Couldn't load the bank list. Please refresh.",
        }),
      );
  }, []);

  // Persist as the admin types, so a dropped session before Save loses at
  // most the last few keystrokes instead of the whole step (mirrors
  // OrganizationProfile.jsx's same pattern for its own fields).
  useEffect(() => {
    saveOnboardingProgress({ bankCode, bankName, bankSlug, accNumber, accName });
  }, [bankCode, bankName, bankSlug, accNumber, accName]);

  // Prefill from an already-saved payout account -- e.g. the admin came back
  // here via AddMembers' Back button after already completing this step.
  // Runs once the account loads; manualMode is set too so the resolve-account
  // effect below doesn't immediately overwrite the restored account name.
  useEffect(() => {
    if (!existingAccount) return;
    // Prefills from the async-loaded existing account -- every field here
    // stays user-editable afterward, so this has to be an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBankCode(existingAccount.settlementBankCode ?? "");
    setBankName(existingAccount.settlementBank ?? "");
    setBankSlug(existingAccount.settlementBankSlug ?? "");
    setAccNumber(existingAccount.accountNumber ?? "");
    setAccName(existingAccount.accountName ?? "");
    setManualMode(true);
  }, [existingAccount]);

  // Auto-resolve when both bank + 10-digit account are set
  useEffect(() => {
    if (!bankCode || accNumber.length !== 10) {
      // Reset branch of the same resolve-account effect below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!manualMode) setAccName("");
      setError("");
      return;
    }
    const timer = setTimeout(async () => {
      setResolving(true);
      setError("");
      try {
        const { data } = await resolveAccount(bankCode, accNumber);
        const name =
          data?.data?.accountName ??
          data?.accountName ??
          (data?.success === false ? null : (data?.name ?? null));
        if (name) {
          setAccName(name);
          setManualMode(false);
        } else {
          setError("Couldn't auto-verify this account. Enter the account name manually below.");
          setManualMode(true);
        }
      } catch (err) {
        const message = getErrorMessage(err, "Couldn't auto-verify this account");
        setError(`${message} Enter the account name manually below.`);
        setManualMode(true);
      } finally {
        setResolving(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [bankCode, accNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve-account can be down for reasons that have nothing to do with
  // what the admin types (backend/Paystack connectivity, bad keys, etc.),
  // and there's no skip on this step otherwise — so onboarding would be a
  // hard dead end. The account can still be set up later from
  // Settings → Finance → Paystack Account.
  const handleSkip = () => {
    navigate("/onboarding/members", {
      state: { email, communityId, communitySlug, communityName },
    });
  };

  // Same escape hatch as OrganizationProfile.jsx's own handleBack: an
  // already-authenticated user goes straight to their dashboard instead of
  // stepping back into the middle of onboarding.
  const handleBack = () => {
    if (isAuthenticated) {
      navigate("/dashboard/home");
      return;
    }
    navigate("/onboarding/organization-profile", {
      state: { email, isPaying, communityId, communitySlug, communityName },
    });
  };

  const handleSave = async () => {
    if (!accName.trim()) {
      setError("Account name is required.");
      return;
    }
    if (!communityId) {
      setError("Community ID missing — go back and retry.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        settlementBank: bankName,
        settlementBankCode: bankCode,
        settlementBankSlug: bankSlug,
        accountNumber: accNumber,
        accountName: accName.trim(),
      };
      // Update the account already saved for this community (e.g. a revisit
      // via AddMembers' Back button) instead of creating a second one.
      if (existingAccount) {
        await updateAccount.mutateAsync({ accountId: existingAccount.id, payload });
      } else {
        await saveAccount.mutateAsync(payload);
      }
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/onboarding/members", {
          state: { email, communityId, communitySlug, communityName },
        });
      }, 1600);
    } catch (err) {
      // Not notifyError here -- the global mutationCache onError (main.jsx)
      // already toasts this since these mutations are shared with
      // PaystackAccount.jsx, which relies on that toast being the only one.
      // Toasting again here would double it up for this caller.
      setError(getErrorMessage(err, "Couldn't save your payment account. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen lg:overflow-hidden lg:h-screen bg-contain bg-center lg:bg-page-default">
      <div className="fixed inset-0 lg:hidden -z-10 bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />

      {showSuccess && <SuccessModal />}

      <header className="relative flex items-center justify-between px-4 lg:px-8 py-4 bg-surface-container border-b border-outline-on-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <CloudImage
            publicId="glass/Glass"
            alt="Glass"
            width={56}
            objectFit="contain"
            className="w-7 h-7"
          />
          <span className="font-medium text-base text-gray-900">Glass</span>
        </div>
        <div className="flex items-center gap-4">
          <Bell size={20} className="text-gray-400 hidden lg:block" />
          <p className="text-sm text-gray-600 truncate max-w-[160px] lg:max-w-none">{email}</p>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Mobile step pill — replaces the sidebar stepper below lg */}
        <div className="lg:hidden px-4 pt-5">
          <StepIndicator stepId="payment" />
        </div>

        {/* Sidebar */}
        <OnboardingStepsSidebar activeStepId="payment" completedStepIds={COMPLETED_STEP_IDS} />

        {/* Main */}
        <main className="flex-1 lg:overflow-y-auto py-6 px-4 lg:py-10 lg:px-12">
          <div className="w-full max-w-3xl">
            <div className="bg-white rounded-lg px-5 py-6 lg:px-8 lg:py-7 border border-hairline-neutral">
              <div className="mb-6 pb-5 border-b border-hairline-neutral">
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  fullWidth={false}
                  onClick={handleBack}
                  className="mb-4 -ml-1"
                >
                  <ArrowLeft size={15} />
                  {isAuthenticated ? "Back to dashboard" : "Back"}
                </Button>
                <h2 className="text-lg font-medium text-gray-900 mb-1">
                  Set up your payment Account
                </h2>
                <p className="text-sm text-gray-500">
                  This is where Glass will collect and manage dues on behalf of your community.
                </p>
              </div>

              {/* Account number + bank */}
              <div className="mb-5">
                <label className="text-sm text-gray-700 block mb-1.5">
                  Community Bank Account Number
                </label>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <input
                    type="text"
                    maxLength={10}
                    value={accNumber}
                    onChange={(e) => {
                      setAccNumber(e.target.value.replace(/\D/g, ""));
                      setAccName("");
                    }}
                    onFocus={() => setAccNumberTouched(false)}
                    onBlur={() => setAccNumberTouched(true)}
                    placeholder="Enter Account Number"
                    className={inputCls}
                    style={accNumberIncomplete ? { borderColor: "var(--color-danger)" } : undefined}
                  />
                  <BankSelect
                    banks={banks}
                    value={bankCode}
                    onChange={(bank) => {
                      setBankCode(bank.code);
                      setBankName(bank.name);
                      setBankSlug(bank.slug ?? "");
                      setAccName("");
                      setManualMode(false);
                      setError("");
                    }}
                    placeholder="Choose Bank"
                    triggerClassName={inputCls}
                  />
                </div>
                {accNumberIncomplete && (
                  <p className="text-xs text-danger mt-1.5">Account number must be 10 digits.</p>
                )}
              </div>

              {/* Resolved account name */}
              <div className="mb-2">
                <label className="text-sm text-gray-700 block mb-1.5">Account Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={resolving ? "Verifying…" : accName}
                    readOnly={!manualMode}
                    onChange={(e) => manualMode && setAccName(e.target.value)}
                    placeholder={manualMode ? "Type account name" : "Account name will appear here"}
                    className={
                      inputCls +
                      (!manualMode ? " bg-gray-50 cursor-default select-none" : "") +
                      (resolving ? " text-ink-faint" : "")
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

              {error && (
                <p
                  className={`text-sm mt-3 ${manualMode ? "text-warning" : "text-danger-bright-2"}`}
                >
                  {error}
                </p>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={resolving || !accName.trim()}
              loading={saving}
              className="lg:w-1/2 mx-auto block mt-6"
            >
              {saving ? "Setting up…" : "Set-Up Account"}
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              fullWidth={false}
              onClick={handleSkip}
              disabled={saving}
              className="mt-3"
            >
              Skip for now — set this up later
            </Button>
            <div className="h-[env(safe-area-inset-bottom,20px)] lg:hidden" />
          </div>
        </main>
      </div>
    </div>
  );
}
