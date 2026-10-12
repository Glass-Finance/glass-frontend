import { useEffect, useRef, useState } from "react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useMe, useUpdateProfile } from "../../../../hooks/useMyAccount";
import { useFileUpload } from "../../../../hooks/useFileUpload";
import { useAuth } from "../../../../store/AuthContext";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { parseUserData } from "../../../../utils/userData";
import { safeImageUrl } from "../../../../utils/safeImageUrl";
import { toTitleCase } from "../../../../utils/format";
import { Button } from "../../../../components/ui/Button";
import { TextInput } from "../../../../components/ui/TextInput";
import verifiedBadge from "../../../../assets/icons/verified-badge.webp";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

// Only used for the two non-editable "display" boxes below (verified email/
// phone) -- real text fields (first/last name) use the shared TextInput
// component instead, which is also where the actual border color/radius
// spec lives now. Kept separate rather than reusing TextInput's own class
// string here since these aren't real <input> elements.
const readOnlyFieldCls =
  "w-full h-12 min-h-8 py-1 px-4 rounded-lg border-[1.5px] border-[#E0E0E0] text-placeholder text-ink outline-none box-border transition-all";

export default function Profile() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const updateProfile = useUpdateProfile();
  const uploadFile = useFileUpload();
  const { refreshUser } = useAuth();
  const photoInputRef = useRef(null);

  const [form, setForm] = useState({ firstName: "", lastName: "" });
  const [savedForm, setSavedForm] = useState(form);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (!user) return;
    const ud = parseUserData(user);
    const loaded = {
      firstName: ud.firstName ?? "",
      lastName: ud.lastName ?? "",
    };
    // Syncs the editable form from the async-loaded `user` -- form/savedForm
    // are user-editable afterward, so this has to be an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(loaded);
    setSavedForm(loaded);
  }, [user]);

  const isDirty = form.firstName !== savedForm.firstName || form.lastName !== savedForm.lastName;

  async function handleSave() {
    setError("");
    try {
      // Only send what changed — the success toast names the updated
      // field(s), so sending everything would always read "Profile updated".
      const userData = {};
      if (form.firstName !== savedForm.firstName)
        userData.firstName = toTitleCase(form.firstName.trim());
      if (form.lastName !== savedForm.lastName)
        userData.lastName = toTitleCase(form.lastName.trim());
      await updateProfile.mutateAsync({
        username: user?.username,
        userData,
      });
      // Reflect the capitalised names in the inputs immediately, matching
      // what was actually saved.
      const next = {
        ...form,
        firstName: toTitleCase(form.firstName.trim()),
        lastName: toTitleCase(form.lastName.trim()),
      };
      setForm(next);
      setSavedForm(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save changes."));
    }
  }

  async function handlePhotoSelect(file) {
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
    try {
      const uploadRes = await uploadFile.mutateAsync({ file, fileCategory: "PROFILE_IMAGE" });
      const profileImageFileId = uploadRes.data?.data?.id;
      // profileImageFileId only takes effect nested under userData -- the
      // backend accepts firstName/lastName/phoneNumber flat, but not this.
      await updateProfile.mutateAsync({ userData: { profileImageFileId } });
      await refreshUser();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to upload photo."));
    }
  }

  const ud = parseUserData(user);
  const photoUrl = ud.profileImage?.url ?? null;
  // photoUrl is server-supplied (/user/me -> userData.profileImage.url), so
  // its scheme is not ours to trust. photoPreview is a local blob: from
  // URL.createObjectURL. Validate the value that actually reaches <img src>
  // and let the same validated value drive the guard, so a rejected URL
  // falls back to the initials block instead of rendering a broken image.
  const photoSrc = safeImageUrl(photoPreview ?? photoUrl);
  const initials =
    `${form.firstName} ${form.lastName}`
      .trim()
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="relative overflow-hidden min-h-screen pb-10">
      <GlassLogoGlow />
      <div className="relative flex items-center justify-center pt-5 px-4 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="absolute left-4"
        />
        <h1 className="text-lg font-medium text-ink m-0">Profile</h1>
      </div>

      <div className="px-4">
        <div className="flex flex-col items-center gap-2 mb-5">
          <div className="w-16 h-16 rounded-full bg-brand-mist flex items-center justify-center overflow-hidden">
            {photoSrc ? (
              <img src={photoSrc} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <span className="text-xl font-semibold text-brand">{initials}</span>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handlePhotoSelect(e.target.files[0])}
          />
          <Button
            variant="tertiary"
            size="sm"
            fullWidth={false}
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadFile.isPending}
          >
            {uploadFile.isPending ? "Uploading…" : "Change Photo"}
          </Button>
          <p className="text-[13px] text-ink-ghost m-0">{isLoading ? "Loading…" : user?.email}</p>
        </div>

        <div className="border border-surface-container-border bg-white rounded-2xl p-4 flex flex-col gap-3.5">
          <div>
            <label className="text-xs text-ink-ghost block mb-1.5">First Name</label>
            <TextInput
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-ink-ghost block mb-1.5">Last Name</label>
            <TextInput
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-ink-ghost block mb-1.5">Email Address</label>
            <div className="flex items-center gap-2">
              <div
                className={`${readOnlyFieldCls} bg-[#F5F5F5] text-ink-ghost flex items-center justify-between gap-2`}
              >
                <span className="truncate">{user?.email ?? ""}</span>
                {user?.emailVerified && (
                  <img
                    src={verifiedBadge}
                    alt="Verified"
                    className="w-[18px] h-[18px] flex-shrink-0"
                  />
                )}
              </div>
              <Button
                variant="tertiary"
                size="icon-sm"
                aria-label="Update email"
                onClick={() => navigate("/member/update-email")}
                title="Update email"
                aria-label="Update email"
                className="flex-shrink-0"
              >
                <Pencil size={15} />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-ghost block mb-1.5">Phone Number</label>
            <div className="flex items-center gap-2">
              <div
                className={`${readOnlyFieldCls} bg-[#F5F5F5] text-ink-ghost flex items-center justify-between gap-2`}
              >
                <span className="truncate">{user?.phoneNumber ?? ""}</span>
                {user?.phoneVerified && (
                  <img
                    src={verifiedBadge}
                    alt="Verified"
                    className="w-[18px] h-[18px] flex-shrink-0"
                  />
                )}
              </div>
              <Button
                variant="tertiary"
                size="icon-sm"
                aria-label={user?.phoneVerified ? "Update phone number" : "Add phone number"}
                onClick={() => navigate("/member/verify-phone")}
                title={user?.phoneVerified ? "Update phone number" : "Add phone number"}
                aria-label={user?.phoneVerified ? "Update phone number" : "Add phone number"}
                className="flex-shrink-0"
              >
                <Pencil size={15} />
              </Button>
            </div>
          </div>
        </div>

        {error && <p className="text-[13px] text-danger mt-3 mx-1 mb-0">{error}</p>}

        <Button
          onClick={handleSave}
          disabled={!isDirty}
          loading={updateProfile.isPending}
          className="mt-4"
        >
          {saved ? "Saved!" : updateProfile.isPending ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
