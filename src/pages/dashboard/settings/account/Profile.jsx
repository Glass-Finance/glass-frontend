import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pencil, ShieldCheck } from "lucide-react";
import {
  useMe,
  useUpdateProfile,
  useRequestPhoneUpdate,
  useUpdatePhone,
} from "../../../../hooks/useMyAccount";
import { useFileUpload } from "../../../../hooks/useFileUpload";
import {
  updateEmail,
  requestEmailUpdate,
  deleteAccount,
  requestAccountDeletionCode,
} from "../../../../api/members";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { getEmailError } from "../../../../utils/validators";
import { useEscapeToClose } from "../../../../hooks/useKeyboardShortcuts";
import { isPhoneValid, PHONE_FORMAT_HINT } from "../../../../utils/phone";
import { useAuth } from "../../../../store/AuthContext";
import { parseUserData } from "../../../../utils/userData";
import { safeImageUrl } from "../../../../utils/safeImageUrl";
import EmailChangeModal from "../../../../components/common/EmailChangeModal";
import PhoneChangeModal from "../../../../components/common/PhoneChangeModal";
import { toTitleCase } from "../../../../utils/format";
import { Button } from "../../../../components/ui/Button";
import verifiedBadge from "../../../../assets/icons/verified-badge.webp";
import { toastSuccess } from "../../../../utils/toast";
import { DeleteAccountModal } from "./ProfileSections";
import { Skeleton } from "../../../../components/common/SkeletonUI";

// Phone frame (iPhone 16 - 93) draws the fields at r=4 (rounded-g-1, the
// design-system input radius); desktop keeps its existing rounded-lg.
const inputCls =
  "w-full h-12 min-h-8 px-4 py-1 rounded-g-1 md:rounded-lg text-black placeholder-black/60 text-placeholder outline-none transition-all border-[1.5px] focus:border-brand";

// Field labels: 14/500 black on the phone frame, the existing 12px grey on
// desktop.
const labelCls = "text-sm font-medium text-ink md:text-xs md:font-normal md:text-gray-600";

// The email/phone fields are read-only displays (the pencil opens the
// verified change flow). The phone frame draws them like the editable
// fields -- white, black text -- while desktop keeps the greyed treatment.
const readOnlyFieldCls =
  "bg-surface-container text-black md:bg-gray-50 md:text-gray-500 border-gray-300 flex items-center justify-between gap-2";

// Phone-only tap target over a read-only field. The phone frame draws no
// pencil, so the field itself opens the verified change flow. An overlay
// rather than a second copy of the field keeps the desktop markup untouched;
// md:hidden takes it out of layout and the a11y tree on desktop. Labelled
// distinctly from the desktop pencil so each control has its own name.
function MobileFieldTap({ label, onActivate }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      className="absolute inset-0 cursor-pointer md:hidden"
    />
  );
}

// ── Loading placeholder ─────────────────────────────────────────────────────
// One label + one input is the page's repeating unit, so the skeleton is built
// from that rather than guessing at the form's shape. Field wrappers are
// `flex flex-col gap-1.5` and inputs are `h-12 rounded-lg` (see inputCls), so
// the placeholders carry the same geometry and the form does not jump when the
// real fields arrive.
function ProfileFieldSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Skeleton className="h-3 w-24" tone="bg-gray-100" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}

// Stands in the four cards the page renders, in order: the main profile form,
// the two change-email / change-phone cards, and the danger-zone card. Card
// padding is copied from the real ones (`rounded-lg p-6` vs `rounded-xl` with a
// `px-6 py-4` header) so the stack keeps its shape.
function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-5 w-full" aria-busy="true">
      <div className="bg-surface-container rounded-lg p-6 border border-surface-container-border">
        <Skeleton className="h-4 w-20 mb-0.5" />
        <Skeleton className="h-3 w-56 mb-4" tone="bg-gray-100" />
        <div className="-mx-6 border-b border-gray-100 mb-5" />
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <ProfileFieldSkeleton />
          <ProfileFieldSkeleton />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <ProfileFieldSkeleton />
          <ProfileFieldSkeleton />
        </div>
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>

      {[0, 1].map((i) => (
        <div
          key={i}
          className="bg-surface-container rounded-xl border border-surface-container-border"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="p-6">
            <div className="max-w-md">
              <ProfileFieldSkeleton />
            </div>
            <Skeleton className="h-11 w-32 rounded-lg mt-5" />
          </div>
        </div>
      ))}

      <div className="bg-surface-container rounded-lg p-6 border border-surface-container-border">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-3 w-72 mb-5" tone="bg-gray-100" />
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user, isLoading: isMeLoading } = useMe();
  const { refreshUser, logout } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadFile = useFileUpload();
  const photoInputRef = useRef(null);

  // "profile" (normal view) | "email" | "phone" — the latter two swap the
  // Personal Information card for a dedicated Update/Add sub-card,
  // mirroring the member app's full-page equivalents but inline since this
  // is desktop. Seeded straight from ?verify=phone (the Dashboard banner's
  // deep link) so there's no flash of the normal profile view first.
  const [view, setView] = useState(() =>
    searchParams.get("verify") === "phone" ? "phone" : "profile",
  );

  const [form, setForm] = useState({ firstName: "", lastName: "" });
  const [savedForm, setSavedForm] = useState(form);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    firstName: "",
    lastName: "",
  });
  const [photoPreview, setPhotoPreview] = useState(null);

  const [emailDraft, setEmailDraft] = useState("");
  const [emailFieldError, setEmailFieldError] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const requestPhoneUpdate = useRequestPhoneUpdate();
  const updatePhone = useUpdatePhone();
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneFieldError, setPhoneFieldError] = useState("");
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const isPhoneUpdate = Boolean(user?.phoneVerified);

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState("warn"); // "warn" | "code"
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletionCode, setDeletionCode] = useState(Array(6).fill(""));

  useEscapeToClose(() => setDeleteModal(false), deleteModal);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  function closeDeleteModal() {
    setDeleteModal(false);
    setDeleteStep("warn");
    setDeleteConfirm("");
    setDeleteError("");
    setDeletionCode(Array(6).fill(""));
    setResendMessage("");
  }

  async function handleRequestDeletionCode() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await requestAccountDeletionCode();
      setDeleteStep("code");
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Failed to send verification code."));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleResendDeletionCode() {
    setResendLoading(true);
    setResendMessage("");
    setDeleteError("");
    try {
      await requestAccountDeletionCode();
      setResendMessage("Code resent.");
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Failed to resend code."));
    } finally {
      setResendLoading(false);
    }
  }

  async function handleConfirmDeletion() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteAccount(deletionCode.join(""));
      await logout();
      toastSuccess("Account deleted");
      navigate("/sign-in");
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Failed to delete account."));
      setDeleteLoading(false);
    }
  }

  const profileImageUrl = parseUserData(user).profileImage?.url ?? user?.profileImage?.url ?? null;
  // profileImageUrl is server-supplied; photoPreview is a local blob: from
  // URL.createObjectURL. Validate the value that reaches <img src> and drive
  // the guard from the same validated value, so a rejected scheme falls back to
  // the initials block.
  const photoSrc = safeImageUrl(photoPreview ?? profileImageUrl);

  useEffect(() => {
    if (!user) return;
    const ud = parseUserData(user);
    const loaded = {
      firstName: ud.firstName ?? user?.firstName ?? "",
      lastName: ud.lastName ?? user?.lastName ?? "",
    };
    // Syncs the editable form from the async-loaded `user` -- form/savedForm
    // are user-editable afterward, so this has to be an effect, not a
    // render-time derivation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(loaded);
    setSavedForm(loaded);
    setEmailDraft(user.email ?? "");
    setPhoneDraft(user.phoneNumber ?? ud.phone ?? "");
  }, [user]);

  // ?verify=phone only needs to seed the initial view (above) — strip it
  // from the URL once so a later refresh doesn't re-trigger the deep link.
  useEffect(() => {
    if (searchParams.get("verify") !== "phone") return;
    const next = new URLSearchParams(searchParams);
    next.delete("verify");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateField(field, value) {
    if (field === "firstName" && !value.trim()) return "First name is required.";
    if (field === "lastName" && !value.trim()) return "Last name is required.";
    return "";
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFieldErrors((fe) => (fe[name] ? { ...fe, [name]: validateField(name, value) } : fe));
  };

  const handleFieldBlur = (e) => {
    const { name, value } = e.target;
    if (!(name in fieldErrors)) return;
    setFieldErrors((fe) => ({ ...fe, [name]: validateField(name, value) }));
  };

  const isDirty = form.firstName !== savedForm.firstName || form.lastName !== savedForm.lastName;

  const handleSave = async () => {
    setError("");
    const nextFieldErrors = {
      firstName: validateField("firstName", form.firstName),
      lastName: validateField("lastName", form.lastName),
    };
    if (Object.values(nextFieldErrors).some(Boolean)) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    try {
      const userData = {};
      const firstName = toTitleCase(form.firstName.trim());
      const lastName = toTitleCase(form.lastName.trim());
      if (form.firstName !== savedForm.firstName) userData.firstName = firstName;
      if (form.lastName !== savedForm.lastName) userData.lastName = lastName;
      await updateProfile.mutateAsync({ username: user?.username, userData });
      await refreshUser();
      setForm((f) => ({ ...f, firstName, lastName }));
      setSavedForm((sf) => ({ ...sf, firstName, lastName }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 404
          ? "Profile setup incomplete — please contact support to finish setting up your account."
          : getErrorMessage(err, "Failed to save changes."),
      );
    }
  };

  async function handleStartEmailUpdate() {
    const trimmed = emailDraft.trim();
    const fieldErr = getEmailError(trimmed);
    if (fieldErr) {
      setEmailFieldError(fieldErr);
      return;
    }
    if (trimmed.toLowerCase() === user?.email?.toLowerCase()) {
      setEmailFieldError("That's already your current email address.");
      return;
    }
    setEmailFieldError("");
    setEmailSending(true);
    try {
      await requestEmailUpdate({ email: trimmed.toLowerCase() });
      setEmailModalOpen(true);
    } catch (err) {
      setEmailFieldError(
        getErrorMessage(err, "Couldn't send a code to that address. Please try again."),
      );
    } finally {
      setEmailSending(false);
    }
  }

  function handleEmailVerified() {
    setEmailModalOpen(false);
    setView("profile");
    refreshUser();
  }

  function handleWrongEmail() {
    setEmailModalOpen(false);
  }

  async function handleStartPhoneUpdate() {
    const trimmed = phoneDraft.trim();
    if (!isPhoneValid(trimmed)) {
      setPhoneFieldError(PHONE_FORMAT_HINT);
      return;
    }
    if (isPhoneUpdate && trimmed === user?.phoneNumber) {
      setPhoneFieldError("That's already your current phone number.");
      return;
    }
    setPhoneFieldError("");
    setPhoneSending(true);
    try {
      await requestPhoneUpdate.mutateAsync({ phoneNumber: trimmed });
      setPhoneModalOpen(true);
    } catch (err) {
      setPhoneFieldError(
        getErrorMessage(err, "Couldn't send a code to that number. Please try again."),
      );
    } finally {
      setPhoneSending(false);
    }
  }

  async function handleConfirmPhoneOtp(otp) {
    await updatePhone.mutateAsync({
      phoneNumber: phoneDraft.trim(),
      phoneVerificationOtp: otp,
    });
  }

  function handlePhoneVerified() {
    setPhoneModalOpen(false);
    setView("profile");
    refreshUser();
  }

  function handleWrongPhone() {
    setPhoneModalOpen(false);
  }

  const handlePhotoSelect = async (file) => {
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
    try {
      const uploadRes = await uploadFile.mutateAsync({
        file,
        fileCategory: "PROFILE_IMAGE",
      });
      const fileData = uploadRes.data?.data ?? uploadRes.data;
      const profileImageFileId = fileData?.id ?? fileData?.fileId;
      await updateProfile.mutateAsync({ userData: { profileImageFileId } });
      await refreshUser();
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 404
          ? "Profile setup incomplete — please contact support to finish setting up your account."
          : getErrorMessage(err, "Failed to upload photo."),
      );
    }
  };

  const displayName = `${form.firstName} ${form.lastName}`.trim() || user?.email || "—";
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  // `useMe()` is a 10-minute-cache query, so this is a no-op on any visit
  // inside that window -- but on a cold one the form used to render with
  // every field empty and then fill in, which reads as a half-built page and
  // lets the user touch fields before they exist. The whole page is replaced
  // here, including the danger card, so no interactive control is reachable
  // before the user's own data is on the page.
  if (isMeLoading) {
    return <ProfileSkeleton />;
  }

  return (
    // Phone frame (iPhone 16 - 93): 12px card padding and 8px between cards;
    // desktop keeps p-6 / gap-5.
    <div className="flex flex-col gap-2 md:gap-5 w-full">
      {view === "profile" && (
        <>
          <div className="bg-surface-container rounded-lg p-3 md:p-6 border border-surface-container-border">
            {/* Card heading is desktop-only: on the phone the breadcrumb
                directly above already says "Profile". */}
            <div className="hidden md:block">
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Profile</p>
              <p className="text-xs text-gray-500 mb-4">Manage your personal information</p>
              <div className="-mx-6 border-b border-gray-100 mb-5" />
            </div>

            {/* Phone: avatar and upload button centred and stacked. */}
            <div className="flex flex-col items-center gap-3 mb-4 md:flex-row md:mb-5">
              <div className="w-16 h-16 md:w-14 md:h-14 rounded-full bg-brand-mist flex items-center justify-center flex-shrink-0 overflow-hidden">
                {photoSrc ? (
                  <img src={photoSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                  <>
                    {/* Phone frame writes the initials dotted ("A.A"). */}
                    <span className="text-lg text-brand md:hidden">
                      {initials.split("").join(".")}
                    </span>
                    <span className="text-base text-brand hidden md:inline">{initials}</span>
                  </>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg"
                aria-label="Profile photo"
                className="hidden"
                onChange={(e) => handlePhotoSelect(e.target.files[0])}
              />
              <Button
                variant="outline"
                size="xs"
                fullWidth={false}
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadFile.isPending}
              >
                {uploadFile.isPending ? (
                  "Uploading…"
                ) : (
                  <>
                    <span className="md:hidden">Upload Picture</span>
                    <span className="hidden md:inline">Upload Photo</span>
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="settings-first-name" className={labelCls}>
                  First Name
                </label>
                <input
                  id="settings-first-name"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  onBlur={handleFieldBlur}
                  className={`${inputCls} ${fieldErrors.firstName ? "border-danger" : "border-gray-300"}`}
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-danger">{fieldErrors.firstName}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="settings-last-name" className={labelCls}>
                  Last Name
                </label>
                <input
                  id="settings-last-name"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  onBlur={handleFieldBlur}
                  className={`${inputCls} ${fieldErrors.lastName ? "border-danger" : "border-gray-300"}`}
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-danger">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 md:mb-5">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Email Address</label>
                <div className="flex items-center gap-2">
                  <div className={`relative ${inputCls} ${readOnlyFieldCls}`}>
                    <MobileFieldTap
                      label="Change email address"
                      onActivate={() => {
                        setEmailFieldError("");
                        setView("email");
                      }}
                    />
                    <span className="truncate">{user?.email ?? ""}</span>
                    {user?.emailVerified && (
                      <img
                        src={verifiedBadge}
                        alt="Verified"
                        className="w-[18px] h-[18px] flex-shrink-0"
                      />
                    )}
                  </div>
                  {/* Pencil is desktop-only: the phone frame (iPhone 16 - 93) draws
                      no edit control. Wrapped, not `hidden` on the Button, because
                      Button's own inline-flex would collide with it. */}
                  <span className="hidden md:inline-flex flex-shrink-0">
                    <Button
                      variant="tertiary"
                      size="icon-sm"
                      aria-label="Update email"
                      onClick={() => {
                        setEmailFieldError("");
                        setView("email");
                      }}
                      title="Update email"
                      className="flex-shrink-0"
                    >
                      <Pencil size={15} />
                    </Button>
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Phone Number</label>
                <div className="flex items-center gap-2">
                  <div className={`relative ${inputCls} ${readOnlyFieldCls}`}>
                    <MobileFieldTap
                      label={isPhoneUpdate ? "Change phone number" : "Add your phone number"}
                      onActivate={() => {
                        setPhoneFieldError("");
                        setView("phone");
                      }}
                    />
                    <span className="truncate">{user?.phoneNumber ?? ""}</span>
                    {user?.phoneVerified && (
                      <img
                        src={verifiedBadge}
                        alt="Verified"
                        className="w-[18px] h-[18px] flex-shrink-0"
                      />
                    )}
                  </div>
                  {/* Desktop-only, as the email pencil above. */}
                  <span className="hidden md:inline-flex flex-shrink-0">
                    <Button
                      variant="tertiary"
                      size="icon-sm"
                      aria-label={isPhoneUpdate ? "Update phone number" : "Add phone number"}
                      onClick={() => {
                        setPhoneFieldError("");
                        setView("phone");
                      }}
                      title={isPhoneUpdate ? "Update phone number" : "Add phone number"}
                      className="flex-shrink-0"
                    >
                      <Pencil size={15} />
                    </Button>
                  </span>
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-danger mb-3">{error}</p>}

            {/* Right-aligned to match the Community › Profile save row and
                the Update Password row in Security.jsx — the house pattern
                for a settings save action is `flex justify-end` + a
                content-hugging button, not a full-width one. No top margin:
                the field grid above carries mb-5.
                `sm-tighter` (h40 / 8px) rather than `sm` (h40 / 14px): the
                box is unchanged, only the label is dropped. This is below
                the button scale's 12px floor and is a deliberate owner
                exception, not a scale rung.
                Phone frame (iPhone 16 - 93): full width with the normal
                `sm` 14px label. `sm` and `sm-tighter` share the same h40
                box and padding, so md:text-[8px] restores the desktop
                sm-tighter label exactly; md:w-auto restores the hug. */}
            <div className="flex md:justify-end">
              <Button
                onClick={handleSave}
                disabled={updateProfile.isPending || !isDirty}
                variant="primary"
                size="sm"
                fullWidth={false}
                className="w-full md:w-auto md:text-[8px]"
              >
                {saved ? "Saved!" : updateProfile.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </>
      )}
      {view === "email" && (
        <>
          {/* No back link here: the breadcrumb above (Account › Profile) is
              the way out, and Figma's settings frames draw no such element. */}
          <div className="bg-surface-container rounded-xl border border-surface-container-border">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">Update Your Email</p>
            </div>
            <div className="p-6">
              <div className="flex flex-col gap-1.5 max-w-md">
                <label htmlFor="settings-email" className="text-xs text-gray-600">
                  Email Address
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value);
                    setEmailFieldError("");
                  }}
                  className={`${inputCls} ${emailFieldError ? "border-danger" : "border-gray-300"}`}
                  autoFocus
                />
                {emailFieldError && <p className="text-xs text-danger mt-1">{emailFieldError}</p>}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleStartEmailUpdate}
              loading={emailSending}
              fullWidth={false}
              size="sm"
              className="px-10 min-w-[320px]"
            >
              {emailSending ? "Sending Code…" : "Update"}
            </Button>
          </div>
        </>
      )}

      {view === "phone" && (
        <>
          {/* See the email view's identical comment above. */}
          <div className="bg-surface-container rounded-xl border border-surface-container-border">
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-900">
                {isPhoneUpdate ? "Update Your Phone Number" : "Add Your Phone Number"}
              </p>
            </div>
            <div className="p-6">
              {!isPhoneUpdate && (
                <p className="text-xs text-gray-500 mb-4">
                  We will use this number to send payments reminders and updates via WhatsApp or
                  SMS.
                </p>
              )}
              <div className="flex flex-col gap-1.5 max-w-md">
                <label htmlFor="settings-phone" className="text-xs text-gray-600">
                  Phone Number
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={phoneDraft}
                  onChange={(e) => {
                    setPhoneDraft(e.target.value);
                    setPhoneFieldError("");
                  }}
                  className={`${inputCls} ${phoneFieldError ? "border-danger" : "border-gray-300"}`}
                  autoFocus
                />
                {phoneFieldError && <p className="text-xs text-danger mt-1">{phoneFieldError}</p>}
              </div>
            </div>
          </div>

          {!isPhoneUpdate && (
            <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-brand-mist">
              <ShieldCheck size={18} className="text-brand flex-shrink-0 mt-0.5" />
              <p className="text-sm text-brand leading-snug m-0">
                Your number is only used for payment reminders and account recovery. We will never
                share it.
              </p>
            </div>
          )}

          <div className="flex justify-center">
            <Button
              onClick={handleStartPhoneUpdate}
              loading={phoneSending}
              fullWidth={false}
              size="sm"
              className="px-10 min-w-[320px]"
            >
              {phoneSending
                ? "Sending Code…"
                : isPhoneUpdate
                  ? "Update Phone Number"
                  : "Add Phone Number"}
            </Button>
          </div>
        </>
      )}

      {emailModalOpen && (
        <EmailChangeModal
          newEmail={emailDraft}
          onResend={() => requestEmailUpdate({ email: emailDraft.trim().toLowerCase() })}
          onSubmitOtp={(code) =>
            updateEmail({
              email: emailDraft.trim().toLowerCase(),
              emailVerificationOtp: code,
            })
          }
          onVerified={handleEmailVerified}
          onWrongEmail={handleWrongEmail}
          onClose={handleWrongEmail}
        />
      )}

      {phoneModalOpen && (
        <PhoneChangeModal
          newPhone={phoneDraft}
          isUpdate={isPhoneUpdate}
          onSubmitOtp={handleConfirmPhoneOtp}
          onVerified={handlePhoneVerified}
          onWrongNumber={handleWrongPhone}
          onResend={() => requestPhoneUpdate.mutateAsync({ phoneNumber: phoneDraft.trim() })}
          onClose={handleWrongPhone}
        />
      )}

      {deleteModal && (
        <DeleteAccountModal
          user={user}
          deleteStep={deleteStep}
          deleteConfirm={deleteConfirm}
          setDeleteConfirm={setDeleteConfirm}
          deleteError={deleteError}
          deleteLoading={deleteLoading}
          deletionCode={deletionCode}
          setDeletionCode={setDeletionCode}
          resendLoading={resendLoading}
          resendMessage={resendMessage}
          onClose={closeDeleteModal}
          onRequestCode={handleRequestDeletionCode}
          onResendCode={handleResendDeletionCode}
          onConfirmDeletion={handleConfirmDeletion}
        />
      )}

      {view === "profile" && (
        // Phone frame: 12px padding, 14px copy, and a full-width h40 Delete.
        // Desktop keeps p-6, 12px copy and the hugging xs (h32) button --
        // size="sm" plus md: overrides of xs's height/padding/label.
        <div className="bg-surface-container rounded-lg p-3 md:p-6 border border-surface-container-border">
          <p className="text-sm font-medium text-gray-900 mb-0.5">Delete Account</p>
          <p className="text-sm md:text-xs text-gray-500 mb-3 md:mb-4">
            Permanent actions that cannot be undone.
          </p>
          <div className="-mx-3 md:-mx-6 border-b border-gray-100 mb-3 md:mb-4" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-3">
            <p className="text-sm md:text-xs text-gray-700">
              Permanently remove your account and all associated data from Glass.
            </p>
            <Button
              variant="outline-caution"
              size="sm"
              onClick={() => setDeleteModal(true)}
              fullWidth={false}
              className="w-full md:w-auto md:h-8 md:px-3 md:text-[12px] flex-shrink-0"
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
