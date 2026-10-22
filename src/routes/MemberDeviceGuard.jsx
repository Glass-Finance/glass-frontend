import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isMobileSession, mobileRequiredPath } from "../utils/deviceRedirect";

/**
 * Keeps the public member registration flow on mobile. The authenticated
 * member app has a desktop layout and is protected separately by
 * MemberProtectedRoute.
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
