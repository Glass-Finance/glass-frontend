import { Navigate, useSearchParams } from "react-router-dom";
import { isSafeReturnPath } from "../../../utils/returnPath";

export default function MobileRequired() {
  const [searchParams] = useSearchParams();
  // Keep old mobile-handoff links working, but send visitors to the
  // responsive destination on the device they're already using.
  const safeTarget = isSafeReturnPath(searchParams.get("to"));
  const target =
    safeTarget && safeTarget.split("?")[0] !== "/member/mobile-required"
      ? safeTarget
      : "/member/app-sign-in";
  return <Navigate to={target} replace />;
}
