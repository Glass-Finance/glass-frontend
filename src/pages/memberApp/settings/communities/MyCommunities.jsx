import { useState } from "react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import { useNavigate } from "react-router-dom";
import { goBackInApp } from "../../../../utils/memberBack";
import { AlertTriangle, ChevronRight, Loader2, LogOut, Plus, X } from "lucide-react";
import { useMyCommunities, useLeaveCommunity } from "../../../../hooks/useMyAccount";
import { resolveIsPayingAdmin } from "../../../../utils/communityRole";
import PageLoadingState from "../../../../components/common/PageLoadingState";
import KycWizardModal from "../../../../components/kyc/KycWizardModal";
import { Button } from "../../../../components/ui/Button";
import { useKycGate } from "../../../../hooks/useKycGate";
import { MobileBackButton } from "../../../../components/ui/MobileBackButton";

function getInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function setActiveMemberCommunity(c) {
  try {
    localStorage.setItem(
      "glass_member_community",
      JSON.stringify({ id: c.id, slug: c.slug, name: c.name }),
    );
  } catch {
    /* ignore */
  }
}

// Real in-app disclaimer instead of the bare OS window.confirm() this used
// to rely on -- explains what leaving actually costs (payment history
// visibility, needing a fresh invite) rather than a one-line browser popup
// that's easy to blow past without reading.
function LeaveConfirmModal({ community, onCancel, onConfirm, leaving }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-[rgba(15,23,42,0.45)]"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] bg-white rounded-t-[20px] pt-6 px-5 pb-7"
      >
        <div className="flex justify-end">
          <Button
            variant="tertiary"
            size="icon-sm"
            aria-label="Cancel"
            onClick={onCancel}
            className=""
          >
            <X size={18} />
          </Button>
        </div>
        <div className="flex flex-col items-center text-center gap-2.5">
          <div className="w-[52px] h-[52px] rounded-full bg-danger-wash flex items-center justify-center mb-1">
            <AlertTriangle size={24} className="text-danger" />
          </div>
          <p className="text-[17px] font-bold text-ink m-0">Leave {community?.name}?</p>
          <p className="text-[13.5px] text-ink-muted m-0 leading-[1.55] max-w-[320px]">
            You'll lose access to this community's payment history and upcoming dues from your
            account, and you'll need a new invite to rejoin. This can't be undone from your side.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 mt-6">
          <Button
            onClick={onConfirm}
            loading={leaving}
            fullWidth={false}
            variant="critical"
            size="md"
            className="w-full"
          >
            {leaving ? "Leaving…" : "Yes, leave community"}
          </Button>
          <Button
            onClick={onCancel}
            disabled={leaving}
            fullWidth={false}
            variant="outline-neutral"
            size="md"
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MyCommunities() {
  const navigate = useNavigate();
  const { data: raw = [], isLoading } = useMyCommunities();
  const communities = raw.map((c) => ({
    ...c,
    name: c.name ?? c.community?.name,
    slug: c.slug ?? c.community?.slug,
    logo: c.logo ?? c.community?.logo,
    id: c.id ?? c.community?.id,
  }));
  const leaveCommunity = useLeaveCommunity();
  const [navigatingId, setNavigatingId] = useState(null);
  const [leavingCommunity, setLeavingCommunity] = useState(null);
  const kycGate = useKycGate();
  // KYC badge opens the wizard modal in place instead of routing away.
  const [kycWizardOpen, setKycWizardOpen] = useState(false);
  const closeKycWizard = () => {
    setKycWizardOpen(false);
    kycGate.closeGate();
  };
  // Done-after-approval resumes the blocked navigation into the community.
  const completeKycWizard = () => {
    setKycWizardOpen(false);
    kycGate.completeGate();
  };

  async function handleSelect(c) {
    if (c.owned) {
      // The gate stores this continuation and re-runs it after
      // verification instead of dumping the user back on this list.
      const enterCommunity = async () => {
        setNavigatingId(c.id);
        try {
          localStorage.setItem("glass_community", JSON.stringify(c));
          const isPaying = await resolveIsPayingAdmin(c.slug ?? c.id);
          const path = isPaying
            ? `/dashboard/admin/paying?community=${c.slug}`
            : `/dashboard/admin?community=${c.slug}`;
          navigate(path);
        } finally {
          setNavigatingId(null);
        }
      };
      kycGate.enforce(enterCommunity);
      return;
    }
    setActiveMemberCommunity(c);
    navigate("/member/home");
  }

  function handleLeave(e, c) {
    e.stopPropagation();
    setLeavingCommunity(c);
  }

  function confirmLeave() {
    if (!leavingCommunity) return;
    leaveCommunity.mutate(leavingCommunity.slug ?? leavingCommunity.id, {
      onSuccess: () => setLeavingCommunity(null),
    });
  }

  return (
    <div className="relative overflow-hidden pb-10 min-h-screen">
      <GlassLogoGlow />
      <div className="relative flex items-center justify-center pt-5 px-4 pb-4">
        <MobileBackButton
          aria-label="Back"
          onClick={() => goBackInApp(navigate, "/member/settings")}
          className="absolute left-4"
        />
        <h1 className="text-lg font-medium text-ink m-0">My Communities</h1>
      </div>

      <div className="pt-0 px-4 pb-4">
        <Button
          onClick={() => {
            kycGate.enforce(() => navigate("/onboarding/choose-path"));
          }}
          disabled={kycGate.isLoading}
          aria-busy={kycGate.isLoading}
          size="md"
          fullWidth={false}
        >
          {kycGate.isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <Plus size={16} />
              Create a Community
            </>
          )}
        </Button>
      </div>

      <KycWizardModal
        open={kycWizardOpen || kycGate.gateOpen}
        onClose={closeKycWizard}
        onComplete={completeKycWizard}
        historyPath="/member/verify-identity/history"
      />

      <div className="px-4">
        {isLoading ? (
          <PageLoadingState size={56} padding="36px 24px" />
        ) : communities.length === 0 ? (
          // Shaped like a real community row below (same w-11 h-11
          // rounded-xl avatar tile, same card layout) but dashed and empty.
          <div className="flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-surface-container-border">
            <div className="w-11 h-11 rounded-xl flex-shrink-0 border-2 border-dashed border-gray-200" />
            <p className="text-sm text-ink-ghost m-0">You haven't joined any communities yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {communities.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                disabled={navigatingId === c.id}
                className={`flex items-center gap-3 bg-white rounded-2xl p-3.5 border border-surface-container-border text-left w-full ${navigatingId === c.id ? "cursor-default opacity-70" : "cursor-pointer opacity-100"}`}
              >
                <div
                  className={`w-11 h-11 rounded-xl text-white flex items-center justify-center font-bold text-[13px] flex-shrink-0 overflow-hidden ${c.logo?.url ? "bg-transparent" : "bg-brand-deep"}`}
                >
                  {c.logo?.url ? (
                    <img
                      src={c.logo.url}
                      alt=""
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(c.name) || "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink m-0">{c.name}</p>
                  <p className="text-xs text-ink-ghost mt-0.5 mx-0 mb-0">
                    {c.owned ? "Admin" : "Member"}
                  </p>
                </div>
                {!c.owned ? (
                  <Button
                    variant="tertiary"
                    size="icon-sm"
                    aria-label="Leave community"
                    onClick={(e) => handleLeave(e, c)}
                    disabled={leaveCommunity.isPending}
                    title="Leave community"
                    className="flex-shrink-0"
                  >
                    <LogOut size={16} />
                  </Button>
                ) : navigatingId === c.id ? (
                  <div className="w-4 h-4 rounded-full border-2 border-surface-container-border [border-top-color:var(--color-brand)] flex-shrink-0 animate-[spin_0.7s_linear_infinite]" />
                ) : (
                  <ChevronRight size={16} className="text-[#ccc] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {leavingCommunity && (
        <LeaveConfirmModal
          community={leavingCommunity}
          leaving={leaveCommunity.isPending}
          onCancel={() => setLeavingCommunity(null)}
          onConfirm={confirmLeave}
        />
      )}
    </div>
  );
}
