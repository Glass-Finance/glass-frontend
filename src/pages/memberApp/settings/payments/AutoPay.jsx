import { useMemo, useState } from "react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import { useNavigate } from "react-router-dom";
import { goBackInApp } from "../../../../utils/memberBack";
import {} from "lucide-react";
import {
  usePayments,
  useManagePayments,
  isAuthorisationExpired,
} from "../../../../hooks/usePayments";
import PageLoadingState from "../../../../components/common/PageLoadingState";
import Toggle from "../../../../components/common/Toggle";
import ConfirmSheet from "../../../../components/memberApp/ConfirmSheet";
import { formatNaira } from "../../../../utils/format";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

export default function AutoPay() {
  const navigate = useNavigate();
  const { data, isLoading: paymentsLoading } = usePayments();
  const {
    data: authorisations,
    isLoading: authsLoading,
    toggleAutoPay,
    isRemoving,
  } = useManagePayments();
  const [turningOff, setTurningOff] = useState(null); // { plan, auth }

  // Build a flat list of plans: all recurring upcoming obligations, deduped by plan ID
  const recurringPlans = useMemo(() => {
    const seen = new Map();
    for (const o of data?.upcoming ?? []) {
      if (o.type !== "recurring") continue;
      const key = o.paymentLinkId ?? `${o.name}__${o.communityName}`;
      if (!seen.has(key)) seen.set(key, o);
    }
    return [...seen.values()];
  }, [data]);

  // Authorisation plans — derived from consent entries (covers plans that
  // have auto-pay active but may no longer have a matching upcoming obligation)
  const authPlans = useMemo(() => {
    const seen = new Map();
    for (const auth of authorisations ?? []) {
      for (const c of auth.consents ?? []) {
        if (c.revoked) continue;
        const key = c.paymentLinkId ?? `${c.paymentLinkTitle}__${c.communityName}`;
        if (!seen.has(key)) {
          seen.set(key, {
            paymentLinkId: c.paymentLinkId,
            name: c.paymentLinkTitle ?? "Payment Plan",
            communityName: c.communityName ?? "",
            amount: null,
            auth,
          });
        }
      }
    }
    return [...seen.values()];
  }, [authorisations]);

  // Merge: prefer upcoming obligations, overlay auth info
  const allPlans = useMemo(() => {
    const result = new Map();
    // Seed with recurring obligations
    for (const p of recurringPlans) {
      const key = p.paymentLinkId ?? `${p.name}__${p.communityName}`;
      result.set(key, { ...p, auth: null });
    }
    // Overlay auth info
    for (const ap of authPlans) {
      const key = ap.paymentLinkId ?? `${ap.name}__${ap.communityName}`;
      if (result.has(key)) {
        result.get(key).auth = ap.auth;
      } else {
        result.set(key, ap);
      }
    }
    return [...result.values()];
  }, [recurringPlans, authPlans]);

  function findAuthForPlan(plan) {
    for (const auth of authorisations ?? []) {
      const consent = auth.consents.find((c) => {
        if (c.revoked) return false;
        // Match by ID first (most reliable), then fall back to title+community
        if (plan.paymentLinkId && c.paymentLinkId) return c.paymentLinkId === plan.paymentLinkId;
        return c.paymentLinkTitle === plan.name && c.communityName === plan.communityName;
      });
      if (consent) return auth;
    }
    return null;
  }

  function handleToggle(plan) {
    const auth = findAuthForPlan(plan);
    if (!auth) return; // can't disable what isn't enabled
    setTurningOff({ plan, auth });
  }

  const isLoading = paymentsLoading || authsLoading;

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      <div className="relative flex items-center justify-center pt-5 px-4 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => goBackInApp(navigate, "/member/settings")}
          className="absolute left-4"
        />
        <h1 className="text-lg font-medium text-ink m-0">Auto-Pay</h1>
      </div>

      <div className="px-4">
        {allPlans.length > 0 && (
          <p className="text-[14px] font-medium text-black/60 mt-0 mx-1 mb-2">Active Plans</p>
        )}
        <div className="rounded-xl bg-surface-container border border-black/10 overflow-hidden">
          {isLoading ? (
            <PageLoadingState size={56} padding="36px 24px" />
          ) : allPlans.length === 0 ? (
            // Shaped like a real plan row below (flex justify-between p-4,
            // a Toggle on the right, disabled+off so it renders muted).
            <div className="flex items-center justify-between p-4">
              <p className="text-[13px] text-ink-ghost m-0">
                You're not on any recurring plans yet
              </p>
              <Toggle on={false} onChange={() => {}} disabled />
            </div>
          ) : (
            allPlans.map((plan, i) => {
              const auth = findAuthForPlan(plan);
              const isOn = !!auth;
              const expired = auth ? isAuthorisationExpired(auth) : false;
              const inactive = auth && (auth.status ?? "").toUpperCase() !== "ACTIVE";
              return (
                <div
                  key={plan.paymentLinkId ?? `${plan.name}-${plan.communityName}`}
                  className={`flex items-center justify-between p-4 ${i < allPlans.length - 1 ? "border-b border-black/10" : "border-none"}`}
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-[15px] font-medium text-ink m-0">{plan.name}</p>
                    <p className="text-[13px] text-ink-ghost mt-[3px] mx-0 mb-0">
                      {[plan.communityName, plan.amount != null ? formatNaira(plan.amount) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {expired && (
                      <p className="text-[11px] text-danger mt-1 mx-0 mb-0 leading-[1.4]">
                        Your saved card expired
                        {auth.expMonth && auth.expYear ? ` ${auth.expMonth}/${auth.expYear}` : ""}.
                        Auto-Pay charges will fail — pay once with a new card to update it.
                      </p>
                    )}
                    {!expired && inactive && (
                      <p className="text-[11px] text-warning mt-1 mx-0 mb-0 leading-[1.4]">
                        Your saved payment method is no longer active, so automatic charges may
                        fail. Pay once with a new method to re-enable Auto-Pay.
                      </p>
                    )}
                  </div>
                  <Toggle on={isOn} onChange={() => handleToggle(plan)} />
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-start gap-2 mt-3.5 py-3 px-3.5 rounded-[10px] bg-brand-mist">
          <div className="w-4 h-4 rounded-full border border-brand flex items-center justify-center flex-shrink-0 mt-px">
            <span className="text-[9px] font-bold text-brand">i</span>
          </div>
          <p className="text-xs text-ink m-0 leading-[1.5]">
            Auto-Pay charges your saved method on each due date, and you'll get an in-app and email
            reminder 3 days before every charge. If a charge fails (an expired card, insufficient
            funds, or a declined transaction), the payment stays due and you'll be notified so you
            can pay manually.
          </p>
        </div>
      </div>

      {turningOff && (
        <ConfirmSheet
          title="Turn Off Auto-Pay?"
          description={`This removes the saved payment method for ${turningOff.plan.name} entirely — Auto-Pay will stop for every plan tied to that same method, not just this one.`}
          confirmLabel="Yes, turn off"
          confirmingLabel="Turning off…"
          confirming={isRemoving}
          onCancel={() => setTurningOff(null)}
          onConfirm={() =>
            toggleAutoPay(turningOff.auth.id, false, { onSuccess: () => setTurningOff(null) })
          }
        />
      )}
    </div>
  );
}
