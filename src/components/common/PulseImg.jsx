// src/components/common/PulseImg.jsx
//
// Avatar/logo <img> for tiny fixed-size remote assets: shows a pulsing
// skeleton while the file fetches, then fades the real image in. A CSS
// skeleton beats a fetched blur placeholder here — zero extra requests,
// and something is visible before the request even starts (an LQIP fetch
// for a 36px avatar is pure overhead).
//
// The skeleton sits BEHIND the img (the img is opacity-0 until loaded), so
// containers that already carry a background (gradient, initials fallback)
// keep showing it through `bg-transparent` on the skeleton.
//
// SECURITY: every caller feeds this component a URL straight out of an API
// payload — `user.profileImage.url` (/user/me), `logo.url` (invites),
// `item.logo.url` (admin payments) — so the scheme is attacker-influenced the
// same way the four profile-image sinks were before PR #79. Validate here,
// once, rather than at each call site: all four consumers route through this
// component, so centralising the check closes them together.
//
// Reuse the existing `safeImageUrl` validator (pure; returns null rather than
// repairing) — do NOT add a second sanitizer here. A rejected URL takes the
// same no-render path a missing src already took, which is why the component
// keeps its "renders nothing" contract instead of guessing a fallback image.
//
// `srcSet` is destructured out and discarded. `...imgProps` is spread BEFORE
// `src`, and an HTML `srcset` with a matching candidate makes the browser
// ignore `src` entirely — so an unvalidated `srcSet` would otherwise be a
// straight bypass of the check below.

import { useState } from "react";
import { safeImageUrl } from "../../utils/safeImageUrl";

/**
 * @param {object} props
 * @param {string} props.src - remote image URL (no src → renders nothing)
 * @param {string} [props.alt]
 * @param {string} [props.className] - applied to the wrapper span
 * @param {string} [props.imgClassName] - applied to the rendered <img>
 * @param {string} [props.skeletonClassName] - extra classes for the skeleton
 */
export default function PulseImg({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  skeletonClassName = "bg-black/10",
  // Rendered inside the same wrapper when the image can't be shown -- either
  // the URL is missing/unsafe, or the request FAILED. The failure case is why
  // this exists: a stored file URL can 404/403/expire (signed URLs, a storage
  // migration, a deleted object), and without an error path the <img> sits at
  // opacity-0 forever behind the skeleton, so the caller got a bare coloured
  // block and no indication anything had gone wrong.
  fallback = null,
  // Pulled out of ...imgProps so it can be chained rather than clobbered --
  // callers that pass their own onError (e.g. AdminPaymentModal) were relying
  // on it surviving the spread.
  onError,
  // Deliberately discarded, see the note above. The leading underscore is
  // what keeps the linter from reporting it as unused.
  srcSet: _discardedSrcSet,
  ...imgProps
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const safeSrc = safeImageUrl(src);
  // No usable URL and nothing to fall back to keeps the original contract of
  // rendering nothing at all.
  if (!safeSrc && !fallback) return null;
  const showFallback = !safeSrc || failed;

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {!showFallback && !loaded && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 animate-pulse ${skeletonClassName}`}
        />
      )}
      {showFallback ? (
        // Centred in its own absolutely-positioned layer rather than by making
        // the wrapper a flex container: that keeps the <img> path (which fills
        // the box at w-full h-full) and the absolutely-positioned skeleton
        // exactly as they were, and only the fallback gains centring. Callers
        // used to wrap this in their own flex container, so the initials
        // rendered top-left once the fallback moved in here.
        <span className="absolute inset-0 flex items-center justify-center">{fallback}</span>
      ) : (
        <img
          {...imgProps}
          src={safeSrc}
          alt={alt}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            onError?.(e);
            setFailed(true);
          }}
          className={`block w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${imgClassName}`}
        />
      )}
    </span>
  );
}
