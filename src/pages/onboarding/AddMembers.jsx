/**
 * AddMembers.jsx — wired to API
 *
 * Two paths:
 *   A) Invite link  — just show + copy the link, no API call
 *   B) CSV upload   — POST /api/v1/file/upload → then backend processes
 *   C) Manual entry — POST /api/v1/communities/{id}/members per row (batched)
 *
 * Success → show modal → navigate to /dashboard/{slug}/home
 *
 * Invite link format: {APP_ORIGIN}/member/join?community={communitySlug}
 */
import { useState, useEffect, useRef } from "react";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Copy, ArrowLeft } from "lucide-react";
import CloudImage from "../../components/common/CloudImage";
import { notifyError } from "../../utils/errorHandler";
import { APP_ORIGIN } from "../../utils/deviceRedirect";
import { toastProgress, toastSuccess } from "../../utils/toast";
import { useRoles } from "../../hooks/useCommunityMembers";
import { bulkCreateCommunityInvites } from "../../api/invites";
import { readOnboardingProgress, clearOnboardingProgress } from "../../utils/onboardingProgress";
import StepIndicator from "../../components/onboarding/StepIndicator";
import OnboardingStepsSidebar from "../../components/onboarding/OnboardingStepsSidebar";
import { useAuth } from "../../store/AuthContext";
import { Button } from "../../components/ui/Button";
import {
  ALLOWED_ROLE_NAMES,
  FALLBACK_ROLES,
  COMPLETED_STEP_IDS,
  parseCsvText,
  parseCsvFile,
  parseCsvFromUrl,
  csvRowToMember,
} from "./addMembersUtils";
import SuccessModal from "./members/SuccessModal";
import UploadMembersTab from "./members/UploadMembersTab";
import ManualMembersTab from "./members/ManualMembersTab";

// Confirmed against the live backend (GET /roles/community, 2026-07-12):
// only these three roles actually exist -- COMMUNITY_OWNER, COMMUNITY_ADMIN,
// COMMUNITY_MEMBER. "Admin" and "Treasurer" never matched anything real, so
// this dropdown silently only ever offered "Community Member" no matter how
// many roles the backend returned. Matches the same allowlist Members.jsx
// uses for consistency between the two places a role gets assigned.
const inputCls =
  "w-full h-12 min-h-8 border border-outline-input px-4 py-1 rounded-lg text-placeholder text-gray-800 placeholder-gray-400 outline-none focus:border-brand transition-all";

export default function AddMembers() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const fileRef = useRef(null);
  const { data: rolesData, isLoading: rolesLoading } = useRoles();
  const roles = rolesData ? rolesData.filter((r) => ALLOWED_ROLE_NAMES.has(r.name)) : [];
  const finalRoles = roles.length ? roles : FALLBACK_ROLES;

  // Same fallback as PaymentProfile.jsx -- location.state doesn't survive a
  // reload or forced re-login, and the community already exists on the
  // backend by this point.
  const { email, isPaying, communityId, communitySlug, communityName } =
    location.state ?? readOnboardingProgress();

  // Same escape hatch as OrganizationProfile.jsx's own handleBack: an
  // already-authenticated user goes straight to their dashboard instead of
  // stepping back into the middle of onboarding.
  const handleBack = () => {
    if (isAuthenticated) {
      navigate("/dashboard/home");
      return;
    }
    navigate("/onboarding/payment-profile", {
      state: { email, isPaying, communityId, communitySlug, communityName },
    });
  };

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [billingExempt, setBillingExempt] = useState(false);

  // Set default to "Community Member" once roles resolve
  useEffect(() => {
    if (finalRoles.length && !selectedRoleId) {
      const memberRole = finalRoles.find((r) => r.name === "Community Member") ?? finalRoles[0];
      // Defaults once roles resolve; selectedRoleId is also user-editable
      // via the role picker afterward.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (memberRole?.id) setSelectedRoleId(memberRole.id);
    }
  }, [finalRoles]); // eslint-disable-line react-hooks/exhaustive-deps

  // /join/{slug} isn't a route this app has ever had — it fell through to
  // the catch-all and silently redirected to the public homepage, so this
  // link has never actually worked. /member/join is the real entry point;
  // ?community= (read by useJoinCommunityParam) tells it which community
  // to file a join request for once the visitor registers or signs in.
  //
  // window.location.origin instead of a hardcoded domain — confirmed live
  // that "app.glasspay.app" (used in the other invite-link generator)
  // doesn't resolve at all (DNS_PROBE_FINISHED_NXDOMAIN, not just a wrong
  // route). Using the origin actually being viewed from means this can
  // never point at a dead domain in dev, staging, or prod.
  const inviteLink = communitySlug
    ? `${APP_ORIGIN}/member/join?community=${communitySlug}`
    : APP_ORIGIN;

  const [tab, setTab] = useState("upload");
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [copied, copy] = useCopyToClipboard();
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Manual tab — chip-based email entry instead of a full per-row table.
  // No name/role fields are collected here, so these go through the same
  // bulk-add endpoint as an {email}-only (+ optional phone) member record.
  const [emails, setEmails] = useState([]);
  const [emailInput, setEmailInput] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState("");

  // URL upload — a simulated progress sequence (the underlying fetch+parse
  // has no natural byte-level progress signal worth wiring up for a CSV
  // that's typically tiny) so the wait doesn't feel like nothing's happening.
  const [urlStage, setUrlStage] = useState("idle"); // idle | fetching | complete
  const [urlProgress, setUrlProgress] = useState(0);
  const [urlFileInfo, setUrlFileInfo] = useState(null); // { name, sizeLabel }
  const [urlCsvText, setUrlCsvText] = useState(null);

  // Guards handleUrlUpload's post-fetch state updates if this page unmounts
  // (e.g. the user navigates away) while a URL fetch is still in flight.
  const unmountedRef = useRef(false);
  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    [],
  );

  const copyLink = () => copy(inviteLink);

  const handleFile = (file) => {
    if (file) setUploadedFile(file);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  function commitEmailChip() {
    const val = emailInput.trim().replace(/[,;]+$/, "");
    if (val && !emails.includes(val)) setEmails((arr) => [...arr, val]);
    setEmailInput("");
  }
  function handleEmailKeyDown(e) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      commitEmailChip();
    } else if (e.key === "Backspace" && !emailInput && emails.length > 0) {
      setEmails((arr) => arr.slice(0, -1));
    }
  }
  const removeEmailChip = (i) => setEmails((arr) => arr.filter((_, idx) => idx !== i));

  async function handleUrlUpload() {
    const url = fileUrl.trim();
    if (!url) return;
    // Validate URL scheme — only allow https: to prevent SSRF via file://,
    // http://localhost, or other internal protocols.
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      setError("Please enter a valid URL.");
      return;
    }
    if (parsed.protocol !== "https:") {
      setError("Only HTTPS URLs are allowed.");
      return;
    }
    setError("");
    setUrlStage("fetching");
    setUrlProgress(8);
    const tick = setInterval(() => {
      setUrlProgress((p) => (p < 88 ? p + Math.random() * 18 : p));
    }, 250);
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
      setUrlCsvText(text);
      setUrlStage("complete");
    } catch (err) {
      clearInterval(tick);
      if (unmountedRef.current) return;
      setUrlStage("idle");
      setUrlProgress(0);
      setError(notifyError(err, { context: "Upload from URL" }));
    }
  }
  function clearUrlUpload() {
    setUrlStage("idle");
    setUrlProgress(0);
    setUrlFileInfo(null);
    setUrlCsvText(null);
    setFileUrl("");
  }

  async function handleSendInvite() {
    if (emails.length === 0) return;
    setError("");
    setLoading(true);
    try {
      if (!communityId) {
        setError("Community ID missing — go back and retry.");
        return;
      }
      if (!selectedRoleId) {
        setError("Roles are still loading — please wait a moment.");
        return;
      }
      const toastId = toastProgress("Sending invites…", "Usually takes 5–10 seconds");
      await bulkCreateCommunityInvites(communityId, {
        invites: emails.map((email) => ({
          email,
          roleId: selectedRoleId,
          billingExempt,
        })),
      });
      toastSuccess(`${emails.length} invite${emails.length === 1 ? "" : "s"} sent`, {
        id: toastId,
      });
      setEmails([]);
      setPhoneNumbers("");
      setShowSuccess(true);
    } catch (err) {
      setError(
        notifyError(err, {
          context: "Send invites",
          fallback: "Failed to send invites. You can add members from the dashboard later.",
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      let members;
      if (uploadedFile) {
        members = (await parseCsvFile(uploadedFile)).map((row) =>
          csvRowToMember(row, rolesData, selectedRoleId),
        );
      } else if (urlCsvText) {
        members = parseCsvText(urlCsvText).map((row) =>
          csvRowToMember(row, rolesData, selectedRoleId),
        );
      } else if (fileUrl.trim()) {
        members = (await parseCsvFromUrl(fileUrl.trim())).map((row) =>
          csvRowToMember(row, rolesData, selectedRoleId),
        );
      } else {
        members = [];
      }

      const filled = members.filter((m) => m.email);
      if (filled.length === 0) {
        setShowSuccess(true);
        return;
      }
      if (!communityId) {
        setError("Community ID missing — go back and retry.");
        return;
      }

      const toastId = toastProgress("Sending invites…", "Usually takes 5–10 seconds");
      await bulkCreateCommunityInvites(communityId, {
        invites: filled.map((m) => ({ email: m.email, roleId: m.roleId })),
      });
      toastSuccess(`${filled.length} invite${filled.length === 1 ? "" : "s"} sent`, {
        id: toastId,
      });
      setShowSuccess(true);
    } catch (err) {
      setError(
        notifyError(err, {
          context: "Send invites",
          fallback: "Failed to send invites. You can invite members from the dashboard later.",
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    // Onboarding is done -- nothing left to recover, and keeping this
    // around risks bleeding into a later, unrelated community's setup.
    clearOnboardingProgress();
    if (communitySlug || communityId) {
      // Matches the ?community= convention AdminDashboard/Sidebar read from —
      // there's no /dashboard/:slug/home route, so navigating there 404s
      // straight back to the landing page via the catch-all route.
      localStorage.setItem(
        "glass_community",
        JSON.stringify({
          id: communityId,
          slug: communitySlug,
          name: communityName,
        }),
      );
      navigate(`/dashboard/admin?community=${communitySlug ?? communityId}`, {
        replace: true,
      });
    } else {
      navigate("/dashboard/home", { replace: true });
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen lg:overflow-hidden lg:h-screen bg-contain bg-center lg:bg-page-default">
      <div className="fixed inset-0 lg:hidden -z-10 bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />

      <header className="relative flex items-center justify-between px-4 lg:px-8 py-4 bg-surface-container border-b border-outline-on-surface flex-shrink-0">
        <div className="flex items-center gap-2">
          <CloudImage
            publicId="glass/Glass"
            alt="Glass"
            width={56}
            objectFit="contain"
            className="w-7 h-7"
          />
          <span className="font-medium text-base text-gray-900">Glass</span>
        </div>
        <div className="flex items-center gap-4">
          <Bell size={20} className="text-gray-400 hidden lg:block" />
          <p className="text-sm text-gray-600 truncate max-w-[160px] lg:max-w-none">{email}</p>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Mobile step pill — replaces the sidebar stepper below lg */}
        <div className="lg:hidden px-4 pt-5">
          <StepIndicator stepId="members" />
        </div>

        {/* Sidebar */}
        <OnboardingStepsSidebar activeStepId="members" completedStepIds={COMPLETED_STEP_IDS} />

        {/* Main */}
        <main className="flex-1 lg:overflow-y-auto py-6 px-4 lg:py-10 lg:px-12">
          <div className="w-full max-w-4xl">
            <div className="mb-6">
              <Button
                variant="tertiary"
                size="sm"
                fullWidth={false}
                type="button"
                onClick={handleBack}
                className="mb-4 -ml-1"
              >
                <ArrowLeft size={15} />
                {isAuthenticated ? "Back to dashboard" : "Back"}
              </Button>
              <h2 className="text-base font-medium text-gray-900 mb-1">Add your members</h2>
              <p className="text-sm text-gray-500">
                Add members now or invite them to join. You can always add more from your dashboard
                later.
              </p>
            </div>

            {/* Invite banner */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-5 py-4 rounded-xl mb-6 bg-brand-mist border border-[#0E628C33]">
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
                className="flex-shrink-0 lg:ml-6"
              >
                <Copy size={12} />
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </div>

            {/* Direct add card */}
            <div className="bg-white rounded-lg p-4 lg:p-6 border border-hairline-neutral">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
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
                <UploadMembersTab
                  uploadedFile={uploadedFile}
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  fileRef={fileRef}
                  handleFile={handleFile}
                  handleDrop={handleDrop}
                  fileUrl={fileUrl}
                  setFileUrl={setFileUrl}
                  urlStage={urlStage}
                  urlProgress={urlProgress}
                  urlFileInfo={urlFileInfo}
                  handleUrlUpload={handleUrlUpload}
                  clearUrlUpload={clearUrlUpload}
                  loading={loading}
                  error={error}
                  inputCls={inputCls}
                />
              )}

              {/* Manual tab */}
              {tab === "manual" && (
                <ManualMembersTab
                  emails={emails}
                  emailInput={emailInput}
                  setEmailInput={setEmailInput}
                  handleEmailKeyDown={handleEmailKeyDown}
                  commitEmailChip={commitEmailChip}
                  removeEmailChip={removeEmailChip}
                  phoneNumbers={phoneNumbers}
                  setPhoneNumbers={setPhoneNumbers}
                  selectedRoleId={selectedRoleId}
                  setSelectedRoleId={setSelectedRoleId}
                  rolesLoading={rolesLoading}
                  finalRoles={finalRoles}
                  billingExempt={billingExempt}
                  setBillingExempt={setBillingExempt}
                  error={error}
                  loading={loading}
                  handleSendInvite={handleSendInvite}
                  inputCls={inputCls}
                />
              )}
            </div>

            {tab === "upload" && (
              <Button
                onClick={handleSubmit}
                disabled={urlStage === "fetching"}
                loading={loading}
                className="lg:w-1/2 mx-auto block mt-6"
              >
                {loading ? "Adding members…" : "Create Your Community"}
              </Button>
            )}
            <div className="h-[env(safe-area-inset-bottom,20px)] lg:hidden" />
          </div>
        </main>
      </div>

      {showSuccess && (
        <SuccessModal communityName={communityName} onDashboard={goToDashboard} onCopy={copyLink} />
      )}
    </div>
  );
}
