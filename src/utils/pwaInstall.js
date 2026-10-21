export function isIosSafari() {
  const userAgent = navigator.userAgent;
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/i.test(userAgent) || isIPadOS;
  const isSafari = /Safari/i.test(userAgent) && !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent);
  return isIOS && isSafari;
}

export function isStandaloneDisplay() {
  return Boolean(
    Reflect.get(navigator, "standalone") === true ||
    window.matchMedia?.("(display-mode: standalone)").matches,
  );
}
