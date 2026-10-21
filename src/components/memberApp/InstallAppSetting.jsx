import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../ui/Button";
import IosInstallInstructions from "../IosInstallInstructions";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { isIosSafari } from "../../utils/pwaInstall";
import { toast } from "sonner";

export default function InstallAppSetting() {
  const { isInstallable, isInstalled, install } = useInstallPrompt();
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);
  const isIOSInstallable = isIosSafari();

  if (isInstalled || (!isIOSInstallable && !isInstallable)) return null;

  async function handleInstall() {
    if (isIOSInstallable) {
      setIosInstructionsOpen(true);
      return;
    }

    try {
      await install();
    } catch {
      toast.error("Could not start installation. Please try again from your browser.");
    }
  }

  return (
    <>
      <div className="mb-5">
        <p className="text-[14px] font-medium text-black/60 mt-0 mx-1 mb-2">App</p>
        <div className="rounded-xl bg-surface-container border border-black/10 overflow-hidden">
          <Button
            type="button"
            onClick={handleInstall}
            variant="tertiary"
            size="sm"
            className="w-full justify-start text-left h-auto py-3.5 px-4 rounded-none hover:bg-black/[0.03]"
          >
            <Download size={24} className="text-ink flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink m-0">Install Glasspay</p>
              <p className="text-xs text-ink-ghost mt-0.5 mx-0 mb-0">
                Add the app to your home screen for quick access
              </p>
            </div>
          </Button>
        </div>
      </div>
      <IosInstallInstructions
        open={iosInstructionsOpen}
        onClose={() => setIosInstructionsOpen(false)}
      />
    </>
  );
}
