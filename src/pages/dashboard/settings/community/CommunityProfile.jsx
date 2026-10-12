import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveCommunityId } from "../../../../hooks/useActiveCommunityId";
import { useEscapeToClose } from "../../../../hooks/useKeyboardShortcuts";
import { useCommunity, useUpdateCommunity } from "../../../../hooks/useCommunity";
import { useFileUpload } from "../../../../hooks/useFileUpload";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { resizeImageFile } from "../../../../utils/resizeImage";
import { safeImageUrl } from "../../../../utils/safeImageUrl";
import { deleteCommunity } from "../../../../api/communities";
import { Button } from "../../../../components/ui/Button";
import { APP_ORIGIN } from "../../../../utils/deviceRedirect";

const INVITE_HOST = APP_ORIGIN.replace(/^https?:\/\//, "");

const CATEGORIES = [
  "Alumni Association",
  "Faith Community",
  "Professional Association",
  "Student Club",
  "University Club",
  "NGO / Non-profit",
  "Sports Club",
  "School",
  "Other",
];

const inputCls =
  "w-full h-12 min-h-8 border border-gray-300 px-4 py-1 rounded-lg text-placeholder text-black placeholder-black/60 outline-none focus:border-brand transition-all";

export default function CommunityProfile() {
  const navigate = useNavigate();
  const communityId = useActiveCommunityId();
  const { data: community, isLoading } = useCommunity(communityId);
  const updateCommunity = useUpdateCommunity(communityId);
  const uploadFile = useFileUpload();
  const logoInputRef = useRef(null);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: "", category: "", description: "" });
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");

  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEscapeToClose(() => setDeleteModal(false), deleteModal);

  async function handleDeleteCommunity() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteCommunity(communityId);
      // The user's own account/session is untouched by deleting a
      // community -- no need to force a re-login. Just drop the stale
      // "active community" snapshot (it'd otherwise keep pointing at a
      // now-nonexistent community) and refresh the communities list before
      // heading back to the overview.
      localStorage.removeItem("glass_community");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      navigate("/dashboard/home");
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Failed to delete community."));
      setDeleteLoading(false);
    }
  }

  useEffect(() => {
    if (!community) return;
    // Syncs the editable form from the async-loaded community -- form stays
    // user-editable afterward, so this has to be an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      name: community.name ?? "",
      category: Array.isArray(community.category)
        ? (community.category[0] ?? "")
        : (community.category ?? ""),
      description: community.description ?? "",
    });
  }, [community]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (name === "name" && nameError)
      setNameError(value.trim() ? "" : "Community name is required.");
  };

  const handleNameBlur = (e) =>
    setNameError(e.target.value.trim() ? "" : "Community name is required.");

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) {
      setNameError("Community name is required.");
      return;
    }
    try {
      await updateCommunity.mutateAsync({
        name: form.name,
        category: [form.category],
        description: form.description,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save changes."));
    }
  };

  const handleLogoSelect = async (file) => {
    if (!file || !communityId) return;
    setLogoPreview(URL.createObjectURL(file));
    setError("");
    try {
      const resized = await resizeImageFile(file);
      const uploadRes = await uploadFile.mutateAsync({
        file: resized,
        fileCategory: "COMMUNITY_LOGO",
      });
      const fileData = uploadRes.data?.data ?? uploadRes.data;
      const logoFileId = fileData?.id ?? fileData?.fileId;
      await updateCommunity.mutateAsync({ logoFileId });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to upload logo."));
    }
  };

  const initials = (community?.name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  // community.logo.url / community.logoUrl are server-supplied; logoPreview is
  // a local blob: from URL.createObjectURL. Validate the value that reaches
  // <img src> and drive the guard from it, so a rejected scheme falls through
  // to the initials text.
  const logoSrc = safeImageUrl(logoPreview ?? community?.logo?.url ?? community?.logoUrl);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Community Information -- heading, logo, and fields all in one
          card, matching Figma (was two separate cards: a bare "Profile"
          heading + logo row, then a second card for the fields). ── */}
      <div className="bg-surface-container rounded-lg px-5 pt-4 pb-5 border border-surface-container-border">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Community Information</p>
        <p className="text-xs text-gray-500 mb-4">
          This is how your information will appear across glass
        </p>
        <div className="-mx-5 border-b border-gray-100 mb-4" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs text-brand flex-shrink-0 overflow-hidden bg-brand-mist">
              {logoSrc ? (
                <img src={logoSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                initials || "C"
              )}
            </div>
            <div>
              <p className="text-sm text-gray-900">
                {isLoading ? "Loading…" : (community?.name ?? "Community")}
              </p>
              <p className="text-xs text-gray-500">
                {community?.slug ? `${INVITE_HOST}/member/join?community=${community.slug}` : ""}
              </p>
            </div>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => handleLogoSelect(e.target.files[0])}
          />
          <Button
            variant="outline"
            size="xs"
            fullWidth={false}
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadFile.isPending}
          >
            {uploadFile.isPending ? "Uploading…" : "Change Logo"}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Community Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              onBlur={handleNameBlur}
              className={inputCls}
              style={nameError ? { borderColor: "var(--color-danger)" } : undefined}
            />
            {nameError && <p className="text-xs text-danger mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Category</label>
            {/* Native select's own arrow sits flush against the box edge with
                no controllable gap -- appearance-none drops it in favor of a
                custom triangle with proper right-margin breathing room. */}
            <div className="relative">
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className={`${inputCls} appearance-none !pr-9`}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 border-l-4 border-r-4 border-t-[6px] border-l-transparent border-r-transparent border-t-black" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
            {/* inputCls's h-12 (sized for single-line inputs) was squashing
                this field to one line's worth of height despite rows={3},
                leaving the text pinned near the top with dead space below
                instead of a proper 3-row box. */}
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
              className={`${inputCls} resize-none !h-auto !min-h-[88px] !py-3`}
            />
          </div>
        </div>

        {error && <p className="text-xs text-danger mt-3">{error}</p>}

        <div className="flex justify-end mt-4">
          <Button
            onClick={handleSave}
            disabled={updateCommunity.isPending}
            variant="outline"
            size="sm"
          >
            {saved ? "Saved!" : updateCommunity.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Joining & visibility toggles live in Settings → Community → Member
          Access (single write path via the dedicated settings endpoint) —
          deliberately not duplicated here. */}

      {/* ── Delete Community — owners only. Promoted admins manage the
          community but don't get its destructive controls. ── */}
      {community?.owned && (
        <div className="bg-surface-container rounded-lg p-6 border border-surface-container-border">
          <p className="text-sm font-medium text-gray-900 mb-0.5">Delete Community</p>
          <p className="text-xs text-gray-500 mb-4">Permanent actions that cannot be undone.</p>
          <div className="-mx-6 border-b border-gray-100 mb-4" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-700">
              Permanently remove this community and all associated data from Glass.
            </p>
            <Button
              variant="outline-caution"
              size="xs"
              onClick={() => setDeleteModal(true)}
              fullWidth={false}
              className="self-start sm:self-auto flex-shrink-0"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {deleteModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/20">
          <div className="bg-surface-bg rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-surface-container-border">
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-danger-tint">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-danger)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>

            <h3 className="text-base font-semibold text-gray-900 mb-1">Delete Community</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              This will permanently delete{" "}
              <strong className="text-gray-800">{community?.name}</strong> and all associated
              members, payments, and data. This cannot be undone.
            </p>

            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Type <strong>{community?.name}</strong> to confirm
            </label>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={community?.name ?? ""}
              className="w-full h-12 min-h-8 border border-gray-300 px-4 py-1 rounded-lg text-placeholder outline-none focus:border-[#002FA7] mb-4 transition-all"
            />

            {deleteError && <p className="text-xs text-danger mb-3">{deleteError}</p>}

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setDeleteModal(false);
                  setDeleteConfirm("");
                  setDeleteError("");
                }}
                disabled={deleteLoading}
                fullWidth={false}
                variant="outline-neutral"
                size="sm"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteCommunity}
                disabled={deleteConfirm !== community?.name}
                loading={deleteLoading}
                fullWidth={false}
                variant="critical"
                size="sm"
                className="flex-1"
              >
                {deleteLoading ? "Deleting…" : "Delete Community"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
