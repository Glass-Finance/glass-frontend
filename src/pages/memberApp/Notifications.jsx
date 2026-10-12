import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import { useNavigate } from "react-router-dom";
import { Bell, User } from "lucide-react";
import { useInvites } from "../../hooks/useInvites";
import { useNotifications } from "../../hooks/useNotifications";
import { useCommunityMap } from "../../hooks/useCommunityMap";
import { notificationTarget } from "../../utils/notificationRouting";
import {
  isPaymentNotificationType,
  isSelfAccountType,
  notificationVisual,
} from "../../utils/notificationTypes";
import {
  extractNotificationDetails,
  formatNairaAmount,
  resolveNotificationBody,
} from "../../utils/notificationContent";
import { useAuth } from "../../store/AuthContext";
import PageLoadingState from "../../components/common/PageLoadingState";
import { formatRelativeDateTime } from "../../utils/format";
import paymentsEmptyIllustration from "../../assets/memberApp/empty-states/notifications-payments-empty.webp";
import communityEmptyIllustration from "../../assets/memberApp/empty-states/notifications-community-empty.webp";
import invitesEmptyIllustration from "../../assets/memberApp/empty-states/notifications-invites-empty.webp";
import { MobileBackButton } from "../../components/ui/MobileBackButton";

const TABS = ["Payments", "Community", "Invites"];

// ── Date grouping helpers ─────────────────────────────────────────────────────
function dayLabel(dateStr) {
  if (!dateStr) return "Earlier";
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (target >= today) return "Today";
  if (target >= yesterday) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

function timeLabel(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDay(items) {
  const groups = new Map();
  for (const item of items) {
    const label = dayLabel(item.createdAt ?? item.date ?? item.invitedAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  }
  return groups;
}

// isPaymentNotificationType checks against the backend's exact
// notificationType enum first; the substring fallback only covers
// legacy/unrecognized types.
function isPaymentNotification(n) {
  const type = n.notificationType ?? "";
  if (isPaymentNotificationType(type)) return true;
  const upper = type.toUpperCase();
  return upper.includes("PAYMENT") || upper.includes("OBLIGATION") || upper.includes("AUTO_PAY");
}

// ── Notification icon ─────────────────────────────────────────────────────────
// Per Figma: notifications use a category icon, not a photo/initials
// avatar — even a clearly-named event ("X joined Y") shows a status icon
// rather than that person's photo. A self-account event is the one
// exception, since it's genuinely about the reader's own account and
// there's a real photo to show. Every other type gets a purpose-built
// icon + semantic color for its category (see notificationVisual) — red
// for failures/urgent, amber for due-soon, green for success, indigo for
// new/info, gray for neutral account notices.
function NotifIcon({ n }) {
  const { user } = useAuth();
  const type = n.notificationType ?? "";
  const isSelf = isSelfAccountType(type);
  const selfName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;

  if (isSelf && user?.profileImage?.url) {
    return (
      <div className="w-[38px] h-[38px] rounded-full flex-shrink-0 overflow-hidden">
        <img
          src={user.profileImage.url}
          alt={selfName ?? ""}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const visual = notificationVisual(type);
  const Icon = visual?.icon ?? (isSelf ? User : Bell);
  const bg = visual?.bg ?? "#F3F4F6";
  const fg = visual?.fg ?? "var(--color-ink-muted)";

  return (
    <div
      style={{ background: bg }}
      className="w-[38px] h-[38px] rounded-full flex-shrink-0 flex items-center justify-center"
    >
      <Icon size={18} strokeWidth={2} color={fg} />
    </div>
  );
}

// ── Notification row ──────────────────────────────────────────────────────────
// Per the design, only unread rows get a highlighted background — read rows
// sit flush against the shared list container behind them.
function NotificationRow({ n, onTap, onNavigate }) {
  const isRead = n.readFlag ?? false;
  const target = notificationTarget(n, { memberApp: true });
  const communityMap = useCommunityMap();
  const details = extractNotificationDetails(n, { communityMap });
  const amount = formatNairaAmount(details.amount);
  const messageText = resolveNotificationBody(
    n,
    details,
    n.message ?? n.description ?? n.bodyText ?? null,
  );

  return (
    <div
      className={`flex items-start gap-2.5 relative ${target ? "cursor-pointer" : "cursor-default"} ${isRead ? "py-2.5 px-1 bg-transparent rounded-none" : "py-3.5 px-4 bg-stacked-container rounded-xl"}`}
      onClick={() => {
        if (!isRead) onTap(n.id);
        if (target) onNavigate?.(target);
      }}
    >
      {!isRead && (
        <span className="absolute top-2.5 right-3 w-[7px] h-[7px] rounded-full bg-brand" />
      )}
      <NotifIcon n={n} />
      <div className={`flex-1 min-w-0 ${isRead ? "pr-0" : "pr-3.5"}`}>
        <p className="text-sm text-ink m-0 leading-[1.45]">
          {n.title && <span className={isRead ? "font-medium" : "font-bold"}>{n.title} </span>}
          {messageText && <span className="text-ink-strong">{messageText}</span>}
          {!n.title && !messageText && <span className="font-medium">Notification</span>}
        </p>
        <p className="text-[11.5px] text-ink-ghost mt-1 mb-0">
          {amount && <span className="text-ink font-semibold">{amount} · </span>}
          {[details.communityName, timeLabel(n.createdAt)].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

// ── Invite card ───────────────────────────────────────────────────────────────
function Avatar({ name, logo }) {
  const initials = (name ?? "?").trim().slice(0, 2).toUpperCase();
  return (
    <div
      className={`w-10 h-10 rounded-[10px] text-brand-deep flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden ${logo?.url ? "bg-transparent border-none" : "bg-[rgba(0,31,110,0.133)] border border-[rgba(0,31,110,0.267)]"}`}
    >
      {logo?.url ? (
        <img
          src={logo.url}
          alt=""
          decoding="async"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        initials
      )}
    </div>
  );
}

function InviteCard({ invite, onAccept, onReject, busy }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-outline-on-surface">
      <div className="flex items-start gap-3 mb-3.5">
        <Avatar name={invite.community?.name} logo={invite.community?.logo} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-ink m-0">
              {invite.community?.name ?? "Community"}
            </p>
            {invite.createdAt && (
              <span className="text-[11px] text-ink-ghost flex-shrink-0 whitespace-nowrap">
                {formatRelativeDateTime(invite.createdAt)}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-ghost mt-0.5 mb-0">Invited you to join</p>
        </div>
      </div>
      <div className="flex gap-2.5">
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          onClick={() => onAccept(invite)}
          disabled={busy}
        >
          Accept
        </Button>
        <Button
          variant="outline"
          size="md"
          className="flex-1"
          onClick={() => onReject(invite)}
          disabled={busy}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
// `illustration` (an image src, per Figma) takes priority over `icon` (a
// Lucide component) when both are passed. No card/border per Figma -- floats
// directly on the page background, centered in the remaining vertical space
// below the tab bar (not pinned to the top of it).
function EmptyState({ icon: Icon, illustration, label, hint, onAction, actionLabel }) {
  return (
    <div className="min-h-[55vh] flex flex-col items-center justify-center gap-2.5 text-center px-6">
      {illustration ? (
        <img
          src={illustration}
          alt=""
          className="w-20 h-20 object-contain"
          draggable={false}
          loading="lazy"
        />
      ) : (
        <Icon size={22} strokeWidth={1.6} className="text-[#bbb]" />
      )}
      <p className="text-sm font-semibold text-ink m-0">{label}</p>
      {hint && <p className="text-xs text-ink-ghost m-0 max-w-[240px] leading-relaxed">{hint}</p>}
      {onAction && (
        <Button variant="outline" size="sm" fullWidth={false} className="mt-1" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

// ── Grouped list ──────────────────────────────────────────────────────────────
// A single bordered card holds every day-group, per the design — not one
// card per day. Day labels are just section dividers inside it.
function GroupedNotifications({ items, onTap, onNavigate }) {
  const groups = useMemo(() => groupByDay(items), [items]);
  return (
    <div className="border border-surface-container-border bg-white rounded-2xl p-4 flex flex-col gap-4">
      {[...groups.entries()].map(([label, notifs]) => (
        <div key={label}>
          <p className="text-[13px] font-semibold text-ink-strong mb-2">{label}</p>
          <div className="flex flex-col gap-0.5">
            {notifs.map((n) => (
              <NotificationRow key={n.id} n={n} onTap={onTap} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Notifications() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Payments");

  const {
    invites,
    isLoading: invitesLoading,
    accept,
    reject,
    isAccepting,
    isRejecting,
    refresh,
  } = useInvites();
  const {
    notifications,
    isLoading: notifsLoading,
    markRead,
    markAllRead,
    isMarkingAllRead,
    clearAll,
    isClearingAll,
  } = useNotifications();

  const { paymentNotifs, communityNotifs } = useMemo(() => {
    const payment = [],
      community = [];
    for (const n of notifications) {
      (isPaymentNotification(n) ? payment : community).push(n);
    }
    return { paymentNotifs: payment, communityNotifs: community };
  }, [notifications]);

  async function handleAccept(invite) {
    await accept(invite.id);
  }
  async function handleReject(invite) {
    await reject(invite.id);
  }

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      {/* Header */}
      <div className="flex items-center justify-center relative pt-6 px-5 pb-5">
        <MobileBackButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-5"
        />
        <h1 className="text-lg font-medium text-ink m-0">Notifications</h1>
      </div>

      {/* Tab bar — segmented pill per Figma dev-mode spec (Frame 2121455025):
          bg-stacked-container (#F3F4F6), 4px radius, 4px padding, 11px gap,
          stretched to fill the width; active tab is a plain white segment
          (no shadow, matching the toggle pattern used elsewhere). */}
      <div className="flex items-center gap-[11px] mb-4 mx-5 p-1 bg-stacked-container rounded">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded border-none cursor-pointer text-[13px] transition-colors duration-200 ${activeTab === tab ? "bg-white font-semibold text-ink" : "bg-transparent font-normal text-ink-ghost"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Mark All As Read / Clear All — same actions as the bell dropdown and admin
          notifications page. Both apply to the whole list regardless of which
          tab is active, matching how those two surfaces already behave.
          Clear All uses DELETE /api/v1/notifications (removes every
          notification); Mark All As Read only clears the unread state. */}
      {(activeTab === "Payments" || activeTab === "Community") && notifications.length > 0 && (
        <div className="flex items-center justify-end gap-4 px-5 pb-3">
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={() => markAllRead()}
            disabled={isMarkingAllRead}
          >
            Mark All As Read
          </Button>
          <button
            onClick={() => clearAll()}
            disabled={isClearingAll}
            className={`text-xs font-medium text-danger bg-transparent border-none cursor-pointer p-0 ${isClearingAll ? "opacity-50" : "opacity-100"}`}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Content */}
      <div className="px-4">
        {activeTab === "Payments" &&
          (notifsLoading ? (
            <PageLoadingState size={56} padding="36px 24px" />
          ) : paymentNotifs.length === 0 ? (
            <EmptyState
              illustration={paymentsEmptyIllustration}
              label="No Payment History"
              hint="Once you make payment, your transaction history will appear here."
            />
          ) : (
            <GroupedNotifications items={paymentNotifs} onTap={markRead} onNavigate={navigate} />
          ))}

        {activeTab === "Community" &&
          (notifsLoading ? (
            <PageLoadingState size={56} padding="36px 24px" />
          ) : communityNotifs.length === 0 ? (
            <EmptyState
              illustration={communityEmptyIllustration}
              label="No community updates yet."
              hint="Plans, changes, and activity will appear here."
            />
          ) : (
            <GroupedNotifications items={communityNotifs} onTap={markRead} onNavigate={navigate} />
          ))}

        {activeTab === "Invites" &&
          (invitesLoading ? (
            <PageLoadingState size={56} padding="36px 24px" />
          ) : invites.length === 0 ? (
            <EmptyState
              illustration={invitesEmptyIllustration}
              label="No pending invites."
              hint="When an admin invites you to join a community, it'll appear here."
              onAction={refresh}
              actionLabel="Check Again"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {invites.map((invite) => (
                <InviteCard
                  key={invite.id}
                  invite={invite}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  busy={isAccepting || isRejecting}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
