import { useNavigate } from "react-router-dom";
import { Button } from "../../../../components/ui/Button";
import { X, Check, AlertCircle, Clock } from "lucide-react";
import { useKycSummary } from "../../../../hooks/useKyc";
import { isKycApproved } from "../../../../utils/kycStatus";
import { kycDisabled } from "../../../../lib/flags";

// Shown on DashboardContent until a plan, a member, and a usable payout
// account all exist. Step 5 (payout account) has three real states, not
// just done/not-done: submitting the account isn't the same as it being
// usable -- it still needs to clear verification on our side before
// payment plans can actually collect. Identity verification leads because
// it gates community create/manage upstream of everything here — showing
// it completed also tells newer owners why the gate already let them in.
export default function GettingStartedChecklist({
  communityId,
  hasPlans,
  hasMembers,
  hasPayoutAccount,
  payoutAccountRejected,
  payoutAccountPending,
  onDismiss,
  onAddMember,
}) {
  const navigate = useNavigate();
  const { data: kycSummary } = useKycSummary();
  const hideKyc = kycDisabled();
  // Wait for the summary before judging: a loading fetch must not flash a
  // "Verify" call-to-action at someone who is already approved.
  const kycApproved = isKycApproved(kycSummary?.status);

  return (
    <div
      data-tour="getting-started-checklist"
      className="rounded-xl border border-blue-100 bg-[#EEF3FF] p-5 mb-5"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Get your community ready</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Complete these steps to start collecting dues.
          </p>
        </div>
        <Button
          variant="tertiary"
          size="icon-sm"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex-shrink-0 mt-0.5"
        >
          <X size={15} />
        </Button>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Step 1 — identity verification (gates create/manage upstream;
            hidden while the summary loads and when the kill switch is on) */}
        {!hideKyc && kycSummary && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${kycApproved ? "bg-emerald-100" : "bg-white border-2 border-gray-200"}`}
              >
                {kycApproved && <Check size={11} className="text-emerald-600" strokeWidth={2.5} />}
              </span>
              <span
                className={`text-xs ${kycApproved ? "text-gray-400 line-through" : "text-gray-700 font-medium"}`}
              >
                Verify your identity
              </span>
            </div>
            {!kycApproved && (
              <Button
                variant="outline"
                size="xs"
                fullWidth={false}
                onClick={() => window.open("/dashboard/verify-identity", "_blank")}
                className="flex-shrink-0"
              >
                Verify
              </Button>
            )}
          </div>
        )}

        {/* Step 2 — always done (they're here) */}
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Check size={11} className="text-emerald-600" strokeWidth={2.5} />
          </span>
          <span className="text-xs text-gray-400 line-through">Create your community</span>
        </div>

        {/* Step 3 — create a payment plan */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${hasPlans ? "bg-emerald-100" : "bg-white border-2 border-gray-200"}`}
            >
              {hasPlans && <Check size={11} className="text-emerald-600" strokeWidth={2.5} />}
            </span>
            <span
              className={`text-xs ${hasPlans ? "text-gray-400 line-through" : "text-gray-700 font-medium"}`}
            >
              Create a payment plan
            </span>
          </div>
          {!hasPlans && (
            <Button
              variant="outline"
              size="xs"
              fullWidth={false}
              onClick={() => navigate(`/dashboard/payments?community=${communityId ?? ""}`)}
              className="flex-shrink-0"
            >
              Create plan
            </Button>
          )}
        </div>

        {/* Step 4 — add members */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${hasMembers ? "bg-emerald-100" : "bg-white border-2 border-gray-200"}`}
            >
              {hasMembers && <Check size={11} className="text-emerald-600" strokeWidth={2.5} />}
            </span>
            <span
              className={`text-xs ${hasMembers ? "text-gray-400 line-through" : "text-gray-700 font-medium"}`}
            >
              Add your first member
            </span>
          </div>
          {!hasMembers && (
            <Button
              variant="outline"
              size="xs"
              fullWidth={false}
              onClick={onAddMember}
              className="flex-shrink-0"
            >
              Add member
            </Button>
          )}
        </div>

        {/* Step 5 — payout account. Three real states, not just
            done/not-done: submitting the account isn't the same as
            it being usable -- it still needs to clear verification
            on our side before payment plans can actually collect. */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                hasPayoutAccount
                  ? "bg-emerald-100"
                  : payoutAccountRejected
                    ? "bg-red-100"
                    : payoutAccountPending
                      ? "bg-amber-100"
                      : "bg-white border-2 border-gray-200"
              }`}
            >
              {hasPayoutAccount && (
                <Check size={11} className="text-emerald-600" strokeWidth={2.5} />
              )}
              {payoutAccountRejected && (
                <AlertCircle size={11} className="text-red-600" strokeWidth={2.5} />
              )}
              {payoutAccountPending && (
                <Clock size={11} className="text-amber-600" strokeWidth={2.5} />
              )}
            </span>
            <span
              className={`text-xs ${hasPayoutAccount ? "text-gray-400 line-through" : "text-gray-700 font-medium"}`}
            >
              {payoutAccountRejected
                ? "Payout account verification rejected"
                : payoutAccountPending
                  ? "Payout account pending verification"
                  : "Set up your payout account"}
            </span>
          </div>
          {!hasPayoutAccount && (
            <Button
              variant={payoutAccountRejected ? "outline-caution" : "outline"}
              size="xs"
              fullWidth={false}
              onClick={() => navigate("/dashboard/settings/finance/paystack")}
              className="flex-shrink-0"
            >
              {payoutAccountRejected ? "Review" : payoutAccountPending ? "View status" : "Set up"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
