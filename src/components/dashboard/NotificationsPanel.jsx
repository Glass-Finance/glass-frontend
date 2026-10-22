import { useState, useRef } from "react";
import { Button } from "../ui/Button";
import { useNavigate } from "react-router-dom";
import { Bell, MoreVertical, User } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import PulseImg from "../common/PulseImg";
import {
  extractNotificationDetails,
  formatNairaAmount,
  resolveCommunity as resolveNotificationCommunity,
  resolveNotificationBody,
} from "../../utils/notificationContent";
import { notificationsListDestination } from "../../utils/notificationRouting";
import { isSelfAccountType, notificationVisual } from "../../utils/notificationTypes";
import { useAuth } from "../../store/AuthContext";
import LoadingState from "../common/LoadingState";
import EmptyState from "../common/EmptyState";
import notificationsIllustration from "../../assets/dashboard/empty-states/notifications-illustration.webp";
import {
  formatRelativeDateTime as formatTimestamp,
  dayLabel,
  toPascalCaseName,
} from "../../utils/format";

// Resolve community info for display AND for the owned/member routing
// split below — shares notificationContent.js's resolveCommunity (id
// lookup, falling back to matching the community's name against the
// notification's own text) instead of keeping a separate local copy that
// can drift out of sync with it, which is exactly what happened before:
// this file's version had a community_id fallback the shared one lacked.
function resolveCommunity(n, communityMap) {
  return resolveNotificationCommunity(n, communityMap) ?? n.community ?? null;
}

// Where clicking this notification should go — scoped to the community it
// actually came from (not whatever community happened to be active last),
// and to the right side of the app for this user's role there:
//   - a community this user OWNS/ADMINS  → the admin notifications page,
//     scoped via ?community=, opening this notification's detail view.
//   - a community this user is only a MEMBER of → the member app's
//     notifications page, which adapts to desktop and mobile in its shared
//     member-app layout.
//   - no resolvable community (an account-level notification, or one whose
//     community isn't in this user's list at all) → the unscoped admin
//     notifications page, same as before.
// (shared as notificationsListDestination in utils/notificationRouting —
// Communities Home's overview card needs the exact same routing.)

// Per Figma: notifications use a category icon, not a photo/initials
// avatar — even a clearly-named event ("X joined Y") shows a status icon
// rather than that person's photo. A self-account event is the one
// exception, since it's genuinely about the reader's own account and
// there's a real photo to show (from auth state directly). Every other
// type gets a purpose-built icon + semantic color for its category (see
// notificationVisual) — red for failures/urgent, amber for due-soon, green
// for success, indigo for new/info, gray for neutral account notices.
function NotifAvatar({ n }) {
  const type = n.notificationType ?? n.type;
  const { user } = useAuth();
  const isSelf = isSelfAccountType(type);
  // Avatar alt text, so it's read aloud -- keep it properly cased.
  const selfName =
    toPascalCaseName([user?.firstName, user?.lastName].filter(Boolean).join(" ")) || user?.email;

  if (isSelf && user?.profileImage?.url) {
    return (
      <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden mt-px">
        <PulseImg src={user.profileImage.url} alt={selfName ?? ""} className="w-full h-full" />
      </div>
    );
  }

  const visual = notificationVisual(type);
  const Icon = visual?.icon ?? (isSelf ? User : Bell);
  const bg = visual?.bg ?? "#F3F4F6";
  const fg = visual?.fg ?? "var(--color-ink-muted)";

  return (
    <div
      className="w-9 h-9 rounded-full flex-shrink-0 mt-px flex items-center justify-center"
      style={{ background: bg }}
    >
      <Icon size={17} strokeWidth={2} color={fg} />
    </div>
  );
}

function NotifCard({ n, communityMap, onMarkRead, onNavigate }) {
  const isRead = n.readFlag ?? n.isRead ?? false;
  const title = n.title ?? n.subject ?? "Notification";
  const details = extractNotificationDetails(n, { communityMap });
  const body = resolveNotificationBody(
    n,
    details,
    n.message ?? n.description ?? n.bodyText ?? n.body ?? null,
  );
  const time = formatTimestamp(n.createdAt ?? n.timestamp);
  const community = resolveCommunity(n, communityMap);
  const commName = community?.name ?? community?.communityName ?? n.communityName ?? null;

  return (
    <button
      onClick={() => {
        if (!isRead) onMarkRead?.(n.id);
        onNavigate?.(notificationsListDestination(n, community));
      }}
      className={`flex items-start gap-2.5 w-full py-3 px-3.5 border-none cursor-pointer text-left transition-[background] duration-150 outline-none focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus ${isRead ? "bg-transparent rounded-none border-b border-hairline" : "bg-surface-container rounded-xl"}`}
    >
      <NotifAvatar n={n} />

      <div className="flex-1 min-w-0">
        {commName && (
          <p className="text-[9px] font-semibold text-brand mt-0 mx-0 mb-0.5 uppercase tracking-[0.04em] overflow-hidden text-ellipsis whitespace-nowrap">
            {commName}
          </p>
        )}
        <p
          className={`text-[11.5px] m-0 leading-[1.35] overflow-hidden text-ellipsis whitespace-nowrap ${isRead ? "font-medium text-ink-muted" : "font-semibold text-ink"}`}
        >
          {title}
        </p>
        {body && (
          <p className="text-[10.5px] text-ink-ghost mt-1 mx-0 mb-0 leading-[1.4] overflow-hidden text-ellipsis whitespace-nowrap">
            {body}
          </p>
        )}
        <p className="text-[10px] text-ink-ghost mt-1.5 mx-0 mb-0">
          {time}
          {(() => {
            const amount = formatNairaAmount(details.amount);
            return amount ? <span className="text-ink font-semibold"> · {amount}</span> : null;
          })()}
        </p>
      </div>

      {!isRead && <div className="w-[7px] h-[7px] rounded-full bg-brand flex-shrink-0 mt-1" />}
    </button>
  );
}

// Group items into day buckets, preserving already-sorted order
function groupByDay(items) {
  const buckets = [];
  let currentLabel = null;
  for (const n of items) {
    const label = dayLabel(n.createdAt);
    if (label !== currentLabel) {
      buckets.push({ label, items: [] });
      currentLabel = label;
    }
    buckets[buckets.length - 1].items.push(n);
  }
  return buckets;
}

export default function NotificationsPanel({
  notifications,
  isLoading,
  unreadCount,
  communityMap,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  isClearingAll,
  onClose,
}) {
  const navigate = useNavigate();
  const count = unreadCount ?? notifications.filter((n) => !(n.readFlag ?? n.isRead)).length;
  const buckets = groupByDay(notifications);

  // The header actions (Mark All As Read / Clear All) collapse into a 3-dot
  // overflow menu on mobile so they don't crowd the narrow panel header; the
  // inline buttons stay for desktop. Matches the `md` mobile boundary used
  // across the dashboard chrome (hamburger/sidebar drawer).
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef(null);
  useClickOutside(actionsRef, () => setActionsOpen(false), actionsOpen);

  return (
    <div
      className="absolute right-0 w-[390px] bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.14)] z-50 overflow-hidden [top:calc(100%+10px)] [max-width:calc(100vw-16px)]"
      role="menu"
    >
      {/* Header */}
      <div className="flex items-center justify-between pt-3.5 px-4 pb-2.5">
        <p className="flex items-center gap-2 text-[14px] font-bold text-ink m-0">
          Notifications
          {count > 0 && (
            <span className="text-[10px] font-semibold text-brand bg-[#E3E9FF] rounded-full min-w-[17px] h-[17px] px-1.5 flex items-center justify-center">
              {count}
            </span>
          )}
        </p>
        <div className="flex items-center gap-3">
          {/* Desktop: inline actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="tertiary"
              size="sm"
              fullWidth={false}
              onClick={onMarkAllRead}
              disabled={count === 0}
            >
              Mark All As Read
            </Button>
            <button
              onClick={onClearAll}
              disabled={notifications.length === 0 || isClearingAll}
              className="text-xs font-medium text-danger bg-transparent border-none cursor-pointer hover:opacity-70 disabled:opacity-40 disabled:cursor-default"
            >
              Clear All
            </button>
          </div>

          {/* Mobile: 3-dot overflow menu */}
          <div className="relative md:hidden" ref={actionsRef}>
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Notification actions"
              onClick={() => setActionsOpen((o) => !o)}
              aria-expanded={actionsOpen}
              className=""
            >
              <MoreVertical size={16} />
            </Button>
            {actionsOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-[172px] bg-white rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.14)] border border-[#EFEFEF] py-1 z-20"
                role="menu"
              >
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => {
                    onMarkAllRead();
                    setActionsOpen(false);
                  }}
                  disabled={count === 0}
                >
                  Mark All As Read
                </Button>
                <button
                  onClick={() => {
                    onClearAll();
                    setActionsOpen(false);
                  }}
                  disabled={notifications.length === 0 || isClearingAll}
                  role="menuitem"
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-danger bg-transparent border-none cursor-pointer hover:bg-surface-container disabled:opacity-40 disabled:cursor-default"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[440px] overflow-y-auto pb-1.5">
        {isLoading ? (
          <LoadingState className="py-8" />
        ) : notifications.length === 0 ? (
          <EmptyState
            illustration={notificationsIllustration}
            illustrationClassName="w-[100px] h-auto mb-3"
            title="No notifications yet"
            titleClassName="text-sm font-semibold text-gray-900"
            className="py-6"
          />
        ) : (
          buckets.map(({ label, items }) => (
            <div key={label}>
              <p className="text-[10.5px] font-normal text-ink-ghost pt-3 px-4 pb-1.5 m-0">
                {label}
              </p>
              <div className="flex flex-col gap-1 px-2.5">
                {items.map((n) => (
                  <NotifCard
                    key={n.id}
                    n={n}
                    communityMap={communityMap}
                    onMarkRead={onMarkRead}
                    onNavigate={(to) => {
                      onClose?.();
                      navigate(to);
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
