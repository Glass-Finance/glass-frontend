import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Loader2, Clock, Share2 } from "lucide-react";
import { verifyPayment } from "../../api/members";
import { beginAuthGrace } from "../../api/client";
import { settleLocalPaymentForReference, useManagePayments } from "../../hooks/usePayments";
import { useTransactionDetail } from "../../hooks/useTransactionDetail";
import { useAuth } from "../../store/AuthContext";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import ReceiptModal from "../../components/common/ReceiptModal";
import { formatNaira, toTitleCase } from "../../utils/format";
import { Button } from "../../components/ui/Button";
import SuccessBadge from "../../components/common/SuccessBadge";
import { isVerificationSuccessStatus, isFailedStatus } from "../../utils/paymentStatus";
import { MobileBackButton } from "../../components/ui/MobileBackButton";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 20;

function isTerminal(status) {
  return isVerificationSuccessStatus(status);
}

// A FAILED reported at any single poll isn't necessarily final: a transfer
// that's still genuinely pending on Paystack's side can (due to a known
// backend gap) get written as FAILED prematurely, then get corrected to
// SUCCESSFUL moments later once the real webhook lands. Exiting on the
// first FAILED would mean this page just shows a wrong result and never
// finds out it was wrong. Keep polling like any non-terminal status, and
// only settle on "failed" once polling genuinely runs out -- see
// lastStatusRef below.
function isFailed(status) {
  return isFailedStatus(status);
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { paymentId } = useParams();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  // Read but don't consume yet -- paymentReturnTo/paymentPendingRef are only
  // cleared once verification reaches a terminal state. This page is now
  // also the landing target for the real Paystack-hosted redirect (see
  // App.jsx's /payment/callback), where the session can die mid-payment
  // while the payer was away on Paystack's page; clearing early would lose
  // the recovery trail through re-login (see the "signin" state below).
  const [returnTo] = useState(() => sessionStorage.getItem("paymentReturnTo") ?? null);

  // "checking" | "success" | "failed" | "processing" | "unknown"
  const [state, setState] = useState(reference ? "checking" : "unknown");
  const [shareOpen, setShareOpen] = useState(false);
  const attemptsRef = useRef(0);
  const wasQueuedRef = useRef(false);
  const lastStatusRef = useRef(null);
  // GET /finance/transactions/me/{transactionIdentifier} means the
  // internal transaction id, not Paystack's own gateway reference -- every
  // other real usage of this endpoint (Transaction Details, opened from a
  // list row) passes that internal id. This page only ever had the
  // Paystack reference from the redirect URL, which isn't the same value
  // and left the lookup permanently unresolved (Share Receipt stuck
  // disabled forever, not just slow). initiatePayment's confirmed response
  // shape already includes transactionId alongside reference, so
  // verifyPayment's should too -- capture it off the terminal response and
  // prefer it, falling back to reference if it's ever actually absent.
  const [txId, setTxId] = useState(null);

  // Only fetched once verification lands on success -- feeds the "for
  // <plan>" subtext and the Share Receipt button, both of which need real
  // transaction data (amount/plan/community) that this page never fetched
  // before.
  const { data: tx, isLoading: txLoading } = useTransactionDetail(
    state === "success" ? (txId ?? reference) : null,
    { skipAuthRedirect: true },
  );
  const payerName = toTitleCase(
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "",
  );

  // Per the UI designer's spec: on returning to Home after a payment,
  // offer to turn on Auto-Pay when the plan is recurring and the member
  // hasn't already consented to it (covers both "first time paying this
  // plan" and "declined/never set it up before"). There's no API to just
  // flip auto-pay on -- the backend only ever establishes it via a real
  // payment with a fresh authorisation (see AutoPay.jsx's own comment on
  // toggleAutoPay) -- so this only decides whether to prompt at all; the
  // prompt itself (rendered on Home) sends them into the real Auto-Pay
  // settings flow rather than pretending a tap can enable it instantly.
  const { data: authorisations, isLoading: authsLoading } = useManagePayments({
    enabled: state === "success",
    skipAuthRedirect: true,
  });
  const hasAutoPayConsent = (authorisations ?? []).some((auth) =>
    (auth.consents ?? []).some((c) => !c.revoked && c.paymentLinkId === tx?.paymentLinkId),
  );
  // authsLoading guards against a false positive if "Back to Home" is
  // tapped before this fetch (a separate request from the transaction
  // detail one) has actually resolved -- an empty/still-loading list must
  // never be read as "no consent found", or a plan that already has
  // Auto-Pay on would get prompted again.
  const shouldOfferAutoPay = !!(
    tx?.isRecurring &&
    tx?.paymentLinkId &&
    !authsLoading &&
    !hasAutoPayConsent
  );

  const invalidateCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["obligations"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    queryClient.invalidateQueries({ queryKey: ["authorisations"] });
    queryClient.invalidateQueries({ queryKey: ["community"] });
    if (paymentId) {
      queryClient.invalidateQueries({ queryKey: ["obligation", paymentId] });
      queryClient.invalidateQueries({ queryKey: ["payment-link", paymentId] });
    }
  }, [queryClient, paymentId]);

  // Landing here at all means we just came back from a real Paystack
  // redirect -- the access token can be stale for a beat regardless of how
  // the payer eventually leaves this page. Opening the grace window only
  // inside goTo()/goHome() (bound to this page's own buttons) misses the
  // native browser/OS back button and swipe-back gestures: React Router
  // still handles those as a real navigation to the previous route, whose
  // first data fetch can hit the stale token with no grace window open,
  // reading as a hard, unexpected sign-out. Opening it unconditionally on
  // mount covers every exit path, not just the in-app buttons.
  useEffect(() => {
    beginAuthGrace();
  }, []);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;

    function consumePendingFlags() {
      sessionStorage.removeItem("paymentReturnTo");
      sessionStorage.removeItem("paymentPendingRef");
    }

    async function poll() {
      try {
        // _skipAuthRedirect: this page is reachable unauthenticated (the
        // real Paystack callback URL, see App.jsx) -- a dead session should
        // surface as the "signin" state below, not client.js's global hard
        // redirect, which would wipe the pending payment context.
        const res = await verifyPayment(reference, { _skipAuthRedirect: true });
        const data = res.data?.data ?? {};
        const { status, verificationQueued, transactionId } = data;

        if (verificationQueued) wasQueuedRef.current = true;
        lastStatusRef.current = status ?? lastStatusRef.current;

        if (cancelled) return;

        if (isTerminal(status)) {
          invalidateCaches();
          consumePendingFlags();
          settleLocalPaymentForReference(reference, transactionId);
          if (transactionId) setTxId(transactionId);
          setState("success");
          return;
        }
        // FAILED falls through here deliberately -- see isFailed's comment.
        // Keep polling; a later attempt may see it corrected to SUCCESSFUL.
      } catch (err) {
        // Session died while the payer was on Paystack's page -- show a
        // sign-in prompt instead of retrying into a hard redirect. The
        // pending flags stay put so the payment auto-confirms after
        // re-login (see SignIn.jsx's resolveDestination).
        if (err?.response?.status === 401 && !cancelled) {
          setState("signin");
          return;
        }
        // Other network / 4xx — count as attempt and retry
      }

      attemptsRef.current += 1;
      if (cancelled) return;

      if (attemptsRef.current >= MAX_POLLS) {
        invalidateCaches();
        consumePendingFlags();
        setState(
          isFailed(lastStatusRef.current)
            ? "failed"
            : wasQueuedRef.current
              ? "processing"
              : "unknown",
        );
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [reference, invalidateCaches]);

  const dest = returnTo ?? "/member/home";
  const backLabel = returnTo ? "Back to Dashboard" : "Go to Home";

  // Every exit from this page lands on a real protected route (Home,
  // Upcoming, the pay screen again) whose own first data fetches can hit a
  // stale-token 401 right after a real Paystack redirect -- open a brief
  // grace window so that doesn't read as an unexpected sign-out.
  function goTo(path) {
    beginAuthGrace();
    navigate(path, { replace: true });
  }

  // "Back to Home" specifically (not the other exits) hands off the
  // Auto-Pay prompt to Home.jsx via a one-shot sessionStorage flag --
  // asked once per plan (glass_autopay_asked_<id> in localStorage, same
  // "set once" convention as glass_notifications_cleared_at) so it doesn't
  // nag on every future payment for the same plan once answered either way.
  function goHome() {
    if (shouldOfferAutoPay && !localStorage.getItem(`glass_autopay_asked_${tx.paymentLinkId}`)) {
      try {
        sessionStorage.setItem(
          "glass_autopay_prompt",
          JSON.stringify({
            paymentLinkId: tx.paymentLinkId,
            planName: tx.planName ?? tx.description ?? "this plan",
            amount: tx.amount,
            frequency: tx.frequency,
          }),
        );
      } catch {
        /* ignore */
      }
    }
    goTo(dest);
  }

  // Mirrors the dashboard PaymentCallback design language: soft-tinted
  // circle + brand spinner while confirming, solid green on success.
  const content = {
    checking: {
      icon: <Loader2 size={40} className="animate-spin text-brand" />,
      bgCls: "bg-brand-tint",
      text: "Confirming payment…",
      sub: "Please wait while we verify your transaction.",
      action: null,
    },
    success: {
      icon: <Check size={40} color="white" strokeWidth={2.5} />,
      bgCls: "bg-success",
      text: "Transaction Successful",
      sub: tx ? (
        <>
          Your Payment of{" "}
          <strong className="text-gray-700">{formatNaira(tx.amount, { decimals: 2 })}</strong> for{" "}
          <strong className="text-gray-700">{toTitleCase(tx.planName ?? tx.description)}</strong>{" "}
          was successful.
        </>
      ) : (
        "Your payment has been confirmed."
      ),
      action: { label: backLabel, to: dest },
    },
    failed: {
      icon: <X size={40} color="white" strokeWidth={2.5} />,
      bgCls: "bg-danger",
      text: "Payment Failed",
      sub: "Something went wrong with this payment. Please try again.",
      action: {
        label: returnTo ? "Back to Dashboard" : "Try again",
        to: returnTo ?? (paymentId ? `/member/pay/${paymentId}` : "/member/upcoming"),
      },
    },
    processing: {
      icon: <Clock size={40} className="text-brand" />,
      bgCls: "bg-brand-tint",
      text: "Payment Processing",
      sub: "Your payment went through — confirmation is taking a moment. You'll get a notification when it's ready.",
      action: { label: backLabel, to: dest },
    },
    unknown: {
      icon: <Loader2 size={40} className="text-ink-muted" />,
      bgCls: "bg-stacked-container",
      text: "Still confirming…",
      sub: "Check your Transactions tab in a moment.",
      action: { label: backLabel, to: dest },
    },
    signin: {
      icon: <Clock size={40} className="text-brand" />,
      bgCls: "bg-brand-tint",
      text: "Sign in to see your payment",
      sub: "Your session expired while you were completing the payment. Sign back in — your payment will be confirmed automatically.",
      action: { label: "Sign in to continue", to: "/member/app-sign-in" },
    },
  }[state];

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden max-w-[430px] mx-auto">
      <GlassLogoGlow />
      {/* Top bar — the success screen is a deliberate landing page (two
          real choices below, no auto-redirect), not an in-flow step, so it
          drops the back/title bar the other states still use. */}
      {state !== "success" && (
        <div className="flex items-center px-4 pt-10 pb-4 relative">
          <MobileBackButton aria-label="Back" onClick={() => goTo(dest)} />
          <h1 className="absolute left-1/2 -translate-x-1/2 text-title-sm font-medium text-gray-800">
            Payment Summary
          </h1>
        </div>
      )}

      {/* Status */}
      <div
        className={`flex-1 flex flex-col items-center px-8 ${
          state === "success" ? "pt-10 gap-3" : "mt-10 gap-4"
        }`}
      >
        {state === "success" ? (
          <SuccessBadge message={content.text} subMessage={content.sub} />
        ) : (
          <>
            <div
              className={`w-[100px] h-[100px] rounded-full flex items-center justify-center flex-shrink-0 ${content.bgCls}`}
            >
              {content.icon}
            </div>

            <p className="text-headline text-gray-800 mt-1 text-center">{content.text}</p>

            {content.sub && (
              <p className="text-title-sm text-gray-500 text-center -mt-1 max-w-[280px]">
                {content.sub}
              </p>
            )}
          </>
        )}

        {state === "success" ? (
          <div className="flex-1 w-full flex flex-col justify-end gap-3 pb-10 max-w-[340px]">
            <Button onClick={goHome}>Back to Home</Button>
            <Button variant="outline" onClick={() => setShareOpen(true)} disabled={!tx}>
              {txLoading ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
              {txLoading ? "Preparing receipt…" : "Share Receipt"}
            </Button>
          </div>
        ) : (
          content.action && (
            <Button onClick={() => goTo(content.action.to)} fullWidth={false} className="mt-3 px-8">
              {content.action.label}
            </Button>
          )
        )}
      </div>

      {shareOpen && tx && (
        <ReceiptModal
          tx={tx}
          payerName={payerName}
          payerEmail={user?.email}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
