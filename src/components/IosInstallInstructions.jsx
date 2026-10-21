/**
 * iOS Safari does not fire beforeinstallprompt, so these steps are shown only
 * after the user chooses the install option in Settings.
 */
export default function IosInstallInstructions({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Glasspay on iOS"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-g-1 p-6 max-w-sm w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-ink mb-2">Install Glasspay</h2>
        <p className="text-sm text-ink-muted mb-4">
          Add Glasspay to your home screen for quick access:
        </p>
        <ol className="text-sm text-ink space-y-3 mb-6">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-white text-xs flex items-center justify-center font-medium">
              1
            </span>
            <span>
              Tap the <strong>Share</strong> button
              <span className="inline-block ml-1 align-middle">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="inline"
                >
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
              </span>
              in the browser toolbar
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-white text-xs flex items-center justify-center font-medium">
              2
            </span>
            <span>
              Scroll down and tap <strong>Add to Home Screen</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-white text-xs flex items-center justify-center font-medium">
              3
            </span>
            <span>
              Tap <strong>Add</strong> in the top-right corner
            </span>
          </li>
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-brand text-white text-sm font-medium py-2.5 rounded-g-1 hover:bg-brand/90 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
