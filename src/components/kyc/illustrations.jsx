// KYC illustration system — two families, one source of truth:
//   - Art  : flat scene illustrations from unDraw (open license, no
//            attribution required), stored in src/assets/kyc/ and inlined
//            via vite-plugin-svgr (`*.svg?react`). The unDraw accent
//            (#6c63ff) was rewritten to `currentColor` in the source files,
//            so the `color` prop drives each scene's accent and every scene
//            carries a semantic default (brand / success / pending /
//            danger). Scenes are single-accent (the rest is neutral gray),
//            so callers' `tint` props are accepted without effect.
//   - Glyph: Phosphor duotone marks (@phosphor-icons/react, MIT) for the
//            stepper and rows — small sizes need crisp vector glyphs, not
//            scenes. lucide stays out of the step content entirely and is
//            only used for chrome (X, arrows, history).
//
// Defaults read the design tokens directly — never hardcode brand or
// danger hexes here; --color-brand / --color-success / --color-danger are
// the single source. Scene files: unDraw.co (personal-information,
// personal-documents, celebration, loading, upload-warning, taking-selfie).

import {
  Check,
  CurrencyCircleDollar,
  FileText,
  IdentificationCard,
  LockKey,
  Pulse,
  Scan,
  ShieldCheck,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";
import CaptureScene from "../../assets/kyc/capture-documents.svg?react";
import SuccessScene from "../../assets/kyc/success-celebration.svg?react";
import PendingScene from "../../assets/kyc/pending-loading.svg?react";
import RejectedScene from "../../assets/kyc/rejected-warning.svg?react";
import FaceScanScene from "../../assets/kyc/face-scan.svg?react";

// Scene wrapper: props-compatible with the original hand-drawn arts
// (size / className / color). The SVG scales inside its square box via the
// default preserveAspectRatio, so non-square sources letterbox cleanly.
function sceneFor(Scene, fallback) {
  return function SceneArt({ size = 48, className = "", color } = {}) {
    return (
      <Scene
        width={size}
        height={size}
        className={className}
        style={{ color: color ?? fallback }}
        aria-hidden="true"
      />
    );
  };
}

// ── Arts (larger scenes) ────────────────────────────────────────────────────

export const IdCardArt = sceneFor(CaptureScene, "var(--color-brand)");
export const FaceScanArt = sceneFor(FaceScanScene, "var(--color-brand)");
export const CheckBadgeArt = sceneFor(SuccessScene, "var(--color-success)");
export const ClockArt = sceneFor(PendingScene, "var(--color-warning)");
export const AlertArt = sceneFor(RejectedScene, "var(--color-danger)");

export function ShieldLockArt({ size = 48, className = "", color } = {}) {
  return (
    <ShieldCheck
      size={size}
      weight="duotone"
      className={className}
      style={{ color: color ?? "var(--color-brand)" }}
      aria-hidden="true"
    />
  );
}

// ── Glyphs (stepper + rows) — Phosphor duotone, currentColor ────────────────

function glyphFor(Glyph, fallbackSize = 18) {
  return function GlyphArt({ size = fallbackSize, className = "" } = {}) {
    return <Glyph size={size} weight="duotone" className={className} aria-hidden="true" />;
  };
}

export const GlyphOverview = glyphFor(SquaresFour);
export const GlyphIdCard = glyphFor(IdentificationCard);
export const GlyphFaceScan = glyphFor(Scan);
export const GlyphStatus = glyphFor(Pulse, 18);
export const GlyphCheckMark = glyphFor(Check, 12);
export const GlyphLock = glyphFor(LockKey, 13);
export const GlyphCommunity = glyphFor(UsersThree, 17);
export const GlyphPlans = glyphFor(FileText, 17);
export const GlyphPayout = glyphFor(CurrencyCircleDollar, 17);

// ── Composite pieces ─────────────────────────────────────────────────────────

// Viewfinder-style capture frame: rounded rectangle with corner brackets
// and a dashed inner guide. Children (the ghost ID illustration) sit
// centered inside. Used even on desktop/file-picker flows — the frame is
// the promise of what the secure window will ask for.
export function ViewfinderFrame({ children, className = "" }) {
  const corner = "absolute w-7 h-7 border-brand border-[2.5px]";
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 rounded-[18px] border border-dashed border-brand/30" />
      <span className={`${corner} top-0 left-0 border-r-0 border-b-0 rounded-tl-[14px]`} />
      <span className={`${corner} top-0 right-0 border-l-0 border-b-0 rounded-tr-[14px]`} />
      <span className={`${corner} bottom-0 left-0 border-r-0 border-t-0 rounded-bl-[14px]`} />
      <span className={`${corner} bottom-0 right-0 border-l-0 border-t-0 rounded-br-[14px]`} />
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// Trust/reassurance line — placed directly under sensitive content (brief
// item 5), never buried in a footer disclaimer.
export function TrustNote({ children, className = "" }) {
  return (
    <p
      className={`flex items-start gap-1.5 text-[11.5px] text-ink-muted leading-[1.5] m-0 ${className}`}
    >
      <ShieldLockArt size={14} className="flex-shrink-0 mt-[1px]" />
      <span>{children}</span>
    </p>
  );
}
