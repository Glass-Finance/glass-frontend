import { useNavigate, useSearchParams } from "react-router-dom";
import CloudImage from "../../../components/common/CloudImage";
import QRCodeCanvas from "../../../components/common/QRCodeCanvas";
import { buildMobileUrl } from "../../../utils/deviceRedirect";
import { isSafeReturnPath } from "../../../utils/returnPath";
import { useAuth } from "../../../store/AuthContext";
import { Button } from "../../../components/ui/Button";

export default function MobileRequired() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  // The QR encodes an app URL for the phone to open — only honor internal
  // member destinations, falling back to sign-in. External/protocol-relative
  // values can never navigate away: buildMobileUrl prefixes the app origin,
  // and this check rejects them before a QR is even rendered.
  const target = isSafeReturnPath(searchParams.get("to")) ?? "/member/app-sign-in";
  const url = buildMobileUrl(target);

  // Admins can continue to their dashboard. The member registration flow
  // remains mobile-only, so unauthenticated members return to the public
  // landing page from this handoff.
  const continueTo = isAdmin ? "/dashboard/home" : "/";

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-cover bg-center bg-page-default">
      <header className="px-8 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CloudImage
            publicId="glass/Glass"
            alt="Glass"
            width={48}
            objectFit="contain"
            className="w-6 h-6"
          />
          <span className="font-medium text-gray-900 text-base font-sans">Glass</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-2 overflow-hidden">
        <div className="w-full max-w-xl flex flex-col items-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1.5 text-center font-sans">
            Scan To Continue On Your Phone
          </h1>
          <p className="text-sm text-gray-500 mb-4 text-center">
            Glass for members is best experienced on mobile!
          </p>

          <QRCodeCanvas value={url} size={200} color="#000000" />

          <Button onClick={() => navigate(continueTo)} className="max-w-md mt-4">
            Continue
          </Button>
        </div>
      </main>
    </div>
  );
}
