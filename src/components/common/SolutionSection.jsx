/**
 * Shared "our solution" section shell used by both the organizations and
 * members marketing pages. The tilt-card mechanics, entrance keyframes,
 * and layout are identical between them; only the badge/copy/feature
 * list vary — see organizations/OurSolution.jsx and
 * members/MembersSolution.jsx for the per-audience data.
 */

import { useCallback, useEffect, useRef } from "react";
import BlurText from "../ui/BlurText";
import CloudImage from "./CloudImage";
import CloudAspectImage from "./CloudAspectImage";

const lightBg = { publicId: "glass/solution/bg-light", width: 1200 };

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

    const sx = (-rotY * 1.2).toFixed(2);
    const sy = (rotX * 1.2).toFixed(2);
    card.style.boxShadow = hovering.current
      ? `0 0 0 1px rgba(255,255,255,0.85) inset, ${sx}px ${sy}px 40px rgba(28,43,138,0.16), 0 2px 8px rgba(0,0,0,0.06)`
      : "0 0 0 1px rgba(255,255,255,0.75) inset, 0 2px 12px rgba(28,43,138,0.07), 0 1px 3px rgba(0,0,0,0.05)";

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

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, illustration, entryDelay }) {
  const { cardRef, sheenRef, onMouseMove, onMouseEnter, onMouseLeave } = useTilt(14);

  return (
    <div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="relative rounded-[14px] bg-[#EFEFF1] shadow-[0_0_0_1px_rgba(255,255,255,0.75)_inset,0_2px_12px_rgba(28,43,138,0.07),0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col cursor-default will-change-transform [transform-style:preserve-3d] opacity-0"
      style={{
        animation: `glassCardIn 0.65s cubic-bezier(0.22,1,0.36,1) ${entryDelay}ms forwards`,
      }}
    >
      {/* Sheen */}
      <div
        ref={sheenRef}
        className="absolute inset-0 rounded-[14px] pointer-events-none z-20 transition-opacity duration-200 ease-in-out"
        style={{ opacity: 0 }}
      />

      {/* Icon + text */}
      <div className="flex items-start gap-3 [padding:clamp(16px,3vw,28px)_clamp(14px,2.5vw,20px)_0px]">
        <CloudImage
          publicId={icon.publicId}
          alt=""
          width={icon.width}
          objectFit="contain"
          className="[width:clamp(36px,5vw,50px)] [height:clamp(36px,5vw,50px)] flex-shrink-0"
        />
        <div className="min-w-0">
          {/* Title types first */}
          <h3 className="text-[clamp(16px,2.5vw,18px)] font-bold text-brand-ink leading-[1.3] mb-1.5">
            {title}
          </h3>

          <p className="text-[clamp(14px,2vw,14px)] text-black/60 leading-[1.6] m-0">{desc}</p>
        </div>
      </div>

      {/* Illustration — flex-1 (not a fixed height) so this box absorbs
          whatever extra height CSS Grid's row-stretch adds when a sibling
          card's longer description wraps to more lines; a fixed height
          here left that leftover space as a visible gap below the image,
          which also made the bottom-anchored image read as too small/cut
          off short of the card's real bottom edge (#151). The clamp still
          sets the natural/minimum size when no stretch is happening. */}
      <div className="solution-illus relative flex-1 [min-height:clamp(160px,45vw,240px)] overflow-hidden">
        <CloudImage
          publicId={lightBg.publicId}
          alt=""
          width={lightBg.width}
          className="absolute inset-0 opacity-30"
          draggable={false}
        />
        <div className="solution-fade absolute top-0 left-0 right-0 h-[18%] bg-[linear-gradient(to_bottom,#EFEFF1_0%,rgba(239,239,241,0.7)_55%,transparent_100%)] pointer-events-none z-[5]" />
        <CloudAspectImage
          publicId={illustration.publicId}
          width={illustration.width}
          aspectRatio={illustration.aspect}
          sizes="(min-width: 768px) 50vw, 85vw"
          alt={title}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[85%] z-10"
          imgClassName="object-contain"
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
  wide = false,
}) {
  return (
    <>
      <style>{`
      @keyframes glassCardIn {
        from { opacity: 0; transform: perspective(900px) translateY(32px) rotateX(6deg); }
        to   { opacity: 1; transform: perspective(900px) translateY(0px) rotateX(0deg); }
      }
      @media (min-width: 640px) and (max-width: 1023px) {
        .solution-illus { min-height: 180px !important; }
        .solution-fade { height: 8% !important; background: linear-gradient(to bottom, #EFEFF1 0%, transparent 100%) !important; }
      }
    `}</style>

      <section className="py-20 md:py-28 relative isolate" id="solution">
        <div
          className={`relative z-30 mx-auto ${
            wide ? "max-w-[1140px] px-6 lg:max-w-[1280px] lg:px-8" : "max-w-[1140px] px-6"
          }`}
        >
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

          {/* ── Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map(({ icon, title, desc, illustration }, i) => (
              <FeatureCard
                key={title}
                icon={icon}
                title={title}
                desc={desc}
                illustration={illustration}
                entryDelay={200 + i * 120}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
