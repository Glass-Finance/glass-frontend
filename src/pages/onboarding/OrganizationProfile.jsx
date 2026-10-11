/**
 * OrganizationProfile.jsx — wired to API
 *
 * Flow:
 *   1. Upload logo file → POST /api/v1/file/upload (fileCategory=COMMUNITY_LOGO)
 *      → returns { data: { id, url } }
 *   2. Create community → POST /api/v1/communities
 *      → returns { data: { id, slug, name, ... } }
 *   3. Store communityId + slug in router state, navigate to PaymentProfile
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Upload, Check, X as XIcon, Loader2, ArrowLeft } from "lucide-react";
import CloudImage from "../../components/common/CloudImage";
import KycWizardModal from "../../components/kyc/KycWizardModal";
import { createCommunity, updateCommunity } from "../../api/communities";
import { uploadFile } from "../../api/files";
import { useSlug } from "../../hooks/useSlug";
import { useAuth } from "../../store/AuthContext";
import { notifyError } from "../../utils/errorHandler";
import { isKycRequiredError } from "../../utils/kycStatus";
import { getEmailError } from "../../utils/validators";
import { resizeImageFile } from "../../utils/resizeImage";
import { safeImageUrl } from "../../utils/safeImageUrl";
import { saveOnboardingProgress, readOnboardingProgress } from "../../utils/onboardingProgress";
import { APP_ORIGIN, isMobileDevice } from "../../utils/deviceRedirect";
import StepIndicator from "../../components/onboarding/StepIndicator";
import OnboardingStepsSidebar from "../../components/onboarding/OnboardingStepsSidebar";
import { Button } from "../../components/ui/Button";

const INVITE_HOST = APP_ORIGIN.replace(/^https?:\/\//, "");

// Backend contract (glass-backend: AccessControlService
// .requireKycForCommunityStaff → GlobalExceptionHandler): community create
// rejects a creator whose KYC isn't APPROVED with HTTP 403 and description
// "Approved KYC is required for community staff participation". The
// ChoosePath gate normally stops this earlier, but that gate trusts a
// client-side summary — a stale one (status changed since page load) or a
// deep link straight into this form can still land here. The backend is the
// authority, so this submit treats its 403 as "verify, then resume" rather
// than a dead-end error string. The matcher itself lives in
// utils/kycStatus.js so every catch site recognizes the same rejection.

const CATEGORIES = [
  "Alumni Association",
  "Faith Community",
  "Professional Association",
  "Student Club",
  "University Club",
  "NGO / Non-profit",
  "Sports Club",
  "Other",
];

const COMPLETED_STEP_IDS = ["choose-path", "paying-member"];

const inputCls =
  "w-full h-12 min-h-8 border bg-stacked-container px-4 py-1 rounded-lg text-placeholder text-gray-800 placeholder-gray-400 outline-none focus:border-brand transition-all";

export default function OrganizationProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef(null);
  const queryClient = useQueryClient();

  // location.state doesn't survive a reload or a forced re-login mid-form
  // (see errorHandler.js/client.js's session-expiry redirect) -- fall back
  // to whatever was last persisted for this in-progress signup so a
  // dropped session doesn't also drop everything already typed.
  const savedProgress = readOnboardingProgress();
  const email = location.state?.email ?? savedProgress.email ?? "";
  const isPaying = location.state?.isPaying ?? savedProgress.isPaying ?? true;
  // Set once the community's actually been created (see handleSubmit) — if
  // present, this is a revisit (e.g. via PaymentProfile's Back button), and
  // submitting again must update that same community instead of creating a
  // second one.
  const existingCommunityId = location.state?.communityId ?? savedProgress.communityId ?? null;
  const existingCommunitySlug =
    location.state?.communitySlug ?? savedProgress.communitySlug ?? null;
  const { updateUser, isAuthenticated } = useAuth();

  // Covers users who already have an account (and so already have a
  // session) but end up here by accident — e.g. hitting back/forward or a
  // stale bookmark mid-onboarding. They shouldn't get stuck on this form
  // with no way out other than the browser back button.
  const handleBack = () => {
    navigate(isAuthenticated ? "/dashboard/home" : "/onboarding/choose-path", { state: { email } });
  };

  const [dragOver, setDragOver] = useState(false);
  const [logoFile, setLogoFile] = useState(null); // File object -- not persisted, re-picking a logo is a small ask next to losing the whole form
  const [logoUrl, setLogoUrl] = useState(null); // preview URL
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [kycWizardOpen, setKycWizardOpen] = useState(false);

  // logoUrl is only ever set from URL.createObjectURL(file), so it is already
  // a local blob: — but it flows into <img src>, and CodeQL cannot see
  // createObjectURL's guarantee, so it is validated through the same helper the
  // server-supplied URLs use. Consistency here means one code path to audit.
  const logoSrc = safeImageUrl(logoUrl);
  // Submission held by a KYC 403 — re-run from the wizard's onComplete
  // (which only fires on real approval), cleared on dismiss.
  const kycRetryRef = useRef(null);
  const [fieldErrors, setFieldErrors] = useState({
    communityName: "",
    category: "",
    contactEmail: "",
    slug: "",
    description: "",
  });

  const [form, setForm] = useState({
    communityName: savedProgress.form?.communityName ?? "",
    description: savedProgress.form?.description ?? "",
    category: savedProgress.form?.category ?? "",
    contactEmail: savedProgress.form?.contactEmail ?? email,
  });

  const { slug, setSlug, available, checking, suggesting, suggestFrom } = useSlug("COMMUNITY");

  // Restore a previously-entered slug once on mount (setSlug triggers the
  // hook's own debounced availability re-check, same as a manual edit).
  useEffect(() => {
    if (savedProgress.slug) setSlug(savedProgress.slug);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist as the admin types, so a dropped session mid-form loses at
  // most the last few keystrokes instead of the whole thing.
  useEffect(() => {
    saveOnboardingProgress({ form, slug, email, isPaying });
  }, [form, slug, email, isPaying]);

  function validateField(field, value) {
    if (field === "communityName" && !value.trim()) return "Community name is required.";
    if (field === "category" && !value) return "Please select a category.";
    if (field === "contactEmail") return getEmailError(value);
    if (field === "slug" && !value.trim()) return "Please choose a community URL slug.";
    if (field === "description") {
      const trimmed = value.trim();
      if (!trimmed) return "Tell members a bit about your community.";
      if (trimmed.length < 10) return "Description is too short — add a few more words.";
    }
    return "";
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((fe) => (fe[name] ? { ...fe, [name]: validateField(name, value) } : fe));
  };

  const handleFieldBlur = (field) => (e) =>
    setFieldErrors((fe) => ({ ...fe, [field]: validateField(field, e.target.value) }));

  const handleFile = (file) => {
    if (!file) return;
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // The submit body lives outside handleSubmit so a KYC-rejected submission
  // can re-run it as-is once the wizard approves — no re-validation of
  // fields the user already filled, and no lost form state.
  const runSubmit = async () => {
    setLoading(true);
    try {
      // 1. Upload logo (optional — skip if no file selected)
      let logoFileId = undefined;
      if (logoFile) {
        const resizedLogo = await resizeImageFile(logoFile);
        const uploadRes = await uploadFile(resizedLogo, "COMMUNITY_LOGO");
        logoFileId = uploadRes.data?.data?.id;
      }

      const payload = {
        name: form.communityName.trim(),
        slug: slug.trim(),
        description: form.description.trim(),
        category: [form.category],
        contactEmail: form.contactEmail.trim(),
        publicVisible: true,
        // Default to approval-required: with the public Discover page, an
        // open-join community would let absolutely anyone in unmoderated.
        // Admins can turn this off in Settings → Community → Member Access.
        requiresMemberApproval: true,
        ...(logoFileId ? { logoFileId } : {}),
      };

      // 2. Create the community, or update it if this is a revisit (e.g. via
      // PaymentProfile's Back button) -- posting again would create a second,
      // duplicate community rather than editing the one already made.
      const res = existingCommunityId
        ? await updateCommunity(existingCommunityId, payload)
        : await createCommunity(payload);

      const community = res.data?.data;
      if (!community?.id) throw new Error("Community creation failed.");

      // AuthContext's isAdmin reflects the communities list as of the last
      // login/refresh, which didn't include this community yet since it
      // didn't exist. Without this, ProtectedRoute's admin check bounces
      // straight to the member app, which then hits the device guard on
      // desktop and dead-ends at the QR handoff instead of the dashboard.
      updateUser({ isAdmin: true });

      // Both the dashboard's community list (["communities", "me", ...] in
      // useCommunities.js) and the member app's (["communities"] in
      // useMyAccount.js) cache for up to 5 minutes -- without this, landing
      // on Communities Home or My Communities within that window still
      // shows the pre-creation snapshot instead of refetching. Invalidating
      // the shared "communities" prefix covers both keys at once.
      queryClient.invalidateQueries({ queryKey: ["communities"] });

      // From here on, this community exists on the backend whether or not
      // the rest of onboarding completes -- persist the link to it so a
      // dropped session on the next two steps can resume instead of
      // stranding a half-configured community with no way back to it.
      saveOnboardingProgress({
        email,
        isPaying,
        communityId: community.id,
        communitySlug: community.slug,
        communityName: community.name,
      });

      navigate("/onboarding/payment-profile", {
        state: {
          email,
          isPaying,
          communityId: community.id,
          communitySlug: community.slug,
          communityName: community.name,
        },
      });
    } catch (err) {
      if (isKycRequiredError(err)) {
        // Backend overruled the client-side gate: hold this submission and
        // open the wizard. onComplete (approval-only) re-runs it; dismissing
        // the wizard drops it and the form keeps whatever the user typed.
        kycRetryRef.current = runSubmit;
        setKycWizardOpen(true);
        return;
      }
      setError(
        notifyError(err, {
          context: existingCommunityId ? "Update community" : "Create community",
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const nextFieldErrors = {
      communityName: validateField("communityName", form.communityName),
      category: validateField("category", form.category),
      contactEmail: validateField("contactEmail", form.contactEmail),
      slug: validateField("slug", slug),
      description: validateField("description", form.description),
    };
    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    // An unchanged slug on a revisit is taken -- by this same community --
    // so the live availability check would otherwise wrongly block re-saving.
    if (available === false && slug.trim() !== existingCommunitySlug) {
      setError("That URL slug is already taken — pick another.");
      return;
    }

    await runSubmit();
  };

  return (
    <div className="relative flex flex-col min-h-screen lg:overflow-hidden lg:h-screen bg-contain bg-center lg:bg-page-default">
      <div className="fixed inset-0 lg:hidden -z-10 bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />

      {/* Navbar */}
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
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 truncate max-w-[160px] lg:max-w-none">
              {email}
            </p>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Mobile step pill — replaces the sidebar stepper below lg */}
        <div className="lg:hidden px-4 pt-5">
          <StepIndicator stepId="organization" />
        </div>

        {/* Sidebar */}
        <OnboardingStepsSidebar activeStepId="organization" completedStepIds={COMPLETED_STEP_IDS} />

        {/* Main */}
        <main className="flex-1 lg:overflow-y-auto py-6 px-4 lg:py-10 lg:px-12 flex flex-col items-center">
          <form onSubmit={handleSubmit} className="w-full max-w-4xl">
            <div className="mb-8">
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
              <h2 className="text-xl font-medium text-gray-900 mb-1">
                Tell us about your community
              </h2>
              <p className="text-sm text-gray-500">
                This is how your community will appear to members on Glass.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Community Name *</label>
                <input
                  type="text"
                  name="communityName"
                  value={form.communityName}
                  onChange={handleChange}
                  onBlur={(e) => {
                    if (!slug) suggestFrom(form.communityName);
                    handleFieldBlur("communityName")(e);
                  }}
                  placeholder="e.g. Babcock University Alumni Association"
                  className={`${inputCls} ${fieldErrors.communityName ? "border-danger" : "border-gray-300"}`}
                />
                {fieldErrors.communityName && (
                  <span className="text-xs text-danger">{fieldErrors.communityName}</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Description *</label>
                <input
                  type="text"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  onBlur={handleFieldBlur("description")}
                  placeholder="Briefly describe what your community is about"
                  className={`${inputCls} ${fieldErrors.description ? "border-danger" : "border-gray-300"}`}
                />
                {fieldErrors.description && (
                  <span className="text-xs text-danger">{fieldErrors.description}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Category *</label>
                <div className="relative">
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    onBlur={handleFieldBlur("category")}
                    className={`${inputCls} appearance-none !pr-9 ${fieldErrors.category ? "border-danger" : "border-gray-300"}`}
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
                </div>
                {fieldErrors.category && (
                  <span className="text-xs text-danger">{fieldErrors.category}</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Community URL slug *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                      setSlug(v);
                      setFieldErrors((fe) =>
                        fe.slug ? { ...fe, slug: validateField("slug", v) } : fe,
                      );
                    }}
                    onBlur={(e) =>
                      setFieldErrors((fe) => ({
                        ...fe,
                        slug: validateField("slug", e.target.value),
                      }))
                    }
                    placeholder="e.g. babcock-alumni"
                    className={`${inputCls} pr-8 ${fieldErrors.slug ? "border-danger" : "border-gray-300"}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {(checking || suggesting) && (
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    )}
                    {!checking && !suggesting && available === true && (
                      <Check size={14} className="text-success" />
                    )}
                    {!checking && !suggesting && available === false && (
                      <XIcon size={14} className="text-danger" />
                    )}
                  </span>
                </div>
                {fieldErrors.slug && (
                  <span className="text-xs text-danger">{fieldErrors.slug}</span>
                )}
                {!fieldErrors.slug && available === false && !checking && (
                  <span className="text-xs text-danger">That URL is taken — try another.</span>
                )}
                {!fieldErrors.slug && available === true && !checking && (
                  <span className="text-xs text-success">
                    {INVITE_HOST}/member/join?community={slug}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Contact Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={form.contactEmail}
                  onChange={handleChange}
                  onBlur={handleFieldBlur("contactEmail")}
                  placeholder="e.g. contact@babcockalumni.org"
                  className={`${inputCls} ${fieldErrors.contactEmail ? "border-danger" : "border-gray-300"}`}
                />
                {fieldErrors.contactEmail ? (
                  <p className="text-xs text-danger">{fieldErrors.contactEmail}</p>
                ) : (
                  <p className="text-xs text-gray-400">
                    Where Glass and members can reach your community.
                  </p>
                )}
              </div>
            </div>

            {/* Logo upload */}
            <div className="flex flex-col gap-1.5 mb-8">
              <label className="text-sm font-medium text-gray-700">Community Logo</label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`w-full rounded-xl flex flex-col items-center justify-center py-12 px-6 cursor-pointer transition-all min-h-[200px] border-[1.5px] border-dashed ${dragOver ? "bg-brand-wash border-brand" : "bg-stacked-container border-hairline-neutral"}`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                {logoSrc ? (
                  <img src={logoSrc} alt="preview" className="h-16 object-contain mb-2" />
                ) : (
                  <Upload size={28} className="text-gray-400 mb-3" />
                )}
                <p className="text-sm text-gray-500 text-center">
                  <span className="font-medium underline text-brand">Upload</span> or Drag and Drop
                  Logo Here
                </p>
                <p className="text-xs text-gray-400 mt-1">(PNG or JPG, max 2MB.)</p>
              </div>
            </div>

            {error && <p className="text-sm text-danger mb-4">{error}</p>}

            <Button
              type="submit"
              disabled={checking || available === false}
              loading={loading}
              className="lg:w-1/2 mx-auto block"
            >
              {loading ? "Creating community..." : "Next"}
            </Button>
            <div className="h-[env(safe-area-inset-bottom,20px)] lg:hidden" />
          </form>
        </main>
      </div>

      {/* Backend-rejected create (KYC 403): verify here without leaving the
          form — approval re-runs the held submission from onComplete,
          dismissal drops it and keeps the page state. */}
      <KycWizardModal
        open={kycWizardOpen}
        onClose={() => {
          setKycWizardOpen(false);
          kycRetryRef.current = null;
        }}
        onComplete={() => {
          setKycWizardOpen(false);
          const retry = kycRetryRef.current;
          kycRetryRef.current = null;
          retry?.();
        }}
        historyPath={
          isMobileDevice()
            ? "/member/verify-identity/history"
            : "/dashboard/verify-identity/history"
        }
      />
    </div>
  );
}
