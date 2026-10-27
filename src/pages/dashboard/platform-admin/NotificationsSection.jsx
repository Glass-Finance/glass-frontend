import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Bell } from "lucide-react";
import notificationsEmptyIcon from "../../../assets/dashboard/empty-states/notifications-empty-state-icon.png";
import ModalShell from "../../../components/dashboard/ModalShell";
import { Button } from "../../../components/ui/Button";
import { createAdminNotification, getAdminNotificationJobs } from "../../../api/admin";
import { parseRecipientList } from "../../../utils/parseRecipientList";
import { fmtDate, unwrap, pageParams } from "./shared";
import { SectionHeader, TableShell, TableFooter } from "./SharedUI";

const NOTIF_TYPES = [
  "ACCOUNT_VERIFICATION",
  "PAYMENT_DUE",
  "PAYMENT_RECEIVED",
  "PAYMENT_FAILED",
  "INVITE_SENT",
  "INVITE_ACCEPTED",
  "GENERAL_ANNOUNCEMENT",
];
const NOTIF_CHANNELS = ["IN_APP", "EMAIL", "SMS", "PUSH"];

function SendNotificationModal({ onClose }) {
  const queryClient = useQueryClient();
  const [targetMode, setTargetMode] = useState("emails");
  const [targets, setTargets] = useState("");
  const [notificationType, setNotificationType] = useState("GENERAL_ANNOUNCEMENT");
  const [channels, setChannels] = useState(["IN_APP"]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload) => createAdminNotification(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notification-jobs"] });
      onClose();
    },
    meta: { successMessage: "Notification queued" },
  });

  function toggleChannel(ch) {
    setChannels((cs) => (cs.includes(ch) ? cs.filter((c) => c !== ch) : [...cs, ch]));
  }

  // Recipients are free-typed, not picked from a list -- surfacing the
  // parsed count is the only way to catch a pasted-in wrong list or a
  // stray delimiter before it goes out as real email/SMS/push.
  const recipientList = parseRecipientList(targets);

  function requestSend(e) {
    e.preventDefault();
    setConfirming(true);
  }

  function confirmSend() {
    mutation.mutate({
      notificationType,
      channels,
      title,
      message,
      ...(targetMode === "emails" ? { emails: recipientList } : { userIds: recipientList }),
    });
  }

  if (confirming) {
    return (
      <ModalShell className="rounded-g-1!" title="Confirm Send" onClose={onClose}>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-xs text-gray-600 leading-relaxed">
            This sends a real notification now — there's no undo once it's queued.
          </p>
          <div className="bg-stacked-container rounded-g-1 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Recipients</span>
              <span className="text-xs font-semibold text-gray-900">
                {recipientList.length} {targetMode === "emails" ? "email" : "user ID"}
                {recipientList.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Channels</span>
              <span className="text-xs font-semibold text-gray-900">{channels.join(", ")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500">Type</span>
              <span className="text-xs font-semibold text-gray-900">
                {notificationType.replace(/_/g, " ")}
              </span>
            </div>
            <div className="pt-1 border-t border-white">
              <p className="text-[11px] text-gray-500 mb-0.5">{title}</p>
              <p className="text-xs text-gray-700">{message}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline-neutral"
              onClick={() => setConfirming(false)}
              disabled={mutation.isPending}
              size="sm"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={confirmSend}
              loading={mutation.isPending}
              fullWidth={false}
              className="flex-1 flex items-center justify-center gap-1.5"
            >
              {mutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Bell size={12} />
              )}
              {mutation.isPending ? "Sending…" : "Confirm & Send"}
            </Button>
          </div>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell className="rounded-g-1!" title="Send Notification" onClose={onClose}>
      <form
        onSubmit={requestSend}
        className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto"
      >
        {/* Target mode */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Recipients</label>
          <div className="flex gap-2 mb-2">
            {[
              { val: "emails", label: "By Email" },
              { val: "userIds", label: "By User ID" },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setTargetMode(val)}
                className={`flex-1 py-2 rounded-g-1 text-xs font-semibold border transition-all cursor-pointer ${
                  targetMode === val
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            rows={3}
            required
            className="w-full h-12 min-h-8 px-4 py-1 rounded-g-1 border border-hairline-strong text-placeholder text-gray-800 outline-none resize-none font-mono transition-colors focus:border-brand"
            placeholder={
              targetMode === "emails" ? "user@example.com, another@example.com" : "uuid1, uuid2"
            }
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {recipientList.length} recipient{recipientList.length === 1 ? "" : "s"} parsed
          </p>
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Type</label>
          <div className="relative">
            <select
              value={notificationType}
              onChange={(e) => setNotificationType(e.target.value)}
              className="w-full h-12 min-h-8 px-4 py-1 rounded-g-1 border border-hairline-strong text-placeholder text-gray-700 outline-none focus:border-brand appearance-none !pr-9"
            >
              {NOTIF_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
          </div>
        </div>

        {/* Channels */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Channels</label>
          <div className="flex gap-2 flex-wrap">
            {NOTIF_CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={`px-3 py-1.5 rounded-g-1 text-[11px] font-semibold border transition-all cursor-pointer ${
                  channels.includes(ch)
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label
            htmlFor="notification-title"
            className="block text-xs font-semibold text-gray-700 mb-1.5"
          >
            Title
          </label>
          <input
            id="notification-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full h-12 min-h-8 px-4 py-1 rounded-g-1 border border-hairline-strong text-placeholder text-gray-800 outline-none transition-colors focus:border-brand"
            placeholder="Notification title"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            className="w-full h-12 min-h-8 px-4 py-1 rounded-g-1 border border-hairline-strong text-placeholder text-gray-800 outline-none resize-none transition-colors focus:border-brand"
            placeholder="Notification body…"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline-neutral"
            onClick={onClose}
            fullWidth={false}
            size="sm"
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={channels.length === 0 || recipientList.length === 0}
            fullWidth={false}
            className="flex-1 flex items-center justify-center gap-1.5"
          >
            <Bell size={12} />
            Review &amp; Send
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

const JOB_COLORS = {
  PENDING: { bg: "bg-amber-50", text: "text-amber-700" },
  COMPLETED: { bg: "bg-green-50", text: "text-green-700" },
  FAILED: { bg: "bg-red-50", text: "text-red-700" },
  PARTIAL: { bg: "bg-orange-50", text: "text-orange-700" },
};

export default function NotificationsSection() {
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const params = pageParams(page);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["admin-notification-jobs", params],
    queryFn: () => getAdminNotificationJobs(params).then(unwrap),
    staleTime: 30_000,
    placeholderData: (p) => p,
  });

  const items = data?.content ?? [];

  return (
    <div>
      <SectionHeader
        title="Notifications"
        desc="Platform-sent notification jobs and delivery status."
        count={data?.totalElements ?? 0}
        isFetching={isFetching && !isLoading}
        right={
          <Button variant="primary" size="xs" fullWidth={false} onClick={() => setShowCreate(true)}>
            <Bell size={12} /> Send Notification
          </Button>
        }
      />

      <TableShell
        isLoading={isLoading}
        isEmpty={items.length === 0}
        error={error}
        emptyIllustration={notificationsEmptyIcon}
        emptyIllustrationClassName="w-16 h-16 mb-3"
        emptyLabel="No notifications found"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-stacked-container">
              {["Type", "Channels", "Recipients", "Delivered", "Failed", "Status", "Created"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((j, i) => {
              const sc = JOB_COLORS[j.status] ?? {
                bg: "bg-gray-100",
                text: "text-gray-500",
              };
              return (
                <tr
                  key={j.jobId}
                  className={`hover:bg-gray-50 transition-colors ${i < items.length - 1 ? "border-b border-surface-sunken" : "border-b-0"}`}
                >
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-gray-700 font-medium">
                      {(j.notificationType ?? "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-gray-500">
                      {(j.channels ?? []).join(", ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-gray-700">{j.recipientCount ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-medium text-success">
                      {j.deliveredCount ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[12px] font-medium ${(j.failedCount ?? 0) > 0 ? "text-danger" : "text-gray-400"}`}
                    >
                      {j.failedCount ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-[11px] text-gray-500">{fmtDate(j.createdAt)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>

      <TableFooter
        totalElements={data?.totalElements ?? 0}
        noun="job"
        page={page}
        totalPages={data?.totalPages ?? 1}
        onPage={setPage}
      />
      {showCreate && <SendNotificationModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
