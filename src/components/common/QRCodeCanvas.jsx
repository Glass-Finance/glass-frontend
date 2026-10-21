import { useEffect, useRef } from "react";
import QRCode from "qrcode";

/**
 * `color` is NOT a design token, deliberately. It is handed to the `qrcode`
 * library, which assigns it to a canvas 2D `fillStyle` — and `fillStyle` does
 * not resolve `var(--color-*)`, it would silently fall back to black. Callers
 * that want a themed QR code should read the resolved value
 * (`getComputedStyle`) and pass a concrete colour string.
 */
export default function QRCodeCanvas({ value, size = 160, color = "#002FA7", onReady, onError }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: color, light: "#00000000" }, // fully transparent — blends with whatever's behind it, not just one hardcoded page color
    })
      .then(() => onReady?.())
      .catch((error) => {
        if (onError) onError(error);
        else console.error("Unable to render QR code", error);
      });
  }, [value, size, color, onReady, onError]);

  if (!value) return null;
  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      aria-label="QR code for transaction ID"
      data-testid="receipt-qr-code"
    />
  );
}
