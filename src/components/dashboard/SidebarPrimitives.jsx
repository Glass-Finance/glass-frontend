import { LogOut } from "lucide-react";
import { Button } from "../ui/Button";
import { safeImageUrl } from "../../utils/safeImageUrl";
import PulseImg from "../common/PulseImg";

export function MobileOverlay({ mobileOpen, onClose }) {
  if (!mobileOpen) return null;
  return <div className="fixed inset-0 bg-black/40 z-[55] md:hidden" onClick={onClose} />;
}

export function SidebarLogo({ onClick, title }) {
  return (
    <button
      onClick={onClick}
      className="mb-4 p-0 bg-transparent border-none cursor-pointer"
      title={title}
    >
      <img
        src="/glass-logo-silver.webp"
        alt="Glass"
        className="w-8 h-8 object-contain block"
        onError={(event) => {
          event.currentTarget.style.display = "none";
          if (event.currentTarget.nextSibling) {
            event.currentTarget.nextSibling.style.display = "flex";
          }
        }}
      />
      <div
        className="hidden w-8 h-8 rounded-md bg-white/25 items-center justify-center text-white font-black text-base"
        aria-hidden="true"
      >
        G
      </div>
    </button>
  );
}

export function LogoutButton({ onClick, loggingOut }) {
  // Always rendered on the brand-blue rail, so it pins white rather than
  // inheriting the tertiary role's muted ink.
  return (
    <Button
      variant="tertiary"
      size="icon-sm"
      aria-label="Log out"
      onClick={onClick}
      disabled={loggingOut}
      title="Log out"
      className="text-white"
    >
      <LogOut size={14} />
    </Button>
  );
}

export function UserIdentity({ user, initials, displayName }) {
  // user.profileImage.url is server-supplied (AuthContext <- /user/me), so its
  // scheme is attacker-influenced the same way the four profile-image sinks
  // already handled by PR #79 were. Validate before it reaches <img src>; a
  // rejected value is null, which falls through to the initials block below
  // rather than rendering an image with an unsafe source.
  const avatarSrc = safeImageUrl(user?.profileImage?.url);
  return (
    <div className="py-2.5 px-3 border-t border-[var(--color-hairline)] flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-[linear-gradient(135deg,var(--color-brand),var(--color-accent-indigo))] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden">
        <PulseImg
          src={avatarSrc}
          className="w-full h-full"
          skeletonClassName="bg-black/10"
          fallback={<span>{initials}</span>}
        />
      </div>
      <div className="min-w-0 flex-1">
        {/* Figma's mobile drawer (node 391:18319) shows name 14/500 over an
        email at 14/400 @60%. The desktop rail keeps its tighter 11px name
        and has never carried an email -- so the second line is mobile-only,
        and the first only widens at the mobile breakpoint. */}
        <p className="text-sm md:text-[11px] font-medium md:font-semibold m-0 whitespace-nowrap overflow-hidden text-ellipsis">
          {displayName}
        </p>
        {user?.email && (
          <p className="md:hidden text-sm font-normal text-ink/60 m-0 whitespace-nowrap overflow-hidden text-ellipsis">
            {user.email}
          </p>
        )}
      </div>
    </div>
  );
}
