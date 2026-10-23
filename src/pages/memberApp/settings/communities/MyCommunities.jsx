import { useState } from "react";
import GlassLogoGlow from "../../../../components/memberApp/GlassLogoGlow";
import { useNavigate } from "react-router-dom";
import { goBackInApp } from "../../../../utils/memberBack";
import { AlertTriangle, ChevronRight, Loader2, LogOut, MoreVertical, Plus, X } from "lucide-react";
import { useMyCommunities, useLeaveCommunity } from "../../../../hooks/useMyAccount";
import { resolveIsPayingAdmin } from "../../../../utils/communityRole";
import { CommunityCardsSkeleton } from "../../../../components/memberApp/MemberPageSkeletons";
import communityEmptyIllustration from "../../../../assets/memberApp/empty-states/my-communities-icon.svg";
import KycWizardModal from "../../../../components/kyc/KycWizardModal";
import { Button } from "../../../../components/ui/Button";
import { useKycGate } from "../../../../hooks/useKycGate";
import MemberPageHeader from "../../../../components/memberApp/MemberPageHeader";

function getInitials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getMemberCount(community) {
  return (
    community.memberCount ??
    community.membersCount ??
    community.totalMembers ??
    community.metrics?.activeMembers ??
    community.metrics?.totalMembers ??
    null
  );
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

function CommunityEmptyIllustration() {
  return (
    <img
      src={communityEmptyIllustration}
      alt=""
      aria-hidden="true"
      className="h-20 w-20 flex-shrink-0 object-contain"
      draggable={false}
      loading="lazy"
    />
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
  const [roleFilter, setRoleFilter] = useState("All");
  const [openMenuId, setOpenMenuId] = useState(null);
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

  function createCommunity() {
    kycGate.enforce(() => navigate("/onboarding/choose-path"));
  }

  const adminCount = communities.filter((community) => community.owned).length;
  const memberCount = communities.length - adminCount;
  const visibleCommunities = communities.filter((community) => {
    if (roleFilter === "Admin") return community.owned;
    if (roleFilter === "Member") return !community.owned;
    return true;
  });

  function renderCommunityCard(c) {
    const count = getMemberCount(c);
    const role = c.owned ? "Admin" : "Member";
    const isMenuOpen = openMenuId === c.id;

    return (
      <article
        key={c.id}
        className="relative min-w-0 rounded-g-2 border border-surface-container-border bg-white p-5"
      >
        <div className="flex min-h-[54px] items-start gap-3.5">
          <div
            className={`flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-semibold text-brand-deep ${c.logo?.url ? "bg-transparent" : "bg-brand-tint"}`}
          >
            {c.logo?.url ? (
              <img
                src={c.logo.url}
                alt=""
                decoding="async"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(c.name) || "?"
            )}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="m-0 truncate text-base font-semibold leading-5 text-ink">{c.name}</h2>
            <span
              className={`mt-1 inline-flex rounded-g-1 px-2 py-0.5 text-xs font-semibold ${
                c.owned ? "bg-brand-tint text-brand" : "bg-surface-sunken text-ink-muted"
              }`}
            >
              {role}
            </span>
          </div>
          <div className="relative -mr-1 -mt-1">
            <Button
              variant="tertiary"
              size="icon-sm"
              aria-label={`More options for ${c.name}`}
              aria-expanded={isMenuOpen}
              onClick={() => setOpenMenuId(isMenuOpen ? null : c.id)}
            >
              <MoreVertical size={18} />
            </Button>
            {isMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close community menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setOpenMenuId(null)}
                />
                <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-g-2 border border-surface-container-border bg-white py-1 shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm text-ink hover:bg-surface-sunken"
                    onClick={() => {
                      setOpenMenuId(null);
                      handleSelect(c);
                    }}
                  >
                    View details
                  </button>
                  {!c.owned && (
                    <button
                      type="button"
                      className="w-full border-t border-surface-container-border px-4 py-3 text-left text-sm font-medium text-danger hover:bg-danger-tint/30"
                      onClick={() => {
                        setOpenMenuId(null);
                        setLeavingCommunity(c);
                      }}
                    >
                      Leave community
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-surface-container-border pt-4">
          <p className="m-0 text-sm text-ink-faint">
            {count == null ? "Community" : `${count.toLocaleString()} members`}
          </p>
          <Button
            variant="outline"
            size="sm"
            fullWidth={false}
            onClick={() => handleSelect(c)}
            disabled={navigatingId === c.id}
          >
            {navigatingId === c.id ? "Opening…" : "Open"}
          </Button>
        </div>
      </article>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-10 md:min-h-[calc(100dvh-4rem)]">
      <GlassLogoGlow />
      <MemberPageHeader
        title="My communities"
        description="View your memberships and switch between communities."
        onBack={() => goBackInApp(navigate, "/member/settings")}
        action={
          !isLoading &&
          communities.length > 0 && (
            <Button
              onClick={createCommunity}
              disabled={kycGate.isLoading}
              aria-busy={kycGate.isLoading}
              size="md"
              fullWidth={false}
              className="hidden md:inline-flex"
            >
              {kycGate.isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create a community
                </>
              )}
            </Button>
          )
        }
      />

      {(isLoading || communities.length > 0) && (
        <div className="px-4 pb-4 md:hidden">
          <Button
            onClick={createCommunity}
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
      )}

      <KycWizardModal
        open={kycWizardOpen || kycGate.gateOpen}
        onClose={closeKycWizard}
        onComplete={completeKycWizard}
        historyPath="/member/verify-identity/history"
      />

      <div className="px-4 md:px-0">
        {isLoading ? (
          <CommunityCardsSkeleton />
        ) : communities.length === 0 ? (
          // Shaped like a real community row below (same w-11 h-11
          // rounded-xl avatar tile, same card layout) but dashed and empty.
          <>
            <section className="flex min-h-[calc(100dvh-155px)] flex-col items-center justify-center px-4 pb-8 text-center md:hidden">
              <div className="mb-3">
                <CommunityEmptyIllustration />
              </div>
              <h2 className="m-0 max-w-[320px] text-sm font-semibold leading-[1.2] text-ink">
                You haven't joined any communities yet
              </h2>
              <p className="mt-1 max-w-[340px] text-[13px] leading-[1.5] text-ink-faint">
                Start your own, or join one you've been invited to.
              </p>
              <div className="mt-7 flex w-full max-w-[360px] flex-col gap-2.5">
                <Button
                  onClick={createCommunity}
                  disabled={kycGate.isLoading}
                  aria-busy={kycGate.isLoading}
                  size="md"
                  fullWidth
                >
                  {kycGate.isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Checking…
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      Create a community
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  fullWidth
                  onClick={() => navigate("/member/invites")}
                >
                  View invitations
                </Button>
              </div>
            </section>
            <section className="hidden min-h-[545px] flex-col items-center px-8 pb-10 pt-5 text-center md:flex">
              <div className="mb-3">
                <CommunityEmptyIllustration />
              </div>
              <h2 className="m-0 text-sm font-semibold text-ink">You're not in a community yet</h2>
              <p className="mt-1 max-w-[430px] text-[13px] leading-[1.5] text-ink-faint">
                Communities are how Glass brings your association, club or group together. Start
                your own, or join one you've been invited to.
              </p>
              <div className="mt-7 flex items-center gap-3">
                <Button onClick={createCommunity} size="md" fullWidth={false}>
                  <Plus size={16} />
                  Create a community
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  fullWidth={false}
                  onClick={() => navigate("/member/invites")}
                >
                  View invitations
                </Button>
              </div>
              <div className="mt-auto grid w-full max-w-[760px] grid-cols-3 gap-8 border-t border-surface-container-border pt-7 text-left">
                <div>
                  <p className="m-0 text-sm font-semibold text-ink">Pay dues in one place</p>
                  <p className="mt-1 text-sm leading-5 text-ink-muted">
                    See what you owe and pay without chasing anyone.
                  </p>
                </div>
                <div>
                  <p className="m-0 text-sm font-semibold text-ink">Never miss a due date</p>
                  <p className="mt-1 text-sm leading-5 text-ink-muted">
                    Upcoming payments and reminders in one list.
                  </p>
                </div>
                <div>
                  <p className="m-0 text-sm font-semibold text-ink">Stay in the loop</p>
                  <p className="mt-1 text-sm leading-5 text-ink-muted">
                    Updates from your leaders, right in your account.
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <div className="mb-7 hidden items-center gap-2 md:flex">
              {[
                { label: "All", count: communities.length },
                { label: "Admin", count: adminCount },
                { label: "Member", count: memberCount },
              ].map(({ label, count }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={roleFilter === label}
                  onClick={() => setRoleFilter(label)}
                  className={`rounded-g-1 border px-4 py-2 text-sm font-semibold transition-colors ${
                    roleFilter === label
                      ? "border-ink bg-ink text-white"
                      : "border-surface-container-border bg-white text-ink-muted hover:bg-surface-sunken"
                  }`}
                >
                  {label} · {count}
                </button>
              ))}
            </div>
            <div className="hidden grid-cols-1 gap-5 md:grid lg:grid-cols-2 xl:grid-cols-3">
              {visibleCommunities.map(renderCommunityCard)}
            </div>
            {visibleCommunities.length === 0 && (
              <p className="hidden rounded-g-2 border border-surface-container-border bg-white p-6 text-center text-sm text-ink-muted md:block">
                No {roleFilter.toLowerCase()} communities yet.
              </p>
            )}
            <div className="flex flex-col gap-2.5 md:hidden">
              {communities.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-2xl border border-surface-container-border bg-white p-3.5"
                >
                  <button
                    onClick={() => handleSelect(c)}
                    disabled={navigatingId === c.id}
                    className={`flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left ${navigatingId === c.id ? "cursor-default opacity-70" : "cursor-pointer opacity-100"}`}
                  >
                    <div
                      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-[13px] font-bold text-white ${c.logo?.url ? "bg-transparent" : "bg-brand-deep"}`}
                    >
                      {c.logo?.url ? (
                        <img
                          src={c.logo.url}
                          alt=""
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(c.name) || "?"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-medium text-ink">{c.name}</p>
                      <p className="mx-0 mb-0 mt-0.5 text-xs text-ink-ghost">
                        {c.owned ? "Admin" : "Member"}
                      </p>
                    </div>
                    {c.owned && navigatingId === c.id ? (
                      <div className="h-4 w-4 flex-shrink-0 animate-[spin_0.7s_linear_infinite] rounded-full border-2 border-surface-container-border [border-top-color:var(--color-brand)]" />
                    ) : (
                      <ChevronRight size={16} className="flex-shrink-0 text-[#ccc]" />
                    )}
                  </button>
                  {!c.owned && (
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
                  )}
                </div>
              ))}
            </div>
          </>
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
