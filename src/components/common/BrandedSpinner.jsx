import CloudImage from "./CloudImage";

const BIG_PIECE =
  "polygon(0 0, 70.75% 0, 70.75% 33%, 35.85% 33%, 35.85% 68%, 66.04% 68%, 66.04% 54%, 100% 54%, 100% 100%, 0 100%)";
const SMALL_PIECE =
  "polygon(70.75% 0, 100% 0, 100% 54%, 66.04% 54%, 66.04% 68%, 35.85% 68%, 35.85% 33%, 70.75% 33%)";
const GLINT_BAND = "linear-gradient(115deg, transparent 35%, #000 50%, transparent 65%)";

const glintMask = {
  WebkitMaskImage: GLINT_BAND,
  maskImage: GLINT_BAND,
  WebkitMaskSize: "300% 100%",
  maskSize: "300% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "100% 0",
  maskPosition: "100% 0",
};

export default function BrandedSpinner({ size = 64 }) {
  const height = Math.round(size * (200 / 212));
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
      style={{ width: size, height }}
    >
      <div className="absolute inset-0 opacity-10">{logo}</div>

      <div
        className="absolute inset-0 animate-lock-drop motion-reduce:animate-none"
        style={{ clipPath: BIG_PIECE }}
      >
        {logo}
      </div>

      <div
        className="absolute inset-0 animate-lock-slide motion-reduce:animate-none"
        style={{ clipPath: SMALL_PIECE }}
      >
        {logo}
      </div>

      <div
        className="absolute inset-0 opacity-0 brightness-[2.3] saturate-[.35] animate-lock-glint motion-reduce:animate-none"
        style={glintMask}
      >
        {logo}
      </div>
    </div>
  );
}
