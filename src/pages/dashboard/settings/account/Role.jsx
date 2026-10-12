import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { useActiveCommunityId } from "../../../../hooks/useActiveCommunityId";
import { useMyMemberRecord } from "../../../../hooks/useMyAccount";
import { updateCommunityMember } from "../../../../api/communities";
import { getErrorMessage } from "../../../../utils/errorHandler";
import { Skeleton } from "../../../../components/common/SkeletonUI";

const OPTIONS = [
  {
    id: "pays",
    title: "I Pay Dues",
    description:
      "You are a paying member. Payment reminders, due dates, and Auto-Pay apply to you like every other member.",
  },
  {
    id: "exempt",
    title: "I am exempt from payments",
    description:
      "You manage this community but do not contribute financially. No reminders will be sent to you and you will not appear in the unpaid members count.",
  },
];

export default function Role() {
  const communityId = useActiveCommunityId();
  const { data: memberRecord, isLoading, error: fetchError } = useMyMemberRecord(communityId);
  const queryClient = useQueryClient();

  const [role, setRole] = useState(null); // null until memberRecord loads
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Syncs from the async-loaded memberRecord -- `role` is also driven by
    // local toggle clicks and a mutation-failure rollback below, so it's
    // genuinely stateful, not a pure render-time derivation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (memberRecord) setRole(memberRecord.billingExempt ? "exempt" : "pays");
  }, [memberRecord]);

  const updateExemption = useMutation({
    mutationFn: (billingExempt) => {
      const memberId = memberRecord?.id ?? memberRecord?.memberId;
      if (!memberId) throw new Error("Member record not found.");
      return updateCommunityMember(communityId, memberId, { billingExempt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-record", communityId] });
      // The Members table derives per-member plan/paid counts from this same
      // member row (billingExempt) plus the community's obligations — both
      // change with this PATCH, and neither is under the member-record key.
      queryClient.invalidateQueries({ queryKey: ["community", communityId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["community", communityId, "obligations"] });
    },
  });

  async function handleSelect(id) {
    if (id === role || saving) return;
    setRole(id);
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await updateExemption.mutateAsync(id === "exempt");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Couldn't save your role. Please try again."));
      setRole(memberRecord?.billingExempt ? "exempt" : "pays");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    // Decorative placeholder. The wrapper is hidden from assistive tech and
    // aria-busy marks the region, so a screen-reader user is told the section
    // is loading rather than being handed a run of visual-only bars.
    return (
      <div aria-hidden="true" aria-busy="true" className="flex flex-col gap-5 w-full">
        <div>
          <Skeleton className="h-4 w-24 rounded mb-2" />
          <Skeleton className="h-3 w-56 rounded" />
        </div>
        <div className="bg-surface-container rounded-2xl p-6 border border-surface-container-border">
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-4 rounded-xl bg-gray-100 animate-pulse border-[1.5px] border-surface-container-border"
              >
                <Skeleton className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-32 rounded mb-2" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── No member record (admin owner with no member entry) ────────────────────
  if (fetchError || !memberRecord) {
    return (
      <div className="flex flex-col gap-5 w-full">
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">My role</p>
          <p className="text-xs text-gray-500">Define Your Membership and Payment participation</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-sm font-medium text-amber-800 mb-1">No member record found</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Your account doesn't have a member record in this community yet. This usually means you
            haven't been added as a paying member. Ask another admin to add you, or switch to a
            community where you have a member record.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Heading now lives inside the card, matching every other Settings
          card -- was the one page still keeping it in its own row above,
          with no divider. */}
      <div className="bg-surface-container rounded-2xl p-6 border border-surface-container-border">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 mb-0.5">My role</p>
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 size={13} className="animate-spin" /> Saving…
            </span>
          )}
          {saved && !saving && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Check size={13} /> Saved
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Define Your Membership and Payment participation
        </p>
        <div className="-mx-6 border-b border-gray-100 mb-4" />

        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt) => {
            const isSelected = role === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                disabled={saving}
                className={`flex items-start gap-3 px-4 py-4 rounded-xl text-left transition-all border-[1.5px]
                  ${isSelected ? "bg-brand-mist border-transparent" : "bg-transparent hover:bg-gray-50 border-transparent"}
                  ${saving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                {isSelected ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="flex-shrink-0 mt-0.5"
                  >
                    <rect
                      x="0.5"
                      y="0.5"
                      width="23"
                      height="23"
                      rx="11.5"
                      stroke="var(--color-brand)"
                    />
                    <circle cx="12" cy="12" r="8" fill="var(--color-brand)" />
                  </svg>
                ) : (
                  <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 bg-white border border-gray-300" />
                )}
                <div>
                  <p className="text-sm text-gray-900 mb-0.5">{opt.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save error */}
      {saveError && <p className="text-xs text-danger">{saveError}</p>}

      {/* Warning banner -- yellow, matching the Figma spec exactly (#FFFFE5). */}
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#FFFFE5]">
        <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          Changes take effect from the next billing cycle. Past payment records are not affected.
        </p>
      </div>
    </div>
  );
}
