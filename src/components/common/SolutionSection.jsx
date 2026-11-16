/**
 * Shared "our solution" section shell used by both the organizations and
 * members marketing pages. The card anatomy, tilt mechanics, entrance
 * keyframes, and layout are identical between them; only the badge/copy/
 * feature list vary — see organizations/OurSolution.jsx and
 * members/MembersSolution.jsx for the per-audience data.
 *
 * ── Figma fidelity ───────────────────────────────────────────────────────────
 * Every card is built to the Figma frame (592 × 380 card, 24px grid gap):
 *
 *   card      white @ 60%, 1px rim black @ 10%, 4px radius
 *   icon      64px ring (1px black @ 10%) holding a 30px #002FA7 glyph
 *   title     Inter 600, #001F6E          (orgs 22/28 · members 24/32)
 *   desc      Inter 400, 18px             (orgs 22px pitch · members 28px pitch)
 *   panel     "glass" frame 24px in from the left, 30px from the right, 8px top
 *             corners, 24px under the header, running off the bottom edge. It
 *             carries the two soft glows (blue left, purple right) that sit
 *             107px / 130px below the panel's top.
 *   artwork   bottom-anchored PNG per card, positioned as a % of card width.
 *
 * Everything is sized in container-query units (cqw) of the card, so at any
 * card width ≥ ~480px the card is a pixel-proportional scale of the Figma
 * frame (text wraps where Figma wraps, artwork keeps its position). Below
 * that, text/icon sizes bottom out at readable minimums and wrap naturally.
 *
 * The orgs and members frames were drawn with slightly different type metrics
 * in Figma; VARIANTS below carries each one faithfully.
 */

import { useCallback, useEffect, useRef } from "react";
import BlurText from "../ui/BlurText";
import CloudAspectImage from "./CloudAspectImage";

// ─── Figma constants (all in Figma px on a 592-wide card) ────────────────────
const CARD_W = 592;
const CARD_H = 380;
const cq = (px) => `${+((px / CARD_W) * 100).toFixed(3)}cqw`;
/** Scales with the card width, never above the Figma size nor below `min`. */
const fluid = (px, min) => `clamp(${min}px, ${cq(px)}, ${px}px)`;

const VARIANTS = {
  orgs: {
    titlePx: 22,
    titleLH: 26 / 22,
    descGap: 5.5,
    descLH: 22 / 18,
    descTracking: "0.027em",
    descColor: "rgba(0,0,0,0.6)",
  },
  members: {
    titlePx: 24,
    titleLH: 32 / 24,
    descGap: 4.5,
    descLH: 28 / 18,
    descTracking: "0",
    descColor: "#808080",
  },
};

// ── Glows ────────────────────────────────────────────────────────────────────
// Figma blurs two discs (blue #002FA7 left, purple #6B2FB5 right) behind the
// artwork. A blurred disc is a Gaussian, so each glow is a radial-gradient
// sampled from one: peak alpha `peak`, spread `sigma` (Figma px). Values were
// fitted against the exported frames (≈1% RMS error), not eyeballed.
const BLUE = "0,47,167";
const PURPLE = "107,47,181";
const gaussStops = (rgb, peak, sigma) =>
  [0, 0.5, 1, 1.5, 2, 2.5, 3]
    .map((k) => `rgba(${rgb},${(peak * Math.exp((-k * k) / 2)).toFixed(4)}) ${cq(k * sigma)}`)
    .join(",");
const glow = (rgb, peak, sigma, x, y) =>
  `radial-gradient(circle ${cq(3 * sigma)} at ${cq(x)} ${cq(y)},${gaussStops(rgb, peak, sigma)},transparent ${cq(3 * sigma)})`;

// Glow centres sit 107px (blue, x=128) / 130px (purple, x=425) below the
// panel's top edge, measured from the card's left edge.
const GLOW_REACH = 300; // how far above the panel the card-level glow layer extends
const CARD_GLOW = [
  glow(PURPLE, 0.177, 85.4, 425, GLOW_REACH + 130),
  glow(BLUE, 0.214, 85.4, 128, GLOW_REACH + 107),
].join(",");

// Inside the panel the artwork sits on a slightly richer surface than the card:
// an extra purple glow, a faint left→right tint, and a thin inner shadow along
// the top edge. Panel-relative coords: its padding box starts at (25, top+1).
const PANEL_BG = [
  // top inner shadow: e^(-y/6.6px) falloff
  `linear-gradient(180deg,rgba(0,0,0,0.049) 0,rgba(0,0,0,0.018) ${cq(6.6)},rgba(0,0,0,0.0066) ${cq(13.2)},rgba(0,0,0,0.0024) ${cq(19.8)},transparent ${cq(27)})`,
  "linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.196))",
  "linear-gradient(90deg,rgba(0,0,0,0.0069),rgba(0,0,0,0))",
  glow(PURPLE, 0.0935, 77.2, 400, 129),
].join(",");

// ─── Per-card tilt hook ───────────────────────────────────────────────────────
function useTilt(strength = 14) {
  const cardRef = useRef(null);
  const sheenRef = useRef(null);
  const rafRef = useRef(null);
  const cur = useRef({ rotX: 0, rotY: 0 });
  const tgt = useRef({ rotX: 0, rotY: 0 });
  const hovering = useRef(false);

  const lerp = (a, b, t) => a + (b - a) * t;

  const animate = useCallback(() => {
    const card = cardRef.current;
    const sheen = sheenRef.current;
    if (!card) return;

    cur.current.rotX = lerp(cur.current.rotX, tgt.current.rotX, hovering.current ? 0.12 : 0.08);
    cur.current.rotY = lerp(cur.current.rotY, tgt.current.rotY, hovering.current ? 0.12 : 0.08);

    const { rotX, rotY } = cur.current;
    const scale = hovering.current ? 1.03 : 1;
    card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(${scale},${scale},1)`;

    // The Figma card is flat at rest, so the shadow only appears while lifted.
    const sx = (-rotY * 1.2).toFixed(2);
    const sy = (rotX * 1.2).toFixed(2);
    card.style.boxShadow = hovering.current
      ? `${sx}px ${sy}px 40px rgba(28,43,138,0.14), 0 2px 8px rgba(0,0,0,0.05)`
      : "none";

    if (sheen) {
      const nx = (rotY / strength + 1) / 2;
      const ny = (-rotX / strength + 1) / 2;
      sheen.style.background = `radial-gradient(ellipse 55% 45% at ${(nx * 100).toFixed(1)}% ${(ny * 100).toFixed(1)}%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.04) 45%, transparent 70%)`;
      sheen.style.opacity = hovering.current ? "1" : "0";
    }

    const moving =
      Math.abs(cur.current.rotX - tgt.current.rotX) > 0.01 ||
      Math.abs(cur.current.rotY - tgt.current.rotY) > 0.01;

    // Self-referencing rAF loop: `animate` calls itself via the closure it
    // captures, only actually invoked after this const finishes assigning
    // (by the time a real frame fires) -- a standard pattern for a
    // rAF-driven animation, not an actual TDZ bug. Rewriting this as a
    // ref-indirected self-call to satisfy the compiler's static ordering
    // check isn't worth the risk of a visual regression I can't check here.
    if (moving || hovering.current)
      // eslint-disable-next-line react-hooks/immutability
      rafRef.current = requestAnimationFrame(animate);
    else rafRef.current = null;
  }, [strength]);

  const onMouseMove = useCallback(
    (e) => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      tgt.current.rotX =
        -((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * strength;
      tgt.current.rotY = ((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * strength;
    },
    [strength],
  );

  const onMouseEnter = useCallback(() => {
    hovering.current = true;
    if (!rafRef.current) rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const onMouseLeave = useCallback(() => {
    hovering.current = false;
    tgt.current = { rotX: 0, rotY: 0 };
    if (!rafRef.current) rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return { cardRef, sheenRef, onMouseMove, onMouseEnter, onMouseLeave };
}

// ─── Description: explicit Figma line breaks, natural wrap on small cards ────
function Desc({ lines }) {
  return lines.map((line, i) => (
    <span key={i}>
      {i > 0 && !lines[i - 1].endsWith("-") && " "}
      {i > 0 && <br className="sol-br" />}
      <span className="sol-line">{line}</span>
    </span>
  ));
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ Icon, title, desc, illustration, entryDelay, v }) {
  const { cardRef, sheenRef, onMouseMove, onMouseEnter, onMouseLeave } = useTilt(14);
  const lines = Array.isArray(desc) ? desc : [desc];
  const ring = fluid(64, 44);

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // overflow-clip (not -hidden): hidden makes this a scroll container, which zeroes the
      // aspect-ratio box's automatic min-height, so it could never grow to fit its content.
      // w-full: a stretched item with aspect-ratio and `width:auto` would otherwise derive
      // its width from the stretched height and overflow its grid column on narrow screens.
      className="relative flex w-full min-w-0 flex-col self-stretch overflow-clip rounded-[4px] bg-white/60 cursor-default will-change-transform"
      style={{
        containerType: "inline-size",
        aspectRatio: `${CARD_W} / ${CARD_H}`,
        // `backwards`, not `forwards`: a forwards fill would keep overriding the
        // inline transform the tilt hook writes, freezing the hover effect.
        animation: `glassCardIn 0.65s cubic-bezier(0.22,1,0.36,1) ${entryDelay}ms backwards`,
      }}
    >
      {/* Sheen */}
      <div
        ref={sheenRef}
        className="absolute inset-0 rounded-[4px] pointer-events-none z-20 transition-opacity duration-200 ease-in-out"
        style={{ opacity: 0 }}
      />
      {/* 1px rim, painted over the artwork like the Figma stroke */}
      <div className="absolute inset-0 rounded-[4px] border border-black/10 pointer-events-none z-30" />

      {/* Icon ring + text */}
      <div
        className="relative z-10 flex items-start"
        style={{ padding: `${fluid(32, 20)} ${fluid(24, 16)} 0`, gap: fluid(24, 12) }}
      >
        <span
          className="flex flex-none items-center justify-center rounded-full border border-black/10 text-[#002FA7]"
          style={{ width: ring, height: ring }}
        >
          <Icon style={{ width: fluid(30, 20), height: fluid(30, 20) }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className="sol-title m-0 font-semibold text-[#001F6E]"
            style={{ fontSize: fluid(v.titlePx, 16), lineHeight: v.titleLH }}
          >
            {title}
          </h3>
          <p
            className="m-0"
            style={{
              marginTop: fluid(v.descGap, 2),
              fontSize: fluid(18, 14),
              lineHeight: v.descLH,
              letterSpacing: v.descTracking,
              color: v.descColor,
            }}
          >
            <Desc lines={lines} />
          </p>
        </div>
      </div>

      {/* Glass panel. flex-1 so it absorbs whatever height the header leaves
          (1- vs 2-line descriptions, wrapped titles, grid row stretch); the
          artwork is bottom-anchored so it never moves. min-height keeps the
          panel tall enough for its artwork when the header wraps on small
          screens. */}
      <div
        className="relative flex-1 rounded-t-[8px] border border-b-0 border-white/80"
        style={{
          marginTop: fluid(24, 16),
          marginLeft: fluid(24, 16),
          marginRight: fluid(30, 16),
          minHeight: cq(illustration.h + 16),
          backgroundImage: PANEL_BG,
        }}
      >
        {/* Card-level glows: a card-wide layer anchored to the panel's top
            edge, so the haze also spills a little outside the panel. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -z-10"
          style={{
            left: `calc(${cq(-24)} - 1px)`,
            top: `calc(${cq(-GLOW_REACH)} - 1px)`,
            width: "100cqw",
            height: `calc(${cq(GLOW_REACH)} + 100% + 2px)`,
            backgroundImage: CARD_GLOW,
          }}
        />
      </div>

      {/* Artwork — positioned by its Figma offsets as a % of card width */}
      <div
        className="absolute bottom-0 z-10 select-none"
        style={{
          left: `${+((illustration.left / CARD_W) * 100).toFixed(3)}%`,
          width: `${+((illustration.w / CARD_W) * 100).toFixed(3)}%`,
        }}
      >
        <CloudAspectImage
          publicId={illustration.publicId}
          width={illustration.width}
          aspectRatio={`${illustration.w} / ${illustration.h}`}
          sizes="(min-width: 1140px) 480px, (min-width: 768px) 42vw, 90vw"
          alt={title}
          draggable={false}
          loading="lazy"
        />
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function SolutionSection({
  badge = "Our Solution",
  headline,
  subtext,
  subtextMaxWidth = "640px",
  features,
  variant = "orgs",
}) {
  const v = VARIANTS[variant] ?? VARIANTS.orgs;

  return (
    <>
      <style>{`
      @keyframes glassCardIn {
        from { opacity: 0; transform: perspective(900px) translateY(32px) rotateX(6deg); }
        to   { opacity: 1; transform: perspective(900px) translateY(0px) rotateX(0deg); }
      }
      /* Forced Figma line breaks only once the card is wide enough that the
         scaled text is guaranteed to fit; smaller cards wrap naturally. */
      .sol-br { display: none; }
      @container (min-width: 480px) {
        .sol-br { display: inline; }
        .sol-line, .sol-title { white-space: nowrap; }
      }
    `}</style>

      <section className="py-20 md:py-28 relative isolate" id="solution">
        <div className="max-w-[1140px] mx-auto px-6 relative z-30">
          {/* ── Header — BlurText on all three elements ── */}
          <div className="text-center mb-12">
            <div className="mb-5 flex justify-center">
              <span className="inline-flex items-center border border-brand-deep/25 text-brand-deep text-[13px] font-medium px-5 py-2 rounded-full">
                {badge}
              </span>
            </div>

            <h2 className="text-[clamp(26px,5vw,58px)] font-bold text-brand-ink leading-[1.15] tracking-[-0.02em] mb-4">
              <BlurText
                text={headline}
                animateBy="words"
                direction="top"
                delay={55}
                stepDuration={0.42}
                centered
              />
            </h2>

            <p
              className="text-[clamp(15px,2vw,17px)] text-black/60 mx-auto leading-[1.7]"
              style={{ maxWidth: subtextMaxWidth }}
            >
              {subtext}
            </p>
          </div>

          {/* ── Cards (Figma gap: 24px) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map(({ Icon, title, desc, illustration }, i) => (
              <FeatureCard
                key={title}
                Icon={Icon}
                title={title}
                desc={desc}
                illustration={illustration}
                entryDelay={200 + i * 120}
                v={v}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
