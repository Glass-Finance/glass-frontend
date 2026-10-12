import { useNavigate } from "react-router-dom";
import { Button } from "../../../../components/ui/Button";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { useNotificationPreferences } from "../../../../hooks/useNotifications";
import Toggle from "../../../../components/common/Toggle";
import { SkeletonRow } from "../../../../components/common/SkeletonUI";
import { MEMBER_APP_SKELETON_ROW } from "../../../../components/common/skeletonRowPresets";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";

function PrefRow({ label, desc, value, onChange, disabled, last = false }) {
  return (
    <div
      className={`flex items-center justify-between py-3.5 px-4 ${last ? "border-none" : "border-b border-hairline-soft"}`}
    >
      <div className="min-w-0 pr-3">
        <p className="text-sm font-medium text-ink m-0">{label}</p>
        {desc && <p className="text-xs text-ink-ghost mt-0.5 mx-0 mb-0">{desc}</p>}
      </div>
      <Toggle on={!!value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Section({ title, children, ariaBusy = false }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold text-ink-ghost mt-0 mx-1 mb-2 uppercase [letter-spacing:0.6px]">
        {title}
      </p>
      <div
        aria-busy={ariaBusy || undefined}
        className="border border-surface-container-border bg-white rounded-2xl overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const { preferences, isLoading, error, update } = useNotificationPreferences();

  const get = (key, defaultVal = true) => preferences[key] ?? defaultVal;

  // When preferences failed to load, the values shown are just defaults —
  // letting the user flip them would save against unknown server state.
  const rowDisabled = !!error;

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      {/* Header */}
      <div className="flex items-center gap-2.5 pt-5 px-4 pb-4">
        <Button
          variant="tertiary"
          size="icon-md"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="flex-shrink-0"
        >
          <ChevronLeft size={18} strokeWidth={2} className="text-ink" />
        </Button>
        <h1 className="text-lg font-semibold text-ink m-0">Notifications</h1>
      </div>

      <div className="px-4">
        {/* Error state */}
        {error && !isLoading && (
          <div className="bg-[#FFF0F0] border border-[#FECACA] rounded-xl py-3.5 px-4 mb-5 flex items-center justify-between">
            <p className="text-[13px] text-danger m-0">Couldn't load preferences.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-transparent border-none cursor-pointer text-danger flex items-center gap-1 text-xs font-semibold p-0"
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* ── Channels ───────────────────────────────────────────────────────── */}
        <Section title="Notification channels" ariaBusy={isLoading}>
          {isLoading ? (
            <>
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} />
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} />
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} last />
            </>
          ) : (
            <>
              <PrefRow
                disabled={rowDisabled}
                label="In-app"
                desc="Show notifications inside the app"
                value={get("inAppEnabled")}
                onChange={(v) => update("inAppEnabled", v)}
              />
              <PrefRow
                disabled={rowDisabled}
                label="Email"
                desc="Send updates to your email address"
                value={get("emailEnabled")}
                onChange={(v) => update("emailEnabled", v)}
              />
              <PrefRow
                disabled={rowDisabled}
                label="WhatsApp"
                desc="Send updates to your WhatsApp number"
                value={get("whatsappEnabled")}
                onChange={(v) => update("whatsappEnabled", v)}
                last
              />
            </>
          )}
        </Section>

        {/* ── Payments ───────────────────────────────────────────────────────── */}
        <Section title="Payments" ariaBusy={isLoading}>
          {isLoading ? (
            <>
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} />
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} />
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} />
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} last />
            </>
          ) : (
            <>
              <PrefRow
                disabled={rowDisabled}
                label="Payment reminders"
                desc="Get reminded before a payment is due"
                value={get("paymentReminderEnabled")}
                onChange={(v) => update("paymentReminderEnabled", v)}
              />
              <PrefRow
                disabled={rowDisabled}
                label="Payment receipts"
                desc="Confirmation when a payment goes through"
                value={get("paymentReceiptEnabled")}
                onChange={(v) => update("paymentReceiptEnabled", v)}
              />
              <PrefRow
                disabled={rowDisabled}
                label="Failed payments"
                desc="Alert when one of your payments fails or is declined"
                value={get("paymentFailureEnabled")}
                onChange={(v) => update("paymentFailureEnabled", v)}
              />
              <PrefRow
                disabled={rowDisabled}
                label="Auto-Pay alerts"
                desc="Notified 3 days before an auto-pay charge"
                value={get("autoPayAlertEnabled")}
                onChange={(v) => update("autoPayAlertEnabled", v)}
                last
              />
            </>
          )}
        </Section>

        {/* ── Community ──────────────────────────────────────────────────────── */}
        <Section title="Community" ariaBusy={isLoading}>
          {isLoading ? (
            <>
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} />
              <SkeletonRow {...MEMBER_APP_SKELETON_ROW} last />
            </>
          ) : (
            <>
              <PrefRow
                disabled={rowDisabled}
                label="Community updates"
                desc="Announcements from community admins"
                value={get("communityUpdateEnabled")}
                onChange={(v) => update("communityUpdateEnabled", v)}
              />
              <PrefRow
                disabled={rowDisabled}
                label="Invitations"
                desc="When you're invited to join a community"
                value={get("inviteNotificationEnabled")}
                onChange={(v) => update("inviteNotificationEnabled", v)}
                last
              />
            </>
          )}
        </Section>

        {/* Info note */}
        <div className="flex items-start gap-2 py-3 px-3.5 rounded-[10px] bg-brand-mist">
          <div className="w-4 h-4 rounded-full border-[1.5px] border-brand flex items-center justify-center flex-shrink-0 mt-px">
            <span className="text-[9px] font-bold text-brand">i</span>
          </div>
          <p className="text-xs text-ink m-0 leading-[1.5]">
            Changes take effect immediately. Critical security alerts are always sent regardless of
            your preferences.
          </p>
        </div>
      </div>
    </div>
  );
}
