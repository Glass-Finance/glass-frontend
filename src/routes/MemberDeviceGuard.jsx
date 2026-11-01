import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isMobileSession, mobileRequiredPath } from "../utils/deviceRedirect";

/**
 * The member app (Home, Transactions, Upcoming, Notifications, Manage
 * Payments, Settings, etc.) is mobile-first by design — these screens are
 * never adapted for desktop. Anyone reaching them on a desktop, laptop, or
 * tablet (typed URL, bookmark, old link) gets a QR handoff instead, rather
 * than a broken or half-responsive layout. Member registration
 * (/member/join) is gated the same way — joining remains mobile-only.
 *
 * Uses isMobileSession() (not the raw device check) so an already-verified
 * mobile session survives a reload even if a device-emulation tool fails
 * to reapply its UA override on that specific reload — see deviceRedirect.js.
 */
export default function MemberDeviceGuard() {
  const location = useLocation();

  if (!isMobileSession()) {
    const target = `${location.pathname}${location.search}`;
    return <Navigate to={mobileRequiredPath(target)} replace />;
  }

  return <Outlet />;
}
