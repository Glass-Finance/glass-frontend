import { X } from "lucide-react";
import { Button } from "../../../components/ui/Button";

// Same extraction approach as UploadMembersTab above.
export default function ManualMembersTab({
  emails,
  emailInput,
  setEmailInput,
  handleEmailKeyDown,
  commitEmailChip,
  removeEmailChip,
  phoneNumbers,
  setPhoneNumbers,
  selectedRoleId,
  setSelectedRoleId,
  rolesLoading,
  finalRoles,
  billingExempt,
  setBillingExempt,
  error,
  loading,
  handleSendInvite,
  inputCls,
}) {
  return (
    <>
      <p className="text-sm font-medium text-gray-900 mb-2">Enter Email(s):</p>
      <div className="rounded-lg p-3 flex flex-wrap items-center gap-2 mb-5 min-h-[60px] border border-hairline-neutral bg-white focus-within:border-brand">
        {emails.map((em, i) => (
          <span
            key={em + i}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full text-sm text-gray-800 bg-stacked-container"
          >
            <span className="w-6 h-6 rounded-full bg-brand-mist text-brand text-[10px] font-semibold flex items-center justify-center flex-shrink-0">
              {em.charAt(0).toUpperCase()}
            </span>
            {em}
            <Button
              variant="tertiary"
              size="icon-sm"
              onClick={() => removeEmailChip(i)}
              aria-label={`Remove ${em}`}
            >
              <X size={12} />
            </Button>
          </span>
        ))}
        <input
          type="text"
          aria-label="Add member email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={handleEmailKeyDown}
          onBlur={commitEmailChip}
          placeholder={emails.length === 0 ? "Type an email and press Enter" : ""}
          className="flex-1 min-w-[160px] outline-none text-sm bg-transparent border-none py-1"
        />
      </div>

      <p className="text-sm font-medium text-gray-900 mb-2">
        Enter Phone Number(s) <span className="text-gray-400 font-normal">(Optional):</span>
      </p>
      <input
        type="text"
        aria-label="Phone number"
        value={phoneNumbers}
        onChange={(e) => setPhoneNumbers(e.target.value)}
        placeholder="Enter Phone Number"
        className={`${inputCls} mb-5`}
      />

      <p className="text-sm font-medium text-gray-900 mb-2">Role:</p>
      <div className="relative mb-4">
        <select
          value={selectedRoleId}
          onChange={(e) => setSelectedRoleId(e.target.value)}
          disabled={rolesLoading}
          className={`${inputCls} appearance-none pr-8 ${rolesLoading ? "opacity-50" : ""}`}
        >
          {rolesLoading ? (
            <option>Loading roles…</option>
          ) : (
            finalRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))
          )}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-gray-700 mb-5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={billingExempt}
          onChange={(e) => setBillingExempt(e.target.checked)}
          className="w-4 h-4 accent-brand cursor-pointer"
        />
        Exempt from billing
        <span className="text-xs text-gray-400 font-normal">
          (no payment reminders will be sent)
        </span>
      </label>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      <div className="flex lg:justify-end">
        <Button
          onClick={handleSendInvite}
          disabled={emails.length === 0 || rolesLoading || !selectedRoleId}
          loading={loading}
          size="sm"
          className="lg:w-auto px-6"
        >
          {loading ? "Sending…" : "Send Invite"}
        </Button>
      </div>
    </>
  );
}
