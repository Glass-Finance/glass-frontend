import { Copy } from "lucide-react";
import SuccessBadge from "../../../components/common/SuccessBadge";
import { Button } from "../../../components/ui/Button";

// No suitable shared modal exists — PaymentProfile.jsx's SuccessModal is a
// different design (different message, no props, different styling), so this
// is a straight move of AddMembers' own modal, unchanged.
//
// Phones (Figma "iPhone 16 - 112") show it as a full page on the onboarding
// background rather than a bottom sheet, with Copy Community Link as a full
// outline button under Go To Dashboard. Desktop is unchanged.
export default function SuccessModal({ communityName, onDashboard, onCopy }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/20 max-lg:items-center max-lg:bg-surface-bg">
      <div className="absolute inset-0 lg:hidden bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />
      <div className="bg-surface-bg rounded-t-[24px] lg:rounded-3xl flex flex-col items-center text-center px-8 py-12 lg:px-10 lg:py-20 w-full lg:max-w-[550px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] max-lg:relative max-lg:px-4 max-lg:bg-transparent max-lg:rounded-none max-lg:shadow-none">
        <SuccessBadge
          message="Your Community Is Now Live"
          subMessage={`${communityName ?? "Your community"} is all set up on Glass!`}
          className="mb-8"
        />
        <Button onClick={onDashboard} size="sm" className="lg:w-4/5 mb-5 max-lg:h-12 max-lg:mb-4">
          Go To Dashboard
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={onCopy}
          className="lg:hidden max-lg:text-[16px]"
        >
          <Copy size={20} aria-hidden="true" />
          Copy Community Link
        </Button>
        <p className="text-xs text-gray-900 mb-1 max-lg:hidden">Ready To Invite Members?</p>
        <Button
          variant="tertiary"
          size="xs"
          fullWidth={false}
          onClick={onCopy}
          className="max-lg:hidden"
        >
          Click here to copy your community link
        </Button>
        <div className="h-[env(safe-area-inset-bottom,0px)] lg:hidden" />
      </div>
    </div>
  );
}
