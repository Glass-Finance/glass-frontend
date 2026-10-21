import { useState, useEffect, useRef } from "react";
import { Copy, X, Download, FileSpreadsheet, Check } from "lucide-react";
import uploadCloudIcon from "../../../assets/icons/upload-cloud.webp";
import { APP_ORIGIN } from "../../../utils/deviceRedirect";
import { useCommunityMembers, useRoles } from "../../../hooks/useCommunityMembers";
import { bulkAddCommunityMembers } from "../../../api/communities";
import { getEmailError } from "../../../utils/validators";
import { useCopyToClipboard } from "../../../hooks/useCopyToClipboard";
import { useEscapeToClose } from "../../../hooks/useKeyboardShortcuts";
import { Button } from "../../../components/ui/Button";
import SuccessBadge from "../../../components/common/SuccessBadge";
import { getErrorMessage } from "../../../utils/errorHandler";
import {
  ALLOWED_ROLE_NAMES,
  FALLBACK_ROLES,
  CSV_TEMPLATE,
  parseMemberCSV,
} from "./addMemberModalUtils";

export default function AddMemberModal({ onClose, communityId, communitySlug }) {
  const [tab, setTab] = useState("upload");
  const [linkCopied, copyLinkText] = useCopyToClipboard();
  const [dragOver, setDragOver] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState("");
  const [uploading, setUploading] = useState(false);

  // URL upload state
  const [fileUrl, setFileUrl] = useState("");
  const [urlStage, setUrlStage] = useState("idle"); // idle | fetching | complete
  const [urlProgress, setUrlProgress] = useState(0);
  const [urlFileInfo, setUrlFileInfo] = useState(null);

  useEscapeToClose(onClose);

  // Guards handleUrlUpload's post-fetch state updates if this modal closes
  // (unmounts) while a URL fetch is still in flight.
  const unmountedRef = useRef(false);
  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    [],
  );

  // Manual tab state
  const [emails, setEmails] = useState([]);
  const [emailInput, setEmailInput] = useState("");
  const [emailChipError, setEmailChipError] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [billingExempt, setBillingExempt] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const fileRef = useRef(null);

  // Prefer the community's real slug over communityId -- that's resolved
  // from whatever's in the current URL/localStorage, which can just as
  // easily be the raw backend UUID as the friendly slug (see
  // useActiveCommunityId.js), producing an ugly, opaque invite link
  // whenever it is.
  const inviteIdentifier = communitySlug || communityId;
  const inviteLink = inviteIdentifier
    ? `${APP_ORIGIN}/member/join?community=${inviteIdentifier}`
    : "";
  const { inviteMember } = useCommunityMembers(communityId);
  const { data: rolesData } = useRoles();
  const roles = (rolesData ?? []).filter((r) => ALLOWED_ROLE_NAMES.has(r.name));
  const finalRoles = roles.length ? roles : FALLBACK_ROLES;
  const defaultRole = finalRoles.find((r) => r.name === "Community Member") ?? finalRoles[0];
  const [roleId, setRoleId] = useState(defaultRole?.id ?? "");

  const inputCls =
    "w-full h-12 min-h-8 border border-outline-input px-4 py-1 rounded-lg text-placeholder text-black placeholder-black/60 outline-none focus:border-brand transition-all";

  function copyLink() {
    copyLinkText(inviteLink);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file) {
    if (!file || !file.name.endsWith(".csv")) {
      setCsvError("Please upload a .csv file.");
      return;
    }
    setCsvError("");
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setCsvRows(parseMemberCSV(e.target.result));
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function handleUrlUpload() {
    const url = fileUrl.trim();
    if (!url) return;
    setCsvError("");
    setUrlStage("fetching");
    setUrlProgress(8);
    const tick = setInterval(
      () => setUrlProgress((p) => (p < 88 ? p + Math.random() * 18 : p)),
      250,
    );
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Couldn't download a file from that URL.");
      const text = await res.text();
      clearInterval(tick);
      if (unmountedRef.current) return;
      setUrlProgress(100);
      const sizeKb = new Blob([text]).size / 1024;
      const name = url.split("/").pop() || "file.csv";
      setUrlFileInfo({
        name,
        sizeLabel:
          sizeKb > 1024
            ? `${(sizeKb / 1024).toFixed(1)} MB`
            : `${Math.max(1, Math.round(sizeKb))} KB`,
      });
      setCsvRows(parseMemberCSV(text));
      setUrlStage("complete");
    } catch {
      clearInterval(tick);
      if (unmountedRef.current) return;
      setUrlStage("idle");
      setUrlProgress(0);
      setCsvError("Failed to fetch CSV from URL.");
    }
  }

  function clearUrlUpload() {
    setUrlStage("idle");
    setUrlProgress(0);
    setUrlFileInfo(null);
    setFileUrl("");
    setCsvRows([]);
  }

  async function handleUploadCSV() {
    if (!csvRows.length) return;
    setUploading(true);
    setManualError("");
    try {
      // Bulk create (not invite) — the only endpoint that accepts memberRef,
      // firstName, lastName, and phoneNumber together. All-or-nothing per API.
      const members = csvRows
        .filter((row) => row.email)
        .map((row) => {
          const matchedRole = finalRoles.find(
            (r) => r.name?.toLowerCase() === row.role?.toLowerCase(),
          );
          return {
            email: row.email,
            roleId: matchedRole?.id ?? defaultRole?.id ?? "",
            billingExempt: false,
            ...(row.firstName ? { firstName: row.firstName } : {}),
            ...(row.lastName ? { lastName: row.lastName } : {}),
            ...(row.phone ? { phoneNumber: row.phone } : {}),
            ...(row.memberId ? { memberRef: row.memberId } : {}),
          };
        });
      if (!members.length) throw new Error("No valid rows to import.");
      await bulkAddCommunityMembers(communityId, { members });
    } catch (err) {
      setManualError(getErrorMessage(err, "Failed to import members."));
      setUploading(false);
      return;
    }
    setUploading(false);
    setCsvRows([]);
    setCsvFile(null);
    clearUrlUpload();
    setShowSuccess(true);
    setTimeout(onClose, 1800);
  }

  function commitEmailChip() {
    const val = emailInput.trim().replace(/[,;]+$/, "");
    if (!val) return;
    // A malformed address here silently fails later per-row on submit
    // (Promise.allSettled swallows individual failures into one banner) --
    // catching it before it even becomes a chip is much clearer than that.
    const chipError = getEmailError(val);
    if (chipError) {
      setEmailChipError(chipError);
      return;
    }
    if (!emails.includes(val)) setEmails((arr) => [...arr, val]);
    setEmailInput("");
    setEmailChipError("");
  }
  function handleEmailKeyDown(e) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      commitEmailChip();
    } else if (e.key === "Backspace" && !emailInput && emails.length > 0)
      setEmails((arr) => arr.slice(0, -1));
  }

  async function handleSendInvite() {
    if (emails.length === 0) return;
    setManualError("");
    setManualLoading(true);
    try {
      const results = await Promise.allSettled(
        emails.map((em) => inviteMember.mutateAsync({ email: em, roleId, billingExempt })),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      if (succeeded === 0)
        throw (
          results.find((r) => r.status === "rejected")?.reason ??
          new Error("Failed to send invites.")
        );
      setEmails([]);
      setPhoneNumbers("");
      setShowSuccess(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setManualError(getErrorMessage(err, "Failed to send invites."));
    } finally {
      setManualLoading(false);
    }
  }

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/20">
        <div className="bg-surface-bg rounded-2xl w-full max-w-md shadow-2xl py-14 px-8 flex items-center justify-center">
          <SuccessBadge message="Members Invited!" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Solid opaque white, matching ModalShell.jsx's established
          standard. This is the "very blurry render reported earlier"
          this same comment used to reference -- the frosted-glass panel
          (bg-surface-container backdrop-blur-xl) was the actual cause,
          confirmed against fresh Figma reference screenshots showing a
          crisp white panel over a lightly-dimmed backdrop, not a frosted
          one. Kept the split scroll/outer-layer structure regardless,
          since it's still good practice independent of this fix. */}
      <div className="bg-stacked-container rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden">
        <div className="max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between px-3 pt-7 pb-4">
            <div>
              <h2 className="text-sm font-medium text-gray-900 mb-1">Add your members</h2>
              <p className="text-sm text-gray-500">
                Add your members now or invite them to join on their own. You can always add more
                from your dashboard later.
              </p>
            </div>
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label="Close"
              onClick={onClose}
              className="flex-shrink-0 ml-4"
            >
              <X size={14} />
            </Button>
          </div>

          <div className="px-3 pb-8 flex flex-col gap-2">
            {/* Invite link banner */}
            <div className="flex items-center justify-between px-3 py-4 rounded-xl bg-brand-mist border border-[#0E628C33]">
              <div>
                <p className="text-xs text-gray-900 mb-0.5">Your community is ready to grow.</p>
                <p className="text-xs text-gray-500">
                  Copy this link and share it with your members to get them on Glass.
                </p>
              </div>
              <Button
                variant="outline"
                size="xs"
                fullWidth={false}
                onClick={copyLink}
                className="flex-shrink-0 ml-6"
              >
                <Copy size={12} />
                {linkCopied ? "Copied!" : "Copy Link"}
              </Button>
            </div>

            {/* Direct add card -- Glass/SurfaceContainerHigh (#F3F4F6) per
              Figma, distinct from the modal's own white background; already
              a real token (bg-stacked-container) used for nested panels
              elsewhere, just not wired in here. */}
            <div className="bg-surface-bg rounded-lg p-6 border border-surface-container-border">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Prefer To Add Members Directly?
              </h3>

              {/* Tabs */}
              <div className="flex gap-6 border-b border-gray-200 mb-5">
                {["upload", "manual"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`pb-2.5 text-sm font-medium capitalize bg-transparent cursor-pointer transition-all border-x-0 border-t-0 border-b-2 ${tab === t ? "text-brand border-b-brand" : "text-ink-faint border-b-transparent"}`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Upload tab */}
              {tab === "upload" && (
                <>
                  <p className="text-sm font-semibold text-gray-900 mb-4">Upload a CSV</p>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">
                      Upload a CSV file with following sample information
                    </p>
                    <Button
                      variant="tertiary"
                      size="xs"
                      fullWidth={false}
                      onClick={downloadTemplate}
                    >
                      <Download size={12} />
                      Download Template
                    </Button>
                  </div>

                  <div className="rounded-md overflow-x-auto mb-4 border border-surface-container-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          {[
                            "First Name",
                            "Last Name",
                            "Email Address",
                            "Phone Number",
                            "Member ID",
                            "Role/Title",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs font-medium text-gray-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-gray-100">
                          {[
                            "Muhammed",
                            "Dorachinma",
                            "Muha***med@**.com",
                            "0812990293",
                            "A23434",
                            "Student",
                          ].map((cell, i) => (
                            <td
                              key={i}
                              className={`px-4 py-3 ${i === 2 ? "text-brand underline" : "text-gray-900"}`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`w-full rounded-lg flex flex-col items-center justify-center py-14 cursor-pointer transition-all mb-5 min-h-[140px] border-2 border-dashed ${dragOver ? "bg-brand-wash border-brand" : "bg-surface-page border-[#D1D5DB]"}`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      aria-label="Upload members CSV file"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files[0])}
                    />
                    <img
                      src={uploadCloudIcon}
                      alt=""
                      className="w-[30px] h-[30px] mb-3"
                      loading="lazy"
                    />
                    {csvFile ? (
                      <p className="text-xs text-brand font-medium">
                        {csvFile.name} — {csvRows.length} rows
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Drag and Drop CSV here or{" "}
                        <span className="text-brand font-medium underline">Browse</span>
                      </p>
                    )}
                    {csvError && <p className="text-xs text-danger mt-2">{csvError}</p>}
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-2">Or Upload from URL</p>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        aria-label="CSV file URL"
                        value={fileUrl}
                        onChange={(e) => {
                          setFileUrl(e.target.value);
                          if (urlStage !== "idle") clearUrlUpload();
                        }}
                        placeholder="Add File URL"
                        className={inputCls}
                        disabled={urlStage === "fetching"}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth={false}
                        onClick={handleUrlUpload}
                        disabled={!fileUrl.trim() || urlStage === "fetching" || uploading}
                        className="flex-shrink-0"
                      >
                        Upload
                      </Button>
                    </div>

                    {urlStage === "fetching" && (
                      <div className="mt-3 rounded-lg flex flex-col items-center justify-center py-10 border-2 border-dashed border-brand bg-brand-wash">
                        <div className="relative w-16 h-16 mb-3">
                          <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="#E0E3F0"
                              strokeWidth="6"
                            />
                            <circle
                              cx="32"
                              cy="32"
                              r="28"
                              fill="none"
                              stroke="var(--color-brand)"
                              strokeWidth="6"
                              strokeDasharray={2 * Math.PI * 28}
                              strokeDashoffset={2 * Math.PI * 28 * (1 - urlProgress / 100)}
                              strokeLinecap="round"
                              className="transition-[stroke-dashoffset] duration-200 ease-linear"
                            />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-900">
                            {Math.round(urlProgress)}%
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-3">Uploading File...</p>
                        <Button
                          variant="outline-neutral"
                          size="xs"
                          fullWidth={false}
                          onClick={clearUrlUpload}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}

                    {urlStage === "complete" && urlFileInfo && (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg px-4 py-3 border border-surface-container-border">
                        <FileSpreadsheet size={20} className="text-success flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-900 truncate">{urlFileInfo.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            {urlFileInfo.sizeLabel} • <Check size={11} className="text-success" />{" "}
                            <span className="text-success font-medium">Complete</span>
                          </p>
                        </div>
                        <Button
                          variant="tertiary"
                          size="icon-sm"
                          aria-label="Remove file"
                          onClick={clearUrlUpload}
                          className="flex-shrink-0"
                        >
                          <X size={16} />
                        </Button>
                      </div>
                    )}
                  </div>

                  {csvRows.length > 0 && (
                    <Button onClick={handleUploadCSV} loading={uploading} className="mt-5">
                      {uploading ? "Sending invites…" : `Send Invites to ${csvRows.length} Members`}
                    </Button>
                  )}
                </>
              )}

              {/* Manual tab */}
              {tab === "manual" && (
                <>
                  <p className="text-sm font-medium text-gray-900 mb-2">Enter Email(s):</p>
                  <div
                    className={`rounded-lg p-3 flex flex-wrap items-center gap-2 mb-1 border min-h-[60px] bg-white focus-within:border-[#002FA7] transition-colors ${emailChipError ? "border-danger" : "border-surface-container-border"}`}
                  >
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
                          onClick={() => setEmails((arr) => arr.filter((_, idx) => idx !== i))}
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
                      onChange={(e) => {
                        setEmailInput(e.target.value);
                        setEmailChipError("");
                      }}
                      onKeyDown={handleEmailKeyDown}
                      onBlur={commitEmailChip}
                      placeholder={emails.length === 0 ? "Type an email and press Enter" : ""}
                      className="flex-1 min-w-[160px] outline-none text-sm bg-transparent border-none py-1"
                    />
                  </div>
                  {emailChipError ? (
                    <p className="text-xs text-danger mb-5">{emailChipError}</p>
                  ) : (
                    <div className="mb-4" />
                  )}

                  <p className="text-sm font-medium text-gray-900 mb-2">
                    Enter Phone Number(s){" "}
                    <span className="text-gray-400 font-normal">(Optional):</span>
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
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      className={`${inputCls} appearance-none !pr-9`}
                    >
                      {finalRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingExempt}
                      onChange={(e) => setBillingExempt(e.target.checked)}
                    />
                    Exempt from billing
                  </label>

                  {manualError && <p className="text-xs text-danger mb-3">{manualError}</p>}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendInvite}
                      disabled={emails.length === 0}
                      loading={manualLoading}
                      fullWidth={false}
                      className="px-6"
                    >
                      {manualLoading ? "Sending…" : "Send Invite"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
