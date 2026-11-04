import { useNavigate } from "react-router-dom";
import CloudImage from "../components/common/CloudImage";
import { cldUrl } from "../lib/cloudinary";

export default function AuthLayout({ heroTitle, heroSubtitle, children }) {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden bg-surface-bg relative">
      {/* Background — separate mobile/desktop images (different aspect
          ratios), swapped by breakpoint visibility rather than one shared
          background-image, since the two assets aren't the same crop.
          Desktop waves come from Cloudinary (glass/auth/auth-background);
          the mobile backdrop stays local (bg-mobile-auth-default) — see
          docs/cloudinary.md for what's still bundled. */}
      <div className="absolute inset-0 md:hidden bg-cover bg-center bg-no-repeat bg-mobile-auth-default" />
      <div
        className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${cldUrl("glass/auth/auth-background", { width: 1920 })})` }}
      />

      {/* ── Mobile header ──
          Replaces the hero image entirely below md -- a plain logo +
          wordmark bar with a hairline divider, matching the reference
          design's mobile screens (no hero illustration/welcome text on
          small screens at all). */}
      <div className="md:hidden relative z-20 flex-shrink-0">
        <div
          className="flex items-center gap-2 px-6 pt-5 pb-4 cursor-pointer w-fit"
          onClick={() => navigate("/")}
        >
          <CloudImage
            publicId="glass/Glass"
            alt=""
            width={56}
            objectFit="contain"
            className="h-7 w-7"
          />
          <span className="text-lg font-medium text-gray-900">Glass</span>
        </div>
        <div className="h-px bg-gray-200" />
      </div>

      {/* ── Hero panel — desktop only ── */}
      <div className="hidden md:block md:w-[46%] md:h-full flex-shrink-0 relative z-10">
        <div className="relative w-full h-full overflow-hidden">
          <CloudImage
            publicId="glass/auth/auth-panel"
            alt="Glass Finance"
            width={1200}
            priority
            // w-full/h-full, not absolute inset-0: CloudImage's wrapper is
            // already `relative`, and two position utilities on one element
            // left the panel at the image's natural height, so on wide
            // screens it stopped short of the bottom edge.
            className="w-full h-full align-top"
            // The Cloudinary asset has ~40px rounded, transparent corners baked
            // in (3.3% of its width). Figma draws the panel square and
            // full-bleed, so scale it just past that so the corners always
            // sit outside the clipped box, at any viewport aspect.
            imgClassName="scale-[1.08]"
            draggable={false}
          />

          {/* Logo — no wrapping card per design; the backdrop-blur overlay
              this used to sit in was also a likely cause of the slow first
              paint reported on Brave (120px backdrop-filter is expensive to
              composite). Still clickable back to the landing page. The
              Figma dev-mode footprint (72x62.73) read too large at 100%
              zoom on a real screen, so sized down from that -- h-11 (44px)
              instead. Intrinsic-aspect logo, so rendered as a responsive
              <img> (CloudImage needs a fixed width box). */}
          <img
            src={cldUrl("glass/cta/ctalogo", { width: 96 })}
            alt="Glass Logo"
            className="absolute top-[42.5px] left-8 z-10 h-11 w-auto object-contain cursor-pointer"
            onClick={() => navigate("/")}
          />

          {(heroTitle || heroSubtitle) && (
            <div className="flex absolute inset-0 items-center justify-center z-10 px-8">
              <div className="text-center">
                {heroTitle && (
                  <h1 className="text-white font-normal leading-tight text-[clamp(1.75rem,2vw,1.75rem)]">
                    {heroTitle}
                  </h1>
                )}
                {heroSubtitle && (
                  <h2 className="text-white font-normal leading-tight mt-2 text-[clamp(1.75rem,2vw,1.75rem)]">
                    {heroSubtitle}
                  </h2>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Form sheet ──
          Mobile: top-aligned directly below the header, flush, no card
          treatment (there's no hero panel left to pull up over).
          Desktop: vertical position is actually controlled per-screen (see
          each step's own `mt-8 md:mt-14 mb-auto` wrapper, not my-auto/
          m-auto/justify-center) -- a fixed top offset with the leftover
          space collected at the bottom via the auto margin, so every screen
          gets the same gap above its heading regardless of how much content
          it has below, instead of true centering pushing shorter screens
          further down and taller ones further up. justify-center here is
          just the harmless fallback for anything that doesn't opt into that
          pattern. */}
      <div
        className="flex-1 flex flex-col items-center justify-start md:justify-center px-6 md:px-12
                   py-4 md:py-10 overflow-y-auto min-h-0 relative z-20"
      >
        {children}
        <div className="h-[env(safe-area-inset-bottom,20px)]" />
      </div>
    </div>
  );
}
