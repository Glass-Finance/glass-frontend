import { useEffect, useState } from "react";
import CloudImage from "./CloudImage";

const DEFAULT_ANIMATION_DURATION = "2.6s";
const VERY_FAST_ANIMATION_DURATION = "0.9s";

export default function BrandedSpinner({ size = 64 }) {
  const [animationDuration, setAnimationDuration] = useState(DEFAULT_ANIMATION_DURATION);
  const height = Math.round(size * (200 / 212));

  useEffect(() => {
    const connection = navigator.connection;
    if (!connection?.addEventListener) return undefined;

    function updateDuration() {
      if (
        connection.saveData ||
        connection.effectiveType === "slow-2g" ||
        connection.effectiveType === "2g"
      ) {
        setAnimationDuration("5.4s");
      } else if (
        connection.effectiveType === "5g" ||
        (connection.effectiveType === "4g" &&
          Number(connection.downlink) >= 10 &&
          Number(connection.rtt) <= 100)
      ) {
        // Most browsers report 5G as "4g"; use throughput and latency too.
        setAnimationDuration(VERY_FAST_ANIMATION_DURATION);
      } else if (connection.effectiveType === "4g") {
        setAnimationDuration("1.8s");
      } else {
        setAnimationDuration(DEFAULT_ANIMATION_DURATION);
      }
    }

    updateDuration();
    connection.addEventListener("change", updateDuration);
    return () => connection.removeEventListener("change", updateDuration);
  }, []);

  const logo = (
    <CloudImage
      publicId="glass/Glass"
      alt=""
      width={size * 2}
      objectFit="contain"
      style={{ width: size, height }}
    />
  );

  return (
    <div
      role="status"
      aria-label="Loading"
      className="relative flex-shrink-0"
      style={{
        width: size,
        height,
        "--logo-fill-duration": animationDuration,
      }}
    >
      <div className="absolute inset-0 opacity-[.14] grayscale">{logo}</div>

      <div className="absolute inset-0 animate-logo-fill motion-reduce:animate-none">{logo}</div>
    </div>
  );
}
