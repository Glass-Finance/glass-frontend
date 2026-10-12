import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bell, Check, ChevronRight, X, User } from "lucide-react";
import { useAuth } from "../../store/AuthContext";
import { isSelfAccountType, notificationVisual } from "../../utils/notificationTypes";
import {
  extractNotificationDetails,
  formatNairaAmount,
  resolveNotificationBody,
} from "../../utils/notificationContent";
import { Button } from "../../components/ui/Button";
import { formatRelativeDateTime as formatTime, dayLabel, toTitleCase } from "../../utils/format";
import { useCommunityMap } from "../../hooks/useCommunityMap";
import { useEscapeToClose } from "../../hooks/useKeyboardShortcuts";

export function Avatar({ n, size = "sm" }) {
  const { user } = useAuth();
  const type = n?.notificationType ?? n?.type;
  const isSelf = isSelfAccountType(type);
  const selfName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email;
  const boxCls = size === "lg" ? "w-14 h-14" : "w-9 h-9";
  const iconSize = size === "lg" ? 26 : 18;

  if (isSelf && user?.profileImage?.url) {
    return (
      <div className={`${boxCls} rounded-full flex-shrink-0 overflow-hidden`}>
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
      className={`${boxCls} rounded-full flex-shrink-0 flex items-center justify-center`}
      style={{ background: bg }}
    >
      <Icon size={iconSize} strokeWidth={2} color={fg} />
    </div>
  );
}

export function NotificationRow({ n, onMarkRead, onOpen }) {
  const isRead = n.readFlag ?? false;
  const title = n.title ?? n.subject ?? "Notification";
  const communityMap = useCommunityMap();
  const details = extractNotificationDetails(n, { communityMap });
  const desc = resolveNotificationBody(n, details, n.description ?? n.message ?? n.bodyText ?? "");
  const amount = formatNairaAmount(details.amount);

  return (
    <button
      onClick={() => {
        if (!isRead) onMarkRead(n.id);
        onOpen(n);
      }}
      className={`relative w-full text-left flex items-start gap-3 cursor-pointer border-none ${isRead ? "py-2.5 px-1 bg-transparent rounded-none" : "py-3.5 px-4 bg-stacked-container rounded-xl"}`}
    >
      {!isRead && (
        <span className="absolute rounded-full bg-brand top-2.5 right-3 w-[7px] h-[7px]" />
      )}
      <Avatar n={n} />
      <div className={`flex-1 min-w-0 ${isRead ? "pr-0" : "pr-3.5"}`}>
        <p
          className={`text-sm leading-snug ${isRead ? "text-gray-500" : "text-gray-900 font-semibold"}`}
        >
          {title}
        </p>
        {desc && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>}
        <p className="text-[11px] text-gray-400 mt-1.5">
          {[details.memberName, details.communityName, formatTime(n.createdAt)]
            .filter(Boolean)
            .join(" · ")}
          {amount && <span className="text-gray-900 font-semibold"> · {amount}</span>}
        </p>
      </div>
    </button>
  );
}

export function DetailShell({ catLabel, onClose, maxWidthCls, children }) {
  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full bg-surface-bg rounded-2xl shadow-2xl border border-surface-container-border overflow-hidden ${maxWidthCls}`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
            {catLabel}
          </span>
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
            className="flex-shrink-0"
          >
            <X size={15} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FactRows({ rows }) {
  if (rows.length === 0) return null;
  return (
    <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-400 flex-shrink-0">{r.label}</span>
          <span
            className={`text-xs font-medium text-gray-700 text-right break-all tabular-nums ${r.mono ? "font-mono" : ""}`}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function NotificationDetailModal({
  n,
  onClose,
  sectionConfig,
  categorize,
  isSelfAccountType,
  notificationAction,
}) {
  useEscapeToClose(onClose);
  const navigate = useNavigate();
  const { user } = useAuth();
  const title = n.title ?? n.subject ?? "Notification";
  const action = notificationAction(n);
  const isSelf = isSelfAccountType(n.notificationType ?? n.type);
  const cat = categorize(n);
  const catLabel = isSelf ? "Account Activity" : sectionConfig[cat].label;
  const goToAction = () => navigate(action.to);

  const communityMap = useCommunityMap();
  const details = extractNotificationDetails(n, { communityMap });
  const desc = resolveNotificationBody(
    n,
    details,
    n.description ?? n.message ?? n.bodyText ?? n.body ?? "",
  );
  const amount = formatNairaAmount(details.amount);

  if (isSelf) {
    const channelLabel = n.channel && toTitleCase(n.channel.toLowerCase().replace(/_/g, " "));
    const meta = [formatTime(details.time), channelLabel].filter(Boolean).join(" · ");
    return (
      <DetailShell catLabel={catLabel} onClose={onClose} maxWidthCls="max-w-[360px]">
        <div className="px-6 pt-4 pb-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            {user?.profileImage?.url ? (
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-gray-50">
                <img
                  src={user.profileImage.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full ring-4 ring-gray-50 bg-gray-100 flex items-center justify-center">
                <User size={30} className="text-gray-400" />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand ring-2 ring-white flex items-center justify-center">
              <Check size={13} strokeWidth={3} className="text-white" />
            </div>
          </div>
          <p className="text-[17px] font-bold text-gray-900 leading-snug">{title}</p>
          {desc && (
            <p className="text-sm text-gray-500 leading-relaxed mt-1.5 m-0 max-w-[260px]">{desc}</p>
          )}
          {meta && <p className="text-xs text-gray-400 mt-3 m-0">{meta}</p>}
        </div>
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-gray-100">
          {action && (
            <Button onClick={goToAction} size="md" fullWidth={false}>
              {action.label} <ChevronRight size={13} />
            </Button>
          )}
          <Button variant="tertiary" size="xs" fullWidth={false} onClick={onClose}>
            Close
          </Button>
        </div>
      </DetailShell>
    );
  }

  if (cat === "urgent") {
    const factRows = [
      { label: "Member", value: details.memberName },
      { label: "Community", value: details.communityName },
      { label: "Payment plan", value: details.planName },
      { label: "Reference", value: details.reference, mono: true },
      { label: "Received", value: formatTime(details.time) },
    ].filter((r) => r.value);

    return (
      <DetailShell catLabel={catLabel} onClose={onClose} maxWidthCls="max-w-[400px]">
        <div className="px-6 pt-3 pb-5">
          <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <p className="text-[18px] font-bold text-gray-900 leading-snug">{title}</p>
          {desc && (
            <p className="text-sm text-gray-500 leading-relaxed mt-1.5 m-0 whitespace-pre-wrap">
              {desc}
            </p>
          )}
          {amount && (
            <p className="text-[26px] font-bold text-gray-900 tabular-nums mt-3 mb-0">{amount}</p>
          )}
        </div>
        <FactRows rows={factRows} />
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-gray-100">
          {action && (
            <Button onClick={goToAction} variant="danger" size="md" fullWidth={false}>
              {action.label} <ChevronRight size={13} />
            </Button>
          )}
          <Button variant="tertiary" size="xs" fullWidth={false} onClick={onClose}>
            Not now
          </Button>
        </div>
      </DetailShell>
    );
  }

  if (cat === "member" && details.memberName) {
    const factRows = [
      { label: "Reference", value: details.reference, mono: true },
      { label: "Received", value: formatTime(details.time) },
    ].filter((r) => r.value);

    return (
      <DetailShell catLabel={catLabel} onClose={onClose} maxWidthCls="max-w-[400px]">
        <div className="px-6 pt-3 pb-5 flex items-start gap-3.5">
          <Avatar n={n} size="lg" />
          <div className="min-w-0 pt-1">
            <p className="text-[17px] font-bold text-gray-900 leading-snug truncate">
              {details.memberName}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{title}</p>
            {details.communityName && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <ArrowRight size={11} className="flex-shrink-0" />
                <span className="truncate">{details.communityName}</span>
              </p>
            )}
          </div>
        </div>
        <FactRows rows={factRows} />
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-gray-100">
          {action && (
            <Button onClick={goToAction} size="md" fullWidth={false}>
              {action.label} <ChevronRight size={13} />
            </Button>
          )}
          <Button variant="tertiary" size="xs" fullWidth={false} onClick={onClose}>
            Close
          </Button>
        </div>
      </DetailShell>
    );
  }

  if (cat === "payment" && amount) {
    const factRows = [
      { label: "Member", value: details.memberName },
      { label: "Community", value: details.communityName },
      { label: "Payment plan", value: details.planName },
      { label: "Reference", value: details.reference, mono: true },
      { label: "Received", value: formatTime(details.time) },
    ].filter((r) => r.value);

    return (
      <DetailShell catLabel={catLabel} onClose={onClose} maxWidthCls="max-w-[400px]">
        <div className="px-6 pt-3 pb-5">
          <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums mb-2">
            {amount}
          </p>
          <p className="text-sm font-medium text-gray-600 mt-0.5">{title}</p>
          {desc && (
            <p className="text-sm text-gray-500 leading-relaxed mt-1.5 m-0 whitespace-pre-wrap">
              {desc}
            </p>
          )}
        </div>
        <FactRows rows={factRows} />
        <div className="flex flex-col gap-2 px-6 py-4 border-t border-gray-100">
          {action && (
            <Button onClick={goToAction} size="md" fullWidth={false}>
              {action.label} <ChevronRight size={13} />
            </Button>
          )}
          <Button variant="tertiary" size="xs" fullWidth={false} onClick={onClose}>
            Close
          </Button>
        </div>
      </DetailShell>
    );
  }

  const factRows = [
    { label: "Member", value: details.memberName },
    { label: "Community", value: details.communityName },
    { label: "Amount", value: amount },
    { label: "Reference", value: details.reference, mono: true },
    { label: "Received", value: formatTime(details.time) },
  ].filter((r) => r.value);

  return (
    <DetailShell catLabel={catLabel} onClose={onClose} maxWidthCls="max-w-[400px]">
      <div className="px-6 pt-3 pb-5">
        <div className="mb-2">
          <Avatar n={n} />
        </div>
        <p className="text-[16px] font-bold text-gray-900 leading-snug">{title}</p>
        {desc && (
          <p className="text-sm text-gray-500 leading-relaxed mt-1.5 m-0 whitespace-pre-wrap">
            {desc}
          </p>
        )}
      </div>
      <FactRows rows={factRows} />
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
        <Button onClick={onClose} variant="outline-neutral" fullWidth={false} size="sm">
          Close
        </Button>
        {action && (
          <Button onClick={goToAction} fullWidth={false} size="md">
            {action.label} <ChevronRight size={13} />
          </Button>
        )}
      </div>
    </DetailShell>
  );
}

export function ChronologicalList({ items, onMarkRead, onOpen }) {
  if (items.length === 0) return null;

  const buckets = [];
  let currentLabel = null;
  for (const n of items) {
    const label = dayLabel(n.createdAt);
    if (label !== currentLabel) {
      buckets.push({ label, notifications: [] });
      currentLabel = label;
    }
    buckets[buckets.length - 1].notifications.push(n);
  }

  return (
    <div className="bg-white rounded-2xl border border-surface-container-border p-4 flex flex-col gap-4">
      {buckets.map(({ label, notifications }) => (
        <div key={label}>
          <p className="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <div className="flex flex-col gap-0.5">
            {notifications.map((n) => (
              <NotificationRow key={n.id} n={n} onMarkRead={onMarkRead} onOpen={onOpen} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
