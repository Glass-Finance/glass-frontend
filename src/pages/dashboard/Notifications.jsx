import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageTitle } from "../../hooks/usePageTitle";
import { Bell } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useNotifications, useAllNotifications } from "../../hooks/useNotifications";
import { useActiveCommunityId } from "../../hooks/useActiveCommunityId";
import { useAuth } from "../../store/AuthContext";
import { notificationAction } from "../../utils/notificationRouting";
import { notificationCategory, isSelfAccountType } from "../../utils/notificationTypes";
import LoadingState from "../../components/common/LoadingState";
import EmptyState from "../../components/common/EmptyState";
import notificationsIllustration from "../../assets/dashboard/empty-states/notifications-illustration.webp";
import { NotificationDetailModal, ChronologicalList } from "./NotificationsSections";

// notificationCategory() maps the backend's exact notificationType enum to a
// tab — precise for every documented type. This heuristic only runs for
// notifications with a missing/unrecognized type (legacy data, or a type
// added server-side before this file's enum list catches up).
function categorizeHeuristic(n) {
  const t = (n.notificationType ?? n.type ?? "").toUpperCase();
  const title = (n.title ?? n.subject ?? "").toUpperCase();
  if (
    t.includes("FAIL") ||
    t.includes("URGENT") ||
    t.includes("ALERT") ||
    t.includes("DEFAULT") ||
    t.includes("OVERDUE") ||
    t.includes("SUSPEND")
  )
    return "urgent";
  if (
    t.includes("MEMBER") ||
    t.includes("JOIN") ||
    t.includes("COMMUNITY") ||
    t.includes("INVITE") ||
    t.includes("DEPART") ||
    t.includes("REMOVE") ||
    t.includes("PROFILE") ||
    t.includes("AVATAR") ||
    t.includes("IMAGE") ||
    title.includes("PROFILE") ||
    title.includes("IMAGE") ||
    title.includes("AVATAR") ||
    title.includes("JOINED") ||
    title.includes("MEMBER")
  )
    return "member";
  // Covers PAYMENT, DUES, CONTRIBUTION, COLLECTION, etc.
  return "payment";
}

function categorize(n) {
  return notificationCategory(n.notificationType ?? n.type) ?? categorizeHeuristic(n);
}

const SECTION_CONFIG = {
  urgent: { label: "Urgent" },
  payment: { label: "Payment Activity" },
  member: { label: "Community Activity" },
};

// Failed/overdue payment notifications ("urgent") are still a payment event
// at heart — Figma's tab set folds them into "Payments" rather than giving
// them a separate tab, so TAB_CAT accepts either a single category or a list.
const TABS = ["All", "Payments", "Community"];
const TAB_CAT = { Payments: ["payment", "urgent"], Community: ["member"] };

function useNotificationDetail(notifications, markRead) {
  const { notifications: allNotifications } = useAllNotifications();
  const [openNotif, setOpenNotif] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get("open");

  useEffect(() => {
    if (!openId) return;
    if (notifications.length === 0 && allNotifications.length === 0) return;
    const n =
      notifications.find((x) => String(x.id) === openId) ??
      allNotifications.find((x) => String(x.id) === openId);
    if (n) {
      // Opens the detail modal for a deep-linked (?open=) notification once
      // the list has loaded -- genuinely a one-time reaction to a URL param,
      // not a value derivable from render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenNotif(n);
      if (!(n.readFlag ?? false)) markRead(n.id);
    }
    // Consume just the "open" param so refresh/back doesn't reopen the modal
    // -- replacing with {} used to wipe every other param too, including
    // ?community=, silently kicking the page back to the unscoped
    // all-communities view the moment a deep-linked notification opened.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("open");
        return next;
      },
      { replace: true },
    );
  }, [openId, notifications, allNotifications]); // eslint-disable-line react-hooks/exhaustive-deps

  return { openNotif, open: setOpenNotif, close: () => setOpenNotif(null) };
}

// Cross-community view: every notification for this user regardless of
// which community it belongs to (useAllNotifications, unscoped). The only
// way here is the Platform Admin sidebar's own "Notifications" link (see
// the Notifications() switch below) -- Communities Home's overview card
// has no page-level "view all" of its own, since there's no single
// community page a cross-community "view all" could correctly deep-link
// into.
function AllCommunitiesNotifications() {
  usePageTitle("Notifications");
  const {
    notifications,
    isLoading,
    unreadCount,
    markRead,
    markAllRead,
    isMarkingAllRead,
    clearAll,
    isClearingAll,
  } = useAllNotifications();
  const detail = useNotificationDetail(notifications, markRead);

  return (
    <div className="flex flex-col h-full px-4 md:px-6 py-6 min-h-0">
      <div className="mb-5 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div>
            <h1 className="text-xl font-bold text-black mb-1">Notifications</h1>
            <p className="text-sm text-gray-400">Updates across every community you manage.</p>
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {unreadCount > 0 && (
                <Button
                  variant="primary"
                  size="sm-tight"
                  fullWidth={false}
                  onClick={() => markAllRead()}
                  disabled={isMarkingAllRead}
                  className="self-start flex-shrink-0"
                >
                  Mark All As Read
                </Button>
              )}
              <Button
                variant="outline-caution"
                size="sm-tight"
                onClick={() => clearAll()}
                disabled={isClearingAll}
                fullWidth={false}
                className="self-start flex-shrink-0"
              >
                Clear All
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <LoadingState className="py-12" />
        ) : notifications.length === 0 ? (
          <EmptyState
            illustration={notificationsIllustration}
            illustrationClassName="w-[200px] h-auto mb-4"
            title="You're all caught up."
            subtitle="We'll let you know when something needs your attention."
            className="py-16"
          />
        ) : (
          <ChronologicalList items={notifications} onMarkRead={markRead} onOpen={detail.open} />
        )}
      </div>

      {detail.openNotif && (
        <NotificationDetailModal
          n={detail.openNotif}
          onClose={detail.close}
          sectionConfig={SECTION_CONFIG}
          categorize={categorize}
          isSelfAccountType={isSelfAccountType}
          notificationAction={notificationAction}
        />
      )}
    </div>
  );
}

function CommunityNotifications() {
  usePageTitle("Notifications");
  const {
    notifications,
    isLoading,
    unreadCount,
    markRead,
    markAllRead,
    isMarkingAllRead,
    clearAll,
    isClearingAll,
  } = useNotifications();
  const [tab, setTab] = useState("All");
  const detail = useNotificationDetail(notifications, markRead);

  const byCategory = useMemo(
    () => ({
      payment: notifications.filter((n) => ["payment", "urgent"].includes(categorize(n))),
      member: notifications.filter((n) => categorize(n) === "member"),
    }),
    [notifications],
  );

  const tabItems = useMemo(() => {
    if (tab === "All") return notifications;
    const cats = TAB_CAT[tab];
    return notifications.filter((n) => cats.includes(categorize(n)));
  }, [notifications, tab]);

  // Per the Figma empty state (mirrors Members.jsx/Payments.jsx's same fix):
  // the page header and tabs don't show at all when there are no
  // notifications at all -- distinct from tabItems.length === 0 below,
  // which is just the current tab matching nothing and still needs the
  // header/tabs to switch away from it.
  const isEmpty = !isLoading && notifications.length === 0;

  return (
    <div className="flex flex-col h-full px-4 md:px-6 py-6 min-h-0">
      {/* Header */}
      {!isEmpty && (
        <div className="mb-5 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
            <div>
              <h1 className="text-xl font-bold text-black mb-1">Notifications</h1>
              <p className="text-sm text-gray-400">
                Stay on top of payments, member activity, and alerts.
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Button
                variant="primary"
                size="xs"
                fullWidth={false}
                onClick={() => markAllRead()}
                disabled={isMarkingAllRead || unreadCount === 0}
              >
                Mark All As Read
              </Button>
              <Button
                variant="outline-caution"
                size="xs"
                onClick={() => clearAll()}
                disabled={isClearingAll || notifications.length === 0}
                fullWidth={false}
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs — matches Settings' Account/Finance/Community segmented style */}
      {!isEmpty && (
        <div className="overflow-x-auto flex-shrink-0 mb-5">
          <div className="flex gap-1 bg-stacked-container rounded-md p-1 w-fit border border-surface-page">
            {TABS.map((t) => {
              const count =
                t === "All"
                  ? notifications.length
                  : t === "Payments"
                    ? byCategory.payment.length
                    : byCategory.member.length;
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[13px] rounded transition-all cursor-pointer border-none font-medium
                ${active ? "bg-white text-gray-900 shadow-sm" : "bg-transparent text-gray-500 hover:text-gray-800"}`}
                >
                  {t}
                  {count > 0 && (
                    <span
                      className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center border ${
                        active
                          ? "border-brand bg-brand-wash text-brand"
                          : "border-surface-container-border bg-white text-gray-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notification list — independently scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <LoadingState className="py-12" />
        ) : notifications.length === 0 ? (
          <EmptyState
            illustration={notificationsIllustration}
            illustrationClassName="w-[200px] h-auto mb-4"
            title="You're all caught up."
            subtitle="We'll let you know when something needs your attention."
            className="py-16"
          />
        ) : tabItems.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={`No ${tab.toLowerCase()} notifications`}
            className="py-12"
          />
        ) : (
          <ChronologicalList items={tabItems} onMarkRead={markRead} onOpen={detail.open} />
        )}
      </div>

      {detail.openNotif && (
        <NotificationDetailModal
          n={detail.openNotif}
          onClose={detail.close}
          sectionConfig={SECTION_CONFIG}
          categorize={categorize}
          isSelfAccountType={isSelfAccountType}
          notificationAction={notificationAction}
        />
      )}
    </div>
  );
}

export default function Notifications() {
  const { isPlatformAdmin } = useAuth();
  const activeCommunityId = useActiveCommunityId();

  // The Platform Admin sidebar's own "Notifications" link (no community
  // context at all) is the only place the cross-community view belongs.
  // Every other way of reaching this page -- the regular per-community
  // sidebar's "Notifications" item, the bell dropdown's per-community
  // destination, a notification row's own deep link -- carries or implies a
  // specific active community (via useActiveCommunityId's ?community= param
  // or its localStorage fallback, same convention Settings already uses
  // since this route never puts ?community= in its own URL). A platform admin
  // may also administer communities, so the global-role flag alone must not
  // force the cross-community view when a community context is active.
  return isPlatformAdmin && !activeCommunityId ? (
    <AllCommunitiesNotifications />
  ) : (
    <CommunityNotifications />
  );
}
