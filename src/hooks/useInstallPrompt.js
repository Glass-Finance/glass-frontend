import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isStandaloneDisplay } from "../utils/pwaInstall";

const InstallPromptContext = createContext(null);

export function InstallPromptProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      return outcome === "accepted";
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const value = useMemo(
    () => ({
      isInstallable: Boolean(deferredPrompt) && !isInstalled,
      isInstalled,
      install,
    }),
    [deferredPrompt, install, isInstalled],
  );

  return createElement(InstallPromptContext.Provider, { value }, children);
}

export function useInstallPrompt() {
  const context = useContext(InstallPromptContext);
  if (!context) {
    throw new Error("useInstallPrompt must be used within an InstallPromptProvider");
  }
  return context;
}
