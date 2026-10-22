import { useNavigate, useLocation } from "react-router-dom";
import CloudImage from "../../../components/common/CloudImage";
import QRCodeCanvas from "../../../components/common/QRCodeCanvas";
import { buildMobileUrl } from "../../../utils/deviceRedirect";
import { Button } from "../../../components/ui/Button";
import GlassLogoGlow from "../../../components/memberApp/GlassLogoGlow";

export default function CheckEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  // Carries the email into the QR so scanning it pre-fills Join's contact
  // step instead of dropping the person on a blank form -- see
  // useJoinEmailParam. There's no backend endpoint to actually send a
  // continuation link, so this is the only context this handoff can carry.
  const joinUrl = buildMobileUrl(
    email ? `/member/join?email=${encodeURIComponent(email)}` : "/member/join",
  );

  return (
    <div className="relative z-0 h-screen w-screen flex flex-col overflow-hidden bg-[#E5E5E5]">
      <GlassLogoGlow />

      {/* Glass logo top left */}
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

      {/* Centered content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-2 overflow-hidden">
        <div className="w-full max-w-xl flex flex-col items-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-1.5 text-center font-sans">
            Continue Your Sign-In
          </h1>
          <p className="text-sm text-gray-500 mb-4 text-center">
            Scan the code to continue on another device, or continue here.
          </p>

          <QRCodeCanvas value={joinUrl} size={170} color="#000000" />

          <Button
            onClick={() =>
              navigate(email ? `/member/join?email=${encodeURIComponent(email)}` : "/member/join")
            }
            fullWidth={false}
            className="w-[220px] mt-4"
          >
            Continue on this device
          </Button>
          <Button
            variant="tertiary"
            onClick={() => navigate("/")}
            fullWidth={false}
            className="mt-2"
          >
            Back to home
          </Button>
        </div>
      </main>
    </div>
  );
}
