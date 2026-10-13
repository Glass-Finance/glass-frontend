import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { verifyPayment } from "../../api/members";
import { toastSuccess } from "../../utils/toast";
import { settleLocalPaymentForReference } from "./localCache";
import { isVerificationSuccessStatus } from "../../utils/paymentStatus";

// Set by the terminal consumers of "paymentPendingRef" (PaymentCallback,
// PaymentSuccess, SignIn) before they remove it, so this hook's failure path
// can tell "the payment was already settled" from "verification just failed".
const TERMINAL_TOMBSTONE_KEY = "paymentPendingRef_terminal";

// ─────────────────────────────────────────────────────────────────────────────
// Pending payment verification — covers payers who never reach the callback
// page (back button, closed the Paystack tab). The pending reference stored
// before the redirect is verified once on mount so a completed payment shows
// as Paid immediately instead of waiting for the next background refetch.
// ─────────────────────────────────────────────────────────────────────────────
export function usePendingPaymentVerification() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const reference = sessionStorage.getItem("paymentPendingRef");
    if (!reference) return;
    // Remove up front — one verification attempt per stored reference is
    // enough; the callback page and background refetches cover the rest.
    sessionStorage.removeItem("paymentPendingRef");

    verifyPayment(reference)
      .then((res) => {
        const status = (res.data?.data?.status ?? "").toUpperCase();
        queryClient.invalidateQueries({ queryKey: ["obligations"] });
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["payment-links"] });
        queryClient.invalidateQueries({ queryKey: ["authorisations"] });
        queryClient.invalidateQueries({ queryKey: ["community"] });
        if (isVerificationSuccessStatus(status)) {
          settleLocalPaymentForReference(reference);
          toastSuccess("Payment confirmed", { reference });
        }
      })
      .catch(() => {
        // Put the reference back. This hook exists precisely to recover payers
        // who never reached the callback page, and a rejected verification
        // (flaky mobile network, a 5xx, an aborted request) says nothing about
        // whether the money left at the provider — the charge may well have
        // gone through. Consuming the key up front made one transient failure
        // lose the recovery permanently, because nothing else ever reads it
        // again: the payer saw the obligation as Due and paid a second time.
        // Restoring it keeps recovery possible on the next mount. Still
        // attempt-once per mount — this effect does not loop.
        //
        // Guarded by a terminal tombstone. This hook consumes the reference up
        // front, but three terminal components consume it independently —
        // PaymentCallback and PaymentSuccess (both via consumePendingFlags,
        // once verification reaches a terminal state) and SignIn, which clears
        // it at the auth boundary and routes to the callback to finish. None of
        // them can see that this hook already took it, and a terminal component
        // can therefore consume it while our request is still in flight. Writing
        // it back unconditionally resurrected a reference that had already been
        // settled, so the next Home mount re-verified a completed payment and
        // fired a duplicate "Payment confirmed" toast. Those components now
        // leave this tombstone behind, and this catch only restores when it is
        // absent. Reads and writes are confined to this tab's own sessionStorage
        // entry, so cross-tab sign-in is unaffected.
        if (sessionStorage.getItem(TERMINAL_TOMBSTONE_KEY) === reference) return;
        try {
          sessionStorage.setItem("paymentPendingRef", reference);
        } catch {
          /* ignore */
        }
      });
  }, [queryClient]);
}
