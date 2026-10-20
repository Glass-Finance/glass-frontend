import { useState } from "react";
import { Button } from "../../../../components/ui/Button";
import { Copy, Check, MoreVertical } from "lucide-react";
import { roleKeyword, isCommunityAdmin, findRoleId } from "../../../../utils/communityRole";
import { useActiveCommunityId } from "../../../../hooks/useActiveCommunityId";
import { useCommunityMembers, useRoles } from "../../../../hooks/useCommunityMembers";
import { useCommunity, useUpdateCommunitySettings } from "../../../../hooks/useCommunity";
import QRCodeCanvas from "../../../../components/common/QRCodeCanvas";
import { APP_ORIGIN } from "../../../../utils/deviceRedirect";
import LoadingState from "../../../../components/common/LoadingState";
import Toggle from "../../../../components/common/Toggle";
import ConfirmDialog from "../../../../components/dashboard/ConfirmDialog";
import KycStateBadge from "../../../../components/dashboard/KycStateBadge";
import { useCopyToClipboard } from "../../../../hooks/useCopyToClipboard";
import { resolveDisplayName, resolveEmail } from "../../../../utils/memberName";
import { isKycRequiredError, KYC_ADMIN_BLOCK_COPY } from "../../../../utils/kycStatus";
import { getErrorMessage } from "../../../../utils/errorHandler";

// Per-member "⋯" actions menu — one open at a time (state lives in the page),
// dismissed by the invisible full-screen overlay behind it.
function MemberActionsMenu({ open, onToggle, onClose, busy, actions }) {
  return (
    <div className="relative flex-shrink-0">
      <Button
        variant="tertiary"
        size="icon-sm"
        onClick={onToggle}
        disabled={busy}
        aria-label="Member actions"
        className=""
      >
        <MoreVertical size={15} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl overflow-hidden min-w-[190px] border border-surface-container-border shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
            {actions.map((a) => (
              <button
                key={a.label}
                disabled={a.disabled || busy}
                onClick={() => {
                  onClose();
                  a.onClick();
                }}
                className={`block w-full text-left px-4 py-2.5 text-xs font-medium bg-white hover:bg-gray-50 border-none cursor-pointer transition-colors disabled:opacity-50 ${
                  a.danger ? "text-danger" : "text-gray-700"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MemberAccess() {
  // useActiveCommunityId() returns the community slug (preferred over id)
  // since both the Sidebar and CommunitiesHome set ?community= to the slug.
  const communitySlug = useActiveCommunityId();
  const [copied, copy] = useCopyToClipboard();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { member, type: "demote"|"promote"|"remove" }
  const [actionError, setActionError] = useState("");
  const { members, isLoading, removeMember, updateMember } = useCommunityMembers(communitySlug);
  const { data: rolesData, isLoading: rolesLoading } = useRoles();
  const { data: community, isLoading: communityLoading } = useCommunity(communitySlug);
  const updateSettings = useUpdateCommunitySettings(communitySlug);
  // Both role ids come from the server's own role list, and BOTH are
  // required to be resolved — no fallback id.
  //
  // The fallback that used to be here ("MEMBER") is not a backend role code:
  // the canonical code is COMMUNITY_MEMBER (utils/communityRole.js). When the
  // role list had not loaded yet, demote would send roleId:"MEMBER" and the
  // backend would reject it, so the demotion failed silently instead of
  // being disabled up front. Promote was already gated this way; demote now
  // matches it.
  const memberRoleId = findRoleId(rolesData, "COMMUNITY_MEMBER");
  const adminRoleId = findRoleId(rolesData, "COMMUNITY_ADMIN");

  const inviteLink = communitySlug ? `${APP_ORIGIN}/member/join?community=${communitySlug}` : null;

  const handleCopy = () => copy(inviteLink);

  // titleCase:false preserves this page's existing behavior of showing
  // names in whatever case the backend returned them.
  const memberName = (m) => resolveDisplayName(m, "Member", { titleCase: false });
  const memberEmail = (m) => resolveEmail(m);
  // Membership payloads carry canonical backend role codes
  // (COMMUNITY_OWNER/COMMUNITY_ADMIN/…); roleKeyword matches them exactly.
  // Exact matching previously made promoted admins read as plain members
  // when codes were compared raw, so they could be promoted again but never
  // demoted — the shared helper is the single definition now.
  const memberRoleKw = (m) => roleKeyword(m.roleCode, m.memberRole, m.role) ?? "MEMBER";
  function memberRoleLabel(m) {
    const kw = memberRoleKw(m);
    if (kw === "OWNER") return "Owner";
    if (kw === "ADMIN") return "Admin";
    return "Member";
  }
  const isOwnerRole = (m) => memberRoleKw(m) === "OWNER";
  const isAdminRole = (m) => isCommunityAdmin(m);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Joining & visibility */}
      <div className="bg-surface-container rounded-2xl p-5 border border-surface-container-border">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Joining &amp; visibility</p>
        <p className="text-xs text-gray-500 mb-4">
          Control how new members find and join this community.
        </p>
        <div className="-mx-5 border-b border-gray-100 mb-1" />

        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-medium text-gray-900 m-0">Require approval to join</p>
            <p className="text-xs text-gray-500 mt-0.5 m-0">
              New join requests wait in{" "}
              <span className="font-medium text-gray-700">Join Requests</span> until an admin
              approves them. When off, anyone can join instantly from Discover or an invite link.
            </p>
          </div>
          <Toggle
            on={!!community?.requiresMemberApproval}
            disabled={communityLoading || !community}
            onChange={(v) => updateSettings.mutate({ requiresMemberApproval: v })}
            showLabel
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="min-w-0 pr-4">
            <p className="text-xs font-medium text-gray-900 m-0">Show in Discover</p>
            <p className="text-xs text-gray-500 mt-0.5 m-0">
              List this community in the public Discover Communities search. When off, people can
              only join through your invite link.
            </p>
          </div>
          <Toggle
            on={!!community?.publicVisible}
            disabled={communityLoading || !community}
            onChange={(v) => updateSettings.mutate({ publicVisible: v })}
            showLabel
          />
        </div>
      </div>

      {/* Invite Link + QR */}
      <div className="bg-surface-container rounded-2xl p-5 border border-surface-container-border">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Invite Link</p>
        <p className="text-xs text-gray-500 mb-4">
          Share this link or QR code with members so they can join your community on Glass.
        </p>
        <div className="-mx-5 border-b border-gray-100 mb-4" />
        <div className="flex items-center gap-4">
          {inviteLink && (
            <div className="flex-shrink-0">
              <QRCodeCanvas value={inviteLink} size={96} />
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl flex-1 min-w-0 bg-brand-wash border border-[#C7D2FE]">
            <span className="text-sm text-gray-700 font-medium truncate">
              {inviteLink ?? "Select a community to generate an invite link"}
            </span>
            <Button
              variant="tertiary"
              size="xs"
              fullWidth={false}
              onClick={handleCopy}
              disabled={!inviteLink}
              className="flex-shrink-0"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        </div>
      </div>

      {/* Admin Management */}
      <div className="bg-surface-container rounded-2xl p-5 border border-surface-container-border">
        <p className="text-sm font-semibold text-gray-900 mb-0.5">Admin management</p>
        <p className="text-xs text-gray-500 mb-4">
          Promote members to admin or revoke admin access.
        </p>
        <div className="-mx-5 border-b border-gray-100 mb-4" />
        {!rolesLoading && !adminRoleId && (
          <p className="text-xs text-danger mb-3">
            Couldn't find an Admin role on the server — Promote is disabled until this is resolved.
          </p>
        )}
        {!rolesLoading && !memberRoleId && (
          <p className="text-xs text-danger mb-3">
            Couldn't find a Member role on the server — Demote is disabled until this is resolved.
          </p>
        )}

        <div className="flex flex-col">
          {isLoading ? (
            <LoadingState className="py-3" />
          ) : members.length === 0 ? (
            // Shaped like a real member row below (flex justify-between
            // py-3, a role-badge pill on the right) but dashed and empty.
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-gray-400">No members yet</p>
                <p className="text-xs text-gray-400">
                  Share the invite link above to start bringing members into this community.
                </p>
              </div>
              <span className="w-14 h-5 rounded-full border-2 border-dashed border-gray-200 flex-shrink-0" />
            </div>
          ) : (
            members.map((member, i) => (
              <div
                key={member.id ?? i}
                className={`flex items-center justify-between py-3 ${i < members.length - 1 ? "border-b border-stacked-container" : "border-b-0"}`}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{memberName(member)}</p>
                    <p className="text-xs text-gray-500">{memberEmail(member)}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isAdminRole(member) ? "text-brand bg-brand-wash" : "text-warning bg-[#FEF3C7]"}`}
                  >
                    {memberRoleLabel(member)}
                  </span>
                  {/* Verification completion — admin-facing only; renders
                      nothing until the member DTO carries kycStatus. */}
                  <KycStateBadge status={member.kycStatus} />
                </div>
                {/* Owners can't be demoted or removed from here — no menu. */}
                {!isOwnerRole(member) && (
                  <MemberActionsMenu
                    open={openMenuId === member.id}
                    onToggle={() => setOpenMenuId((id) => (id === member.id ? null : member.id))}
                    onClose={() => setOpenMenuId(null)}
                    busy={removeMember.isPending || updateMember.isPending}
                    actions={[
                      isAdminRole(member)
                        ? {
                            label: "Demote to Member",
                            disabled: !memberRoleId,
                            onClick: () => setPendingAction({ member, type: "demote" }),
                          }
                        : {
                            label: "Promote to Admin",
                            disabled: !adminRoleId,
                            onClick: () => setPendingAction({ member, type: "promote" }),
                          },
                      {
                        label: "Remove from community",
                        danger: true,
                        onClick: () => setPendingAction({ member, type: "remove" }),
                      },
                    ]}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {pendingAction && (
        <ConfirmDialog
          title={
            pendingAction.type === "demote"
              ? "Demote to Member"
              : pendingAction.type === "promote"
                ? "Promote to Admin"
                : "Remove Member"
          }
          subtitle={memberEmail(pendingAction.member)}
          description={
            pendingAction.type === "demote"
              ? `${memberName(pendingAction.member)} will lose dashboard access to this community and become a regular member.`
              : pendingAction.type === "promote"
                ? `${memberName(pendingAction.member)} will get dashboard access to manage this community.`
                : `This removes ${memberName(pendingAction.member)} from this community. They'll lose access to community payment plans and dashboard data tied to this community; this can't be undone.`
          }
          confirmLabel={
            pendingAction.type === "demote"
              ? "Demote"
              : pendingAction.type === "promote"
                ? "Promote"
                : "Remove"
          }
          danger={pendingAction.type !== "promote"}
          confirming={updateMember.isPending || removeMember.isPending}
          error={actionError}
          onClose={() => {
            setPendingAction(null);
            setActionError("");
          }}
          onConfirm={() => {
            const { member, type } = pendingAction;
            setActionError("");
            if (type === "demote") {
              // Belt and braces: the menu entry is disabled when the role id
              // is unresolved, but never send an undefined roleId — the
              // backend would reject it and the demotion would fail with no
              // explanation.
              if (!memberRoleId) {
                setActionError("Couldn't find a Member role on the server. Try again in a moment.");
                return;
              }
              updateMember.mutate(
                { memberId: member.id, payload: { roleId: memberRoleId } },
                { onSuccess: () => setPendingAction(null) },
              );
            } else if (type === "promote") {
              if (!adminRoleId) {
                setActionError("Couldn't find an Admin role on the server. Try again in a moment.");
                return;
              }
              updateMember.mutate(
                { memberId: member.id, payload: { roleId: adminRoleId } },
                {
                  onSuccess: () => setPendingAction(null),
                  onError: (err) =>
                    setActionError(
                      isKycRequiredError(err)
                        ? KYC_ADMIN_BLOCK_COPY
                        : getErrorMessage(err, "Couldn't promote this member."),
                    ),
                },
              );
            } else {
              removeMember.mutate(member.id, { onSuccess: () => setPendingAction(null) });
            }
          }}
        />
      )}
    </div>
  );
}
