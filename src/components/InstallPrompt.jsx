import { useInstallPrompt } from "../hooks/useInstallPrompt";

/**
 * Chromium install banner — shown when beforeinstallprompt fires.
 * Auto-hides after dismiss or successful install.
 */
export default function InstallPrompt() {
  const { isInstallable, install, dismiss } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Glasspay app"
      className="fixed left-4 right-4 top-1/2 -translate-y-1/2 mx-auto max-w-sm z-50 bg-white rounded-g-1 shadow-lg border border-hairline-soft p-4 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">Install Glasspay</p>
        <p className="text-xs text-ink-muted mt-0.5">Add to your home screen for quick access</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-ink-faint hover:text-ink-muted px-2 py-1"
          aria-label="Dismiss install prompt"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={install}
          className="bg-brand text-white text-xs font-medium px-3 py-1.5 rounded-g-1 hover:bg-brand/90 transition-colors"
        >
          Install
        </button>
      </div>
    </div>
  );
}
