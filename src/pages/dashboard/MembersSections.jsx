import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Check, Copy, X } from "lucide-react";
import { useEscapeToClose } from "../../hooks/useKeyboardShortcuts";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";

export function QuickAddMemberModal({
  onClose,
  onAdd,
  adding,
  error,
  roles,
  rolesUnavailable,
  inviteLink,
}) {
  useEscapeToClose(onClose);
  const [email, setEmail] = useState("");
  const defaultRole = roles.find((role) => role.name === "Community Member") ?? roles[0];
  const [roleId, setRoleId] = useState(defaultRole?.id ?? "");
  const [billingExempt, setBillingExempt] = useState(false);
  const [linkCopied, copyInviteLinkText] = useCopyToClipboard();

  async function handleSubmit(event) {
    event.preventDefault();
    const ok = await onAdd({ email: email.trim(), roleId, billingExempt });
    if (ok) onClose();
  }

  const isReady = email.trim() && !rolesUnavailable;
  const isNotRegistered = error?.toLowerCase().includes("registered");

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-6 bg-black/20"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-surface-bg rounded-2xl w-full max-w-md shadow-2xl p-6 border border-surface-container-border"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-black">Invite Member</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              An invite email will be sent to their address.
            </p>
          </div>
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
            className=""
          >
            <X size={14} />
          </Button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label
              htmlFor="invite-member-email"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="invite-member-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="member@email.com"
              className="w-full h-12 min-h-8 px-4 py-1 rounded-lg border-[1.5px] border-gray-200 text-placeholder outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
            <div className="relative">
              <select
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-gray-200 text-xs outline-none focus:border-brand appearance-none !pr-8"
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
            </div>
            {rolesUnavailable && (
              <p className="text-xs text-danger mt-1.5">
                Couldn't load roles from the server — try closing and reopening this dialog.
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={billingExempt}
              onChange={(event) => setBillingExempt(event.target.checked)}
            />
            Exempt from billing
          </label>
        </div>

        {error && (
          <div className="mt-3">
            <p className="text-xs text-danger">{error}</p>
            {isNotRegistered && inviteLink && (
              <div className="mt-2.5 rounded-lg p-3 bg-brand-wash border border-[#C7D2FE]">
                <p className="text-xs text-gray-700 mb-2">
                  Share your community link so they can register and join:
                </p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-brand truncate font-medium">
                    {inviteLink}
                  </span>
                  <Button
                    variant="primary"
                    size="xs"
                    fullWidth={false}
                    onClick={() => copyInviteLinkText(inviteLink)}
                    type="button"
                    className="flex-shrink-0"
                  >
                    {linkCopied ? <Check size={11} /> : <Copy size={11} />}
                    {linkCopied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <Button type="submit" disabled={adding || !isReady} className="mt-4">
          {adding ? "Sending…" : "Send Invite"}
        </Button>
      </form>
    </div>
  );
}
