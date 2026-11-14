import { createRef, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import StepRow from "./StepRow";
import StepConnector from "./StepConnector";
import MobileDivider from "./MobileDivider";

// Shared by both the organizations and members landing pages — same
// structure, steps/CTA differ per caller.
export default function HowItWorksSection({
  steps,
  onCtaClick,
  ctaLabel = "Join Glass",
  desktopLayout = "flow",
}) {
  // createRef() (a plain function) instead of useRef() inside .map() —
  // calling useRef() in a loop violates the Rules of Hooks. Wrapping the
  // whole array in one useRef() keeps the ref objects stable across
  // re-renders while only calling the hook itself once.
  const stepRefs = useRef(steps.map(() => createRef())).current;
  const badgeRefs = useRef(steps.map(() => createRef())).current;
  const stackRef = useRef(null);
  const [badgePoints, setBadgePoints] = useState([]);
  const [bendYs, setBendYs] = useState([]);

  // The legacy flow layout anchors connectors to the actual badge positions,
  // so they stay correct when card text or image sizes change.
  useLayoutEffect(() => {
    function measure() {
      if (!stackRef.current) return;
      const containerRect = stackRef.current.getBoundingClientRect();
      const toLocal = (r) => ({
        x: r.left + r.width / 2 - containerRect.left,
        y: r.top + r.height / 2 - containerRect.top,
      });
      const points = badgeRefs.map((ref) => {
        const el = ref.current;
        return el ? toLocal(el.getBoundingClientRect()) : null;
      });
      const rowRects = stepRefs.map((ref) => ref.current?.getBoundingClientRect() ?? null);
      const bends = rowRects.slice(0, -1).map((rect, i) => {
        const next = rowRects[i + 1];
        if (!rect || !next) return null;
        const top = rect.bottom - containerRect.top;
        const bottom = next.top - containerRect.top;
        return (top + bottom) / 2;
      });
      setBadgePoints(points);
      setBendYs(bends);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (stackRef.current) ro.observe(stackRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="relative isolate overflow-hidden py-24" id="how-it-works">
      <div className="relative z-10 max-w-[880px] mx-auto px-6">
        <div className="text-center mb-12 md:mb-20">
          <motion.span
            initial={{ opacity: 0, y: -12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center border border-brand-deep/20 text-brand-deep text-[12px] font-semibold px-5 py-2 rounded-full mb-7"
          >
            How We Work
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-[clamp(26px,5vw,58px)] font-bold text-brand-ink leading-tight tracking-tight mb-5"
          >
            Launch Transparent Payments
            <br className="hidden md:block" /> in Minutes
          </motion.h2>
          <motion.p
            className="text-[17px] text-[#00000099] max-w-[720px] mx-auto leading-relaxed"
            initial={{ clipPath: "inset(0% 0% 100% 0%)", opacity: 0 }}
            whileInView={{ clipPath: "inset(0% 0% 0% 0%)", opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            Set up your community, link member payment methods, and let Glass handle the rest.
          </motion.p>
        </div>
      </div>

      <div
        className={`relative z-10 mx-auto ${
          desktopLayout === "grid" ? "max-w-[1248px] px-4" : "max-w-[1180px] px-6 md:px-10"
        }`}
      >
        <div
          ref={stackRef}
          className={`relative ${
            desktopLayout === "grid"
              ? "grid grid-cols-1 md:gap-y-4 min-[1041px]:grid-cols-2 min-[1041px]:gap-4"
              : "flex flex-col"
          }`}
        >
          {/* z-index below the rows (which get an explicit z-10 below) so
              the part of each line that would otherwise cross a card's
              face is hidden behind it — only the segments in the gaps
              between rows end up visible, matching the Figma reference. */}
          {desktopLayout === "flow" && (
            <svg
              className="hidden md:block pointer-events-none absolute inset-0 w-full h-full overflow-visible z-0"
              fill="none"
            >
              {/* stepRefs/badgeRefs hold ref OBJECTS built once via
                useRef(...).current at the top (the standard workaround for
                an array of refs, since useRef can't be called in a loop) --
                only the objects themselves are read here and passed down as
                props, never their .current value. The compiler's ref-safety
                check doesn't recognize this array-of-refs idiom and treats
                every read from stepRefs/badgeRefs as an unsafe ref access. */}
              {/* eslint-disable-next-line react-hooks/refs */}
              {steps.slice(0, -1).map((step, i) => {
                const p1 = badgePoints[i];
                const p2 = badgePoints[i + 1];
                if (!p1 || !p2) return null;
                return (
                  <StepConnector
                    key={step.num}
                    p1={p1}
                    p2={p2}
                    bendY={bendYs[i]}
                    stepRef={stepRefs[i]}
                  />
                );
              })}
            </svg>
          )}

          {/* Same ref-objects-only situation as above. */}
          {/* eslint-disable-next-line react-hooks/refs */}
          {steps.map((step, i) => (
            <div key={step.num} className="relative z-10">
              <StepRow
                step={step}
                index={i}
                innerRef={stepRefs[i]}
                badgeRef={badgeRefs[i]}
                desktopLayout={desktopLayout}
              />
              {i < steps.length - 1 && <MobileDivider />}
              {desktopLayout === "flow" && i < steps.length - 1 && (
                <div className="hidden md:block h-[90px]" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-[880px] mx-auto px-6">
        <div className="flex justify-center mt-12 md:mt-20">
          <motion.button
            onClick={onCtaClick}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="relative inline-flex items-center gap-3 bg-brand-ink text-white font-bold text-[14px] px-8 py-4 rounded-full overflow-hidden shadow-2xl shadow-brand-ink/25"
          >
            <motion.span
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
              whileHover={{ translateX: "250%" }}
              transition={{ duration: 0.5 }}
            />
            <span className="relative z-10">{ctaLabel}</span>
            <motion.svg
              className="relative z-10"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </motion.svg>
          </motion.button>
        </div>
      </div>
    </section>
  );
}
