import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Bell, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "../../store/AuthContext";
import PageLoadingState from "../../components/common/PageLoadingState";
import GlassLogoGlow from "../../components/memberApp/GlassLogoGlow";
import AutoPayPrompt from "../../components/common/AutoPayPrompt";
import { usePayments, usePendingPaymentVerification } from "../../hooks/usePayments";
import { useMyCommunities } from "../../hooks/useMyAccount";
import { useNotifications } from "../../hooks/useNotifications";
import { useJoinApprovalWatcher } from "../../hooks/useJoinApproval";
import JoinApprovedModal from "../../components/memberApp/JoinApprovedModal";
import KycWizardModal from "../../components/kyc/KycWizardModal";
import SideDrawer from "../../components/memberApp/SideDrawer";
import KycStatusBadge from "../../components/memberApp/KycStatusBadge";
import ProfileAvatar from "../../components/memberApp/ProfileAvatar";
import { useKycSummary } from "../../hooks/useKyc";
import { isKycApproved } from "../../utils/kycStatus";
import { kycDisabled } from "../../lib/flags";
import {
  CommunitySwitcher,
  HeroCard,
  UpcomingRow,
  HistoryRow,
  NoCommunityState,
  NothingHappeningState,
  PendingApprovalState,
  EmptyUpcomingState,
  EmptyHistoryState,
  ProfileNudge,
} from "./HomeSections";
import { toTitleCase } from "../../utils/format";

function firstName(user) {
  try {
    const userData =
      typeof user?.userData === "string" ? JSON.parse(user.userData) : user?.userData;
    if (userData?.firstName) return toTitleCase(userData.firstName);
  } catch {
    // ignore
  }
  return toTitleCase(user?.firstName ?? user?.email?.split("@")[0] ?? "there");
}

export default function Home() {
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    error,
    refresh,
    hasNoCommunity,
    hasPendingCommunity,
    pendingCommunity,
    communityCount,
  } = usePayments();

  usePendingPaymentVerification();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();

  const { approved: approvedJoins, dismiss: dismissJoin } = useJoinApprovalWatcher();
  const activeApproval = approvedJoins[0] ?? null;

  function openApprovedCommunity(entry) {
    try {
      localStorage.setItem(
        "glass_member_community",
        JSON.stringify({
          id: entry.communityId,
          slug: entry.communitySlug,
          name: entry.name,
        }),
      );
    } catch {
      // ignore
    }
    dismissJoin(entry);
  }

  const [autoPayPrompt, setAutoPayPrompt] = useState(() => {
    try {
      const raw = sessionStorage.getItem("glass_autopay_prompt");
      if (!raw) return null;
      sessionStorage.removeItem("glass_autopay_prompt");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  function dismissAutoPayPrompt() {
    if (autoPayPrompt?.paymentLinkId) {
      try {
        localStorage.setItem(`glass_autopay_asked_${autoPayPrompt.paymentLinkId}`, "1");
      } catch {
        // ignore
      }
    }
    setAutoPayPrompt(null);
  }

  function enableAutoPay() {
    dismissAutoPayPrompt();
    navigate("/member/auto-pay");
  }

  const nextDue = data?.nextDue ?? null;
  const upcoming = (data?.upcoming ?? []).slice(0, 3);
  const totalUpcomingCount = (data?.upcoming ?? []).length;
  const history = (data?.history ?? []).slice(0, 3);
  const communityName = data?.community?.name ?? "Your Community";
  const communityInitial = communityName.charAt(0).toUpperCase();
  const communityLogo = data?.community?.logo;
  const activeCommunityIdentifier = data?.community?.slug ?? data?.community?.id ?? null;
  const [menuOpen, setMenuOpen] = useState(false);
  // KYC badge opens the wizard modal in place instead of routing away.
  const [kycWizardOpen, setKycWizardOpen] = useState(false);

  const { data: rawMyCommunities = [] } = useMyCommunities();
  const { data: kycSummary } = useKycSummary();
  const showKycBadge = !kycDisabled() && kycSummary?.status && !isKycApproved(kycSummary.status);
  const myCommunities = rawMyCommunities
    .filter((c) => (c.memberStatus ?? "ACTIVE").toUpperCase() === "ACTIVE")
    .map((c) => ({
      ...c,
      name: c.name ?? c.community?.name,
      slug: c.slug ?? c.community?.slug,
      logo: c.logo ?? c.community?.logo,
      id: c.id ?? c.community?.id,
    }));

  const [, forceRerender] = useState(0);
  function handleSwitchCommunity(c) {
    try {
      localStorage.setItem(
        "glass_member_community",
        JSON.stringify({ id: c.id, slug: c.slug, name: c.name }),
      );
    } catch {
      // ignore
    }
    forceRerender((n) => n + 1);
  }

  const showNothingHappening =
    !hasNoCommunity &&
    !hasPendingCommunity &&
    communityCount >= 2 &&
    !nextDue &&
    totalUpcomingCount === 0 &&
    history.length === 0;

  useEffect(() => {
    if (!data?.community) return;
    try {
      if (!localStorage.getItem("glass_member_community")) {
        const { name, slug, id } = data.community;
        localStorage.setItem("glass_member_community", JSON.stringify({ name, slug, id }));
      }
    } catch {
      // ignore
    }
  }, [data?.community]);

  function handlePay(payment) {
    const suffix = payment._isLink ? "?via=link" : "";
    navigate(`/member/pay/${payment.id}${suffix}`, {
      state: {
        communityName: payment.communityName,
        communityLogo: payment.logo,
      },
    });
  }

  return (
    <>
      <div className="relative overflow-hidden min-h-screen pb-10 md:grid md:grid-cols-2 md:content-start md:gap-x-6 md:gap-y-4 md:pb-8">
        <GlassLogoGlow />
        <SideDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

        <div className="flex items-start justify-between pt-[25px] px-5 pb-5 md:col-span-2 md:items-center md:px-0 md:pt-2 md:pb-3">
          <div className="flex flex-col gap-[7px] min-w-0">
            <div className="flex items-center gap-[15px] min-w-0">
              <Button
                variant="tertiary"
                size="icon-md"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                className="flex-shrink-0 md:hidden"
              >
                <Menu size={28} strokeWidth={2} className="text-ink" />
              </Button>

              {!hasNoCommunity && (
                <CommunitySwitcher
                  communities={myCommunities}
                  activeIdentifier={activeCommunityIdentifier}
                  communityName={communityName}
                  communityInitial={communityInitial}
                  communityLogo={communityLogo}
                  onSelect={handleSwitchCommunity}
                  navigate={navigate}
                />
              )}

              {/* No community switcher means no greeting row to attach to, so
                  the pill compacts next to the menu button. With a community,
                  the pill rides beside "Hi {name}," instead (see below). */}
              {showKycBadge && hasNoCommunity && (
                <button
                  onClick={() => setKycWizardOpen(true)}
                  className="bg-transparent border-none cursor-pointer p-0 flex-shrink-0"
                  aria-label="Identity verification status"
                >
                  <KycStatusBadge status={kycSummary.status} />
                </button>
              )}
            </div>
          </div>

          {/* Profile photo sits at the far right of the header (the member's
              entry point to their own profile), with the notification bell
              directly beside it. Invites moved out of the header entirely —
              the hamburger SideDrawer still carries the Invitations entry. */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <Button
              variant="tertiary"
              size="icon-md"
              aria-label="Notifications"
              onClick={() => navigate("/member/notifications")}
              className="relative flex-shrink-0"
            >
              <Bell size={17} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[15px] h-[15px] py-0 px-[3px] rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center border-[1.5px] border-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>

            <ProfileAvatar
              user={user}
              onClick={() => navigate("/member/profile")}
              ariaLabel="Your profile"
            />
          </div>
        </div>

        {!hasNoCommunity && !showNothingHappening && (
          <div className="pt-1 px-5 pb-5 md:col-span-2 md:px-0 md:pt-0 md:pb-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-medium text-ink m-0">Hi {firstName(data?.user)},</h1>
              {showKycBadge && (
                <button
                  onClick={() => setKycWizardOpen(true)}
                  className="bg-transparent border-none cursor-pointer p-0"
                  aria-label="Identity verification status"
                >
                  <KycStatusBadge status={kycSummary.status} />
                </button>
              )}
            </div>
            <p className="text-[13px] text-ink-ghost mt-[3px] font-normal">
              Here's Your Community At A Glance
            </p>
          </div>
        )}

        {!hasNoCommunity && !showNothingHappening && data?.user && !data.user.phoneVerified && (
          <ProfileNudge navigate={navigate} user={data.user} />
        )}

        {isLoading ? (
          <PageLoadingState />
        ) : hasPendingCommunity ? (
          <PendingApprovalState navigate={navigate} community={pendingCommunity} />
        ) : hasNoCommunity ? (
          <NoCommunityState navigate={navigate} />
        ) : showNothingHappening ? (
          <NothingHappeningState navigate={navigate} />
        ) : (
          <>
            <HeroCard nextDue={nextDue} onPay={handlePay} error={error} onRefresh={refresh} />

            <div className="mx-4 mt-4 bg-surface-container rounded-lg px-4 pt-4 pb-1 border border-surface-container-border md:mx-0 md:mt-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-normal text-ink">Upcoming Payments</span>
                  {totalUpcomingCount > 0 && (
                    <span className="text-[11px] font-bold text-brand-deep bg-[#E4E7F9] rounded-full py-px px-[7px] leading-normal">
                      {totalUpcomingCount}
                    </span>
                  )}
                </div>
                {totalUpcomingCount > 0 && (
                  <button
                    onClick={() => navigate("/member/upcoming")}
                    className="bg-transparent border-none cursor-pointer text-xs font-medium text-ink-faint p-0"
                  >
                    See All
                  </button>
                )}
              </div>

              {upcoming.length === 0 && totalUpcomingCount === 0 ? (
                <EmptyUpcomingState />
              ) : (
                upcoming.map((p) => <UpcomingRow key={p.id} payment={p} onPay={handlePay} />)
              )}
            </div>

            <div className="mx-4 mt-4 bg-surface-container rounded-lg px-4 pt-4 pb-1 border border-surface-container-border md:mx-0 md:mt-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-normal text-ink">Payment History</span>
                {history.length > 0 && (
                  <button
                    onClick={() => navigate("/member/transactions")}
                    className="bg-transparent border-none cursor-pointer text-xs font-medium text-ink-faint p-0"
                  >
                    See All
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <EmptyHistoryState />
              ) : (
                history.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    onOpen={(t) => navigate(`/member/transactions/${t.id}`)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {autoPayPrompt && (
        <AutoPayPrompt
          prompt={autoPayPrompt}
          onDismiss={dismissAutoPayPrompt}
          onEnable={enableAutoPay}
        />
      )}

      <JoinApprovedModal
        entry={activeApproval}
        onOpen={openApprovedCommunity}
        onDismiss={dismissJoin}
      />

      <KycWizardModal
        open={kycWizardOpen}
        onClose={() => setKycWizardOpen(false)}
        historyPath="/member/verify-identity/history"
      />
    </>
  );
}
