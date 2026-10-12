import { useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Loader2, Info } from "lucide-react";
import { getObligation, getPaymentLink } from "../../api/members";
import {
  useManagePayments,
  useInitiatePayment,
  recordLocalPayment,
  recordLocalFee,
  stashPendingPaymentCtx,
  findAuthorisationForPlan,
} from "../../hooks/usePayments";
import { getErrorMessage } from "../../utils/errorHandler";
import PageLoadingState from "../../components/common/PageLoadingState";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import Toggle from "../../components/common/Toggle";
import { Button } from "../../components/ui/Button";
import { toastSuccess } from "../../utils/toast";
import { scheduleCopy, estimateNextCharge } from "../../utils/recurring";
import { toTitleCase, formatNaira as fmt, formatDate } from "../../utils/format";
import { paymentsDisabled } from "../../lib/flags";
import { MobileBackButton } from "../../components/ui/MobileBackButton";

function useObligation(obligationId) {
  return useQuery({
    queryKey: ["obligation", obligationId],
    queryFn: async () => {
      const res = await getObligation(obligationId);
      return res.data?.data ?? res.data;
    },
    enabled: !!obligationId,
  });
}

function usePaymentLinkData(linkId) {
  return useQuery({
    queryKey: ["payment-link", linkId],
    queryFn: async () => {
      const res = await getPaymentLink(linkId);
      // GET /payment-links/{id} wraps the link as { paymentLink, obligations }
      const data = res.data?.data;
      return data?.paymentLink ?? data ?? res.data;
    },
    enabled: !!linkId,
  });
}

// Normalize a payment link into the same shape the component renders.
function normalizeLinkToObligation(link) {
  if (!link) return null;
  return {
    id: undefined,
    amount: link.amount,
    community: link.community,
    recurringPlan: link.recurringPlan ?? null,
    paymentLink: {
      id: link.id,
      title: link.title ?? link.name,
    },
  };
}

// ─── Saved-method icon ────────────────────────────────────────────────────────
function MethodIcon() {
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-wash">
      <Landmark size={16} className="text-brand-deep" />
    </div>
  );
}

// ─── Payment Summary screen ───────────────────────────────────────────────────
export default function PaymentSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { paymentId } = useParams();
  const [searchParams] = useSearchParams();
  const viaLink = searchParams.get("via") === "link";
  const [error, setError] = useState("");

  const {
    data: obligationData,
    isLoading: obligationLoading,
    error: obligationError,
  } = useObligation(!viaLink ? paymentId : null);
  const {
    data: linkRaw,
    isLoading: linkLoading,
    error: linkError,
  } = usePaymentLinkData(viaLink ? paymentId : null);

  const obligation = viaLink ? normalizeLinkToObligation(linkRaw) : obligationData;
  const isLoading = viaLink ? linkLoading : obligationLoading;
  // Distinct from `error` (the payment-initiation error below) -- this one
  // means the payment itself couldn't be found/loaded, not that paying it
  // failed. Previously silent: the button would just stay disabled with no
  // indication why, indistinguishable from a slow network.
  const loadError = viaLink ? linkError : obligationError;

  const { data: authorisations } = useManagePayments();
  const initiatePayment = useInitiatePayment();

  // Stable idempotency key for this payment session — reused across a retry
  // after a failed attempt so the backend treats them as the same intent,
  // not a second charge.
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  // Separate from initiatePayment.isPending: the mutation resolves as soon
  // as the API responds with an authorizationUrl, but window.location.href
  // still takes a beat to actually leave the page. Without this, the button
  // flashes back to "Make Payment" during that gap.
  const [redirecting, setRedirecting] = useState(false);

  // Deliberately no pre-fetch here. initiatePayment is the real charge
  // endpoint (POST /payments/pay/payment-links/{id}) -- for a payer with an
  // existing saved/authorised method it charges immediately with no
  // redirect, so calling it before the member has actually pressed
  // "Make Payment" would charge them without ever asking. The billed-amount
  // (fee) breakdown below is only shown once it's known, i.e. after the
  // real charge -- see handlePay.

  // Fall back to whatever Home/UpcomingPayments already knew about this
  // community — the fresh obligation/payment-link fetch above isn't
  // guaranteed to carry it back (see handlePay in those two pages).
  const navState = location.state ?? {};
  const communityName = obligation?.community?.name ?? navState.communityName ?? "Community";
  const communityInitials = communityName.slice(0, 2).toUpperCase();
  const communityLogo = obligation?.community?.logo ?? navState.communityLogo;
  const isRecurring = !!obligation?.recurringPlan;
  // Confirmed with backend: a consent is scoped per recurring plan -- the
  // card saved on a plan's first payment is what auto-charges that plan
  // going forward, so "any ACTIVE authorisation" isn't necessarily the one
  // that will actually be charged here if the payer has other recurring
  // plans on other saved cards. Must match this specific payment link.
  const savedMethod = findAuthorisationForPlan(authorisations, {
    paymentLinkId: obligation?.paymentLink?.id,
    title: obligation?.paymentLink?.title,
    communityName: obligation?.community?.name,
  });
  // Confirmed with backend: savePaymentMethod is optional at the API level
  // for every payment, recurring or not -- forcing it on here (an earlier
  // frontend-only choice) silently enrolled every recurring payer in
  // Auto-Pay with no real way to decline, since the consent is created the
  // instant the payment succeeds and can't be selectively revoked
  // afterward (only by deleting the whole saved card). Defaults to on for
  // a recurring plan since that's the point of Auto-Pay, but it's a real,
  // changeable choice now, same as a one-time plan already had.
  const [saveMethod, setSaveMethod] = useState(true);
  const effectiveSaveMethod = saveMethod;
  // The backend surfaces this as a plain rejection message on submit, with
  // no separate status field to check up front -- detected here so the
  // button can be permanently disabled instead of allowing endless retries.
  const isLinkInactive = /not accepting payments/i.test(error);
  // Build-time kill switch (VITE_FLAGS) -- see src/lib/flags.js and
  // docs/runbooks/incident-rollback.md. Blocks initiating new payments
  // without shipping code; backend must separately stop in-flight charges.
  const killSwitch = paymentsDisabled();

  async function handlePay() {
    if (killSwitch) {
      setError("Payments are temporarily unavailable. Please try again later.");
      return;
    }
    if (!obligation?.paymentLink?.id) return;
    setError("");

    try {
      const res = await initiatePayment.mutateAsync({
        paymentLinkId: obligation.paymentLink.id,
        payload: {
          idempotencyKey: idempotencyKeyRef.current,
          amount: obligation.amount,
          savePaymentMethod: effectiveSaveMethod,
          ...(obligation.id ? { obligationId: obligation.id } : {}),
        },
      });
      const url = res.data?.data?.authorizationUrl;
      const reference = res.data?.data?.reference;
      // The completed transaction record fetched later often comes back
      // with no fee field populated at all, losing the number the payer
      // already saw here as "Platform Fee" -- billedAmount is confirmed
      // present on this same initiatePayment response, so cache the fee now
      // while it's known rather than let the receipt fall back to a bare "—".
      const billedAmount = res.data?.data?.billedAmount;
      const feeMinor = billedAmount != null ? billedAmount - (obligation?.amount ?? 0) : null;
      if (url) {
        setRedirecting(true);
        sessionStorage.setItem("paymentReturnTo", "/member/home");
        if (reference) sessionStorage.setItem("paymentPendingRef", reference);
        // Lets whichever page confirms the payment afterwards write the
        // local paid log for this exact plan/obligation.
        stashPendingPaymentCtx({
          reference,
          paymentLinkId: obligation.paymentLink.id,
          obligationId: obligation.id ?? null,
          feeMinor,
        });
        window.location.href = url;
      } else {
        // No authorizationUrl means this charged immediately against a
        // saved method rather than redirecting to Paystack's hosted page.
        recordLocalPayment({
          paymentLinkId: obligation.paymentLink.id,
          obligationId: obligation.id,
        });
        if (reference) recordLocalFee(reference, feeMinor);
        toastSuccess("Payment sent", { reference });
        navigate(`/member/pay/${paymentId}/success?reference=${reference}`, { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not start payment. Please try again."));
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <PageLoadingState />
      </div>
    );
  }

  if (loadError || !obligation) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 min-h-screen px-6 text-center">
        <p className="text-sm text-gray-600">
          {getErrorMessage(loadError, "Couldn't load this payment. It may no longer be available.")}
        </p>
        <Button onClick={() => navigate(-1)} fullWidth={false} className="px-4">
          Go back
        </Button>
      </div>
    );
  }

  // Opt-in only -- the Paystack account is live now, so real money is
  // charged unless a deployment explicitly turns this back on for testing
  // against Paystack test keys. Previously opt-out (shown unless a
  // deployment set VITE_TEST_MODE=false), which meant this test-card banner
  // stayed live for anyone whose env didn't set the flag at all.
  const isTestMode = import.meta.env.VITE_TEST_MODE === "true";

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden max-w-[430px] mx-auto">
      <GlassLogoGlow />
      {/* ── Top bar ── */}
      <div className="flex items-center px-4 pt-5 pb-4 relative">
        <MobileBackButton aria-label="Back" onClick={() => navigate(-1)} />
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[16px] font-bold text-gray-900">
          Payment Summary
        </h1>
      </div>

      {/* ── Test mode banner ── */}
      {isTestMode && (
        <div className="mx-4 mb-3 rounded-xl px-4 py-3 bg-warning-wash border-[1.5px] border-[#FCD34D]">
          <p className="text-[12px] font-bold text-amber-800 mb-1.5">
            🧪 Test Mode — No real money is charged
          </p>
          <p className="text-[11px] text-amber-700 mb-2">
            Use the card details below to complete this payment:
          </p>
          <div className="rounded-lg px-3 py-2.5 flex flex-col gap-1 bg-[#FEF3C7]">
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-700">Card number</span>
              <span className="font-mono font-bold text-amber-900 tracking-wide">
                4084 0840 8408 4081
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-700">Expiry</span>
              <span className="font-mono font-bold text-amber-900">01/99</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-700">CVV</span>
              <span className="font-mono font-bold text-amber-900">408</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-700">PIN</span>
              <span className="font-mono font-bold text-amber-900">0000</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-amber-700">OTP</span>
              <span className="font-mono font-bold text-amber-900">123456</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 pt-2">
        {/* ── Card 1: Community + saved method ── */}
        <div className="bg-surface-container rounded-2xl px-4 py-4">
          {/* Community row */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div
              className={`w-11 h-11 flex items-center justify-center flex-shrink-0 ${communityLogo?.url ? "bg-transparent" : "bg-brand-glow"}`}
            >
              {communityLogo?.url ? (
                <img
                  src={communityLogo.url}
                  alt=""
                  decoding="async"
                  className="object-contain w-full h-full"
                />
              ) : (
                <span className="text-[10px] font-bold text-brand-deep">{communityInitials}</span>
              )}
            </div>
            <span className="text-[14px] font-medium text-gray-900">{communityName}</span>
          </div>

          <div className="bg-[#FFFFFF66] rounded-xl px-4 py-3">
            {savedMethod ? (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2.5">
                  <MethodIcon />
                  <span className="text-[14px] font-medium text-gray-900">
                    {toTitleCase(savedMethod.cardType ?? savedMethod.bank ?? "Card")} ●●●
                    {savedMethod.last4}
                    {savedMethod.expMonth && savedMethod.expYear
                      ? ` | ${String(savedMethod.expMonth).padStart(2, "0")}/${String(savedMethod.expYear).slice(-2)}`
                      : ""}
                  </span>
                </div>
                <Button
                  variant="tertiary"
                  size="sm"
                  fullWidth={false}
                  onClick={() => navigate("/member/settings/payments")}
                >
                  Change
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-gray-500 py-1">
                You'll choose how to pay on the next screen.
              </p>
            )}

            {/* Automatic Payment — a real, changeable choice for every plan
                (confirmed with backend: savePaymentMethod is optional at
                the API level regardless of plan type). Defaults to on for
                a recurring plan since that's the point of Auto-Pay, but
                turning it off here means this specific payment won't
                enroll the card -- there's no way to opt out after paying,
                since the consent is created the instant this succeeds. */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
              <span className="flex items-center gap-1.5 text-[12px] text-gray-600">
                Automatic Payment
                <span
                  title={
                    isRecurring
                      ? "Save this card and charge it automatically each cycle. Turn off to pay this cycle only."
                      : "Save this method and reuse it automatically for future payments."
                  }
                >
                  <Info size={12} className="text-gray-400" />
                </span>
              </span>
              <Toggle on={saveMethod} onChange={setSaveMethod} />
            </div>
          </div>
        </div>

        {/* ── Card 2: Plan details ── */}
        <div className="bg-surface-container rounded-2xl px-4 py-4">
          <p className="text-[14px] font-normal text-gray-900 mb-4">Plan Details</p>

          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-gray-500">Plan:</span>
            <span className="text-[14px] text-gray-900">
              {toTitleCase(obligation?.paymentLink?.title) ?? "—"}
            </span>
          </div>

          <div
            className={`flex items-center justify-between ${isRecurring ? "mb-3" : "mb-2.5 pb-3 border-b border-gray-100"}`}
          >
            <span className="text-[13px] text-gray-500">Payment Schedule:</span>
            <span className="text-[12px] font-semibold px-3 py-0.5 rounded-full bg-[#EEF1FB] text-brand-deep">
              {isRecurring
                ? toTitleCase((obligation?.recurringPlan?.frequency ?? "Recurring").toLowerCase())
                : "One-Time"}
            </span>
          </div>

          {isRecurring && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] text-gray-500">Renews:</span>
              <span className="text-[13px] text-gray-900">
                {scheduleCopy(obligation.recurringPlan)}
              </span>
            </div>
          )}

          {isRecurring &&
            (() => {
              const next = estimateNextCharge(obligation.recurringPlan, obligation?.dueDate);
              if (!next) return null;
              return (
                <div className="flex items-center justify-between mb-2.5 pb-3 border-b border-gray-100">
                  <span className="text-[13px] text-gray-500">Next charge (est.):</span>
                  <span className="text-[13px] text-gray-900">{formatDate(next)}</span>
                </div>
              );
            })()}

          {/* The platform fee isn't known until the real charge happens
              (see handlePay) -- no fee breakdown to show ahead of that. */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-gray-500">Total:</span>
            <span className="text-[15px] font-bold text-gray-900">{fmt(obligation?.amount)}</span>
          </div>

          {isRecurring && (
            <p className="text-[12px] text-gray-400 mt-3 pt-3 border-t border-gray-100 leading-relaxed">
              Today you're paying the current cycle. After that, {fmt(obligation?.amount)} renews{" "}
              {scheduleCopy(obligation.recurringPlan).toLowerCase()} until the plan ends or you turn
              off Auto-Pay in Settings.
            </p>
          )}
        </div>

        {error && <p className="text-sm text-danger px-1">{error}</p>}

        {/* ── Make Payment button ──
            A "link is not accepting payments" rejection is a permanent
            backend state, not a transient failure -- retrying hits the same
            wall every time. Without this the button stayed fully enabled
            after that error, inviting an endless retry loop against a link
            that will never succeed. The kill switch is the incident path
            (VITE_FLAGS={"paymentsDisabled":true} + redeploy). */}
        <Button
          onClick={handlePay}
          disabled={!obligation || isLinkInactive || killSwitch}
          loading={initiatePayment.isPending || redirecting}
          className="mt-1"
        >
          {initiatePayment.isPending || redirecting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {redirecting ? "Opening secure payment…" : "Processing…"}
            </>
          ) : killSwitch ? (
            "Payments Temporarily Unavailable"
          ) : isLinkInactive ? (
            "Payment Unavailable"
          ) : (
            "Make Payment"
          )}
        </Button>
      </div>
    </div>
  );
}
