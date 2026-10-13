import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { X, Loader2, ArrowLeft, Clock } from "lucide-react";
import { verifyPayment } from "../../api/members";
import { beginAuthGrace } from "../../api/client";
import {
  settleLocalPaymentForReference,
  peekPendingPaymentCtx,
  findAuthorisationForPlan,
  fetchAuthorisationsOnce,
} from "../../hooks/usePayments";
import { useAuth } from "../../store/AuthContext";
import { usePageTitle } from "../../hooks/usePageTitle";
import LoadingScreen from "../../components/LoadingScreen";
import { Button } from "../../components/ui/Button";
import MemberPaymentConfirm from "../memberApp/PaymentSuccess";
import SuccessBadge from "../../components/common/SuccessBadge";
import { isVerificationSuccessStatus, isFailedStatus } from "../../utils/paymentStatus";

// The backend's verify endpoint is async: it queues a verification job and
// returns the current DB status (often still "INITIATED"). The job updates the
// record later. We poll for up to ~60s and track whether the backend ever
// returned verificationQueued=true — if it did, the money moved even if we
// never see the terminal status written back in time.
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 20;

function isTerminal(status) {
  return isVerificationSuccessStatus(status) || isFailedStatus(status);
}

// Paystack's own callback_url points here for every payment, admin and
// member alike — this used to be a single component that awkwardly tried to
// serve both with a desktop-first card and a bolted-on mobile branch for
// just the success state. The member app already has a proper, full mobile
// design covering every state (PaymentSuccess.jsx, reused at
// /member/pay/:id/success for the direct-charge case) — delegate to it here
// too instead of maintaining a second, worse copy. This component now only
// owns the admin/desktop presentation.
export default function PaymentCallback() {
  usePageTitle("Payment Confirmation");
  const { isAdmin, loading } = useAuth();

  // isAdmin defaults to false until AuthContext finishes restoring the
  // session from localStorage (see AuthContext.jsx's `loading`) -- branching
  // before that resolved would mount the member confirmation screen for an
  // admin's payment on every fresh page load (this route is always a fresh
  // load: Paystack's redirect back is a real browser navigation, not SPA
  // routing), then tear it down and remount the admin one a moment later
  // once isAdmin catches up, restarting verification mid-flight right at the
  // most fragile moment of the whole flow.
  if (loading) return <LoadingScreen />;
  return isAdmin ? <AdminPaymentCallback /> : <MemberPaymentConfirm />;
}

function AdminPaymentCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");

  // Read (but don't consume yet) the return destination. paymentReturnTo and
  // paymentPendingRef are only cleared once verification reaches a terminal
  // state — if the session expired mid-payment, they must survive the trip
  // through sign-in so the dashboard can auto-confirm the payment afterwards.
  const [returnTo] = useState(() => sessionStorage.getItem("paymentReturnTo") ?? null);
  const effectiveReturnTo = returnTo ?? "/dashboard/admin";

  // "checking" | "success" | "failed" | "processing" | "unknown" | "signin"
  const [state, setState] = useState(reference ? "checking" : "unknown");
  const [autoRedirectIn, setAutoRedirectIn] = useState(null);
  const attemptsRef = useRef(0);
  const wasQueuedRef = useRef(false);

  const invalidateCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["obligations"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    queryClient.invalidateQueries({ queryKey: ["authorisations"] });
    queryClient.invalidateQueries({ queryKey: ["community"] });
  }, [queryClient]);

  // Same reasoning as PaymentSuccess.jsx's mount-time grace window: landing
  // here at all means a real Paystack redirect just happened, so the token
  // can be stale for a beat no matter how the admin leaves this page. Only
  // opening the grace window inside this page's own button handlers misses
  // the native browser/OS back button and swipe-back gestures -- React
  // Router still navigates to the previous route for those, and that
  // route's first data fetch can hit the stale token with no grace window
  // open, reading as an unexpected hard sign-out instead of a normal beat
  // of latency.
  useEffect(() => {
    beginAuthGrace();
  }, []);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;

    // Terminal states own the cleanup of the pending-payment flags; anything
    // earlier (including a session-expiry bounce) must leave them intact so
    // the dashboard's pending-ref check can finish the job after sign-in.
    function consumePendingFlags() {
      // Tombstone the pending reference before removing it. The pending-ref hook
      // on Home consumes that key up front, so by the time this page reaches a
      // terminal state the reference is already gone — the tombstone has to be
      // written unconditionally, from this page's own reference, or the hook's
      // failure path cannot tell "already settled here" from "verification
      // failed" and would resurrect it into a duplicate confirmation toast.
      sessionStorage.setItem("paymentPendingRef_terminal", reference);
      sessionStorage.removeItem("paymentReturnTo");
      sessionStorage.removeItem("paymentPendingRef");
    }

    // Mirrors PaymentSuccess.jsx's goHome() handoff, but for the
    // redirect-based (Paystack-hosted) admin payment path -- the modal that
    // knew the plan context is long gone by the time this page confirms the
    // payment, so that context travels via stashPendingPaymentCtx instead
    // (see AdminPaymentModal.handlePay). Must peek it before
    // settleLocalPaymentForReference consumes the same sessionStorage key.
    // Fetches authorisations fresh (not the stale pre-payment list) since a
    // consent this payment just created needs to actually show up here, or
    // a payer who *did* choose to save would get asked again for nothing.
    async function maybeOfferAutoPay(ref) {
      const ctx = peekPendingPaymentCtx();
      if (!ctx || !ctx.isRecurring || !ctx.paymentLinkId) return;
      if (ctx.reference && ctx.reference !== ref) return;
      try {
        if (localStorage.getItem(`glass_autopay_asked_${ctx.paymentLinkId}`)) return;
      } catch {
        return;
      }
      const authorisations = await fetchAuthorisationsOnce({
        _skipAuthRedirect: true,
      });
      const hasConsent = !!findAuthorisationForPlan(authorisations, {
        paymentLinkId: ctx.paymentLinkId,
      });
      if (hasConsent) return;
      try {
        sessionStorage.setItem(
          "glass_autopay_prompt_admin",
          JSON.stringify({
            paymentLinkId: ctx.paymentLinkId,
            planName: ctx.planName,
            amount: ctx.amount,
            frequency: ctx.frequency,
          }),
        );
      } catch {
        /* ignore */
      }
    }

    async function poll() {
      try {
        const res = await verifyPayment(reference, { _skipAuthRedirect: true });
        const data = res.data?.data ?? {};
        const { status, verificationQueued } = data;

        if (verificationQueued) wasQueuedRef.current = true;

        if (cancelled) return;

        if (isTerminal(status)) {
          const finalState = isVerificationSuccessStatus(status) ? "success" : "failed";
          invalidateCaches();
          if (finalState === "success") {
            await maybeOfferAutoPay(reference);
            settleLocalPaymentForReference(reference);
            setAutoRedirectIn(5);
          }
          consumePendingFlags();
          setState(finalState);
          return;
        }
      } catch (err) {
        // Session died while the payer was on Paystack's page — show a
        // sign-in prompt instead of silently retrying into a hard redirect.
        // The pending flags stay put so the payment auto-confirms after
        // re-login.
        if (err?.response?.status === 401 && !cancelled) {
          setState("signin");
          return;
        }
        // Other network / 4xx — count as attempt and retry
      }

      attemptsRef.current += 1;
      if (cancelled) return;

      if (attemptsRef.current >= MAX_POLLS) {
        // Timed out. If the backend queued verification at any point, the charge
        // went through — the status write is just slow. Invalidate so the user
        // sees fresh data when they navigate back.
        invalidateCaches();
        consumePendingFlags();
        setState(wasQueuedRef.current ? "processing" : "unknown");
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [reference, invalidateCaches]);

  // Auto-redirect countdown after confirmed success. beginAuthGrace: the
  // destination's own first data fetches can hit a stale-token 401 right
  // after a real Paystack redirect -- same reasoning as PaymentSuccess.jsx's
  // goTo() -- so this shouldn't read as an unexpected sign-out.
  useEffect(() => {
    if (autoRedirectIn === null) return;
    if (autoRedirectIn <= 0) {
      beginAuthGrace();
      navigate(effectiveReturnTo, { replace: true });
      return;
    }
    const t = setTimeout(() => setAutoRedirectIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [autoRedirectIn, navigate, effectiveReturnTo]);

  const backLabel = "Back to Dashboard";

  // Two-layer soft-tint-outer / solid-inner circle for every non-success
  // state -- "success" itself now uses the shared success badge
  // illustration (see the render below) instead of icon/outerBgCls/
  // innerBgCls, which is why those are absent from its entry here.
  const config = {
    checking: {
      icon: <Loader2 size={28} className="animate-spin" color="var(--color-white)" />,
      outerBgCls: "bg-brand-tint",
      innerBgCls: "bg-brand",
      title: "Confirming payment…",
      subtitle: "Please wait while we verify your transaction.",
      buttonLabel: null,
    },
    success: {
      title: "Payment Successful",
      subtitle:
        autoRedirectIn != null
          ? `Redirecting you in ${autoRedirectIn}s…`
          : "Your payment has been confirmed.",
      buttonLabel: backLabel,
    },
    failed: {
      icon: <X size={28} strokeWidth={3} color="var(--color-white)" />,
      outerBgCls: "bg-danger-tint",
      innerBgCls: "bg-danger",
      title: "Payment Failed",
      subtitle: "Something went wrong with this payment. Please try again.",
      buttonLabel: backLabel,
    },
    processing: {
      icon: <Clock size={28} color="var(--color-white)" />,
      outerBgCls: "bg-brand-tint",
      innerBgCls: "bg-brand",
      title: "Payment Processing",
      subtitle:
        "Your payment went through but status confirmation is taking a moment. You'll receive a notification when it's ready — usually within a few minutes.",
      buttonLabel: backLabel,
    },
    unknown: {
      icon: <Loader2 size={28} strokeWidth={2} color="var(--color-white)" />,
      outerBgCls: "bg-stacked-container",
      innerBgCls: "bg-ink-faint",
      title: "Still confirming…",
      subtitle: "We couldn't confirm the outcome yet. Check your Transactions tab in a moment.",
      buttonLabel: backLabel,
    },
    signin: {
      icon: <Clock size={28} color="var(--color-white)" />,
      outerBgCls: "bg-brand-tint",
      innerBgCls: "bg-brand",
      title: "Sign in to see your payment",
      subtitle:
        "Your session expired while you were completing the payment. Sign back in — your payment will be confirmed on your dashboard automatically.",
      buttonLabel: "Sign in to continue",
    },
  }[state];

  const buttonDest = state === "signin" ? "/sign-in" : effectiveReturnTo;

  return (
    <div className="min-h-screen flex flex-col bg-cover bg-center bg-no-repeat bg-admin-default">
      {/* Top bar */}
      <div className="flex items-center px-4 md:px-8 pt-6 md:pt-8 pb-4">
        <Button
          variant="tertiary"
          size="sm"
          fullWidth={false}
          onClick={() => {
            // Leaving voluntarily — the return target is used up, but the
            // pending reference stays so the destination page can still
            // confirm the payment in the background.
            sessionStorage.removeItem("paymentReturnTo");
            beginAuthGrace();
            navigate(effectiveReturnTo, { replace: true });
          }}
        >
          <ArrowLeft size={16} />
          {backLabel}
        </Button>
      </div>

      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full bg-surface-container border border-surface-container-border rounded-2xl flex flex-col items-center px-6 md:px-10 py-10 md:py-14 text-center max-w-[560px]">
          {state === "success" ? (
            <SuccessBadge message={config.title} subMessage={config.subtitle} className="mb-2" />
          ) : (
            <>
              <div
                className={`w-[110px] h-[110px] rounded-full flex items-center justify-center mb-6 flex-shrink-0 ${config.outerBgCls}`}
              >
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${config.innerBgCls}`}
                >
                  {config.icon}
                </div>
              </div>

              <h1 className="text-headline text-gray-900 mb-2">{config.title}</h1>
              <p className="text-title-sm text-gray-500 leading-relaxed mb-2">{config.subtitle}</p>
            </>
          )}

          {reference && state !== "checking" && (
            <p className="text-xs text-gray-400 mt-1 mb-6 font-mono break-all">Ref: {reference}</p>
          )}

          {config.buttonLabel && (
            <Button
              onClick={() => {
                beginAuthGrace();
                navigate(buttonDest, { replace: true });
              }}
              fullWidth={false}
              className="mt-4 px-8"
            >
              {config.buttonLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
