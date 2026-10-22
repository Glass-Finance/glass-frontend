import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { cldUrl } from "../../lib/cloudinary";
import BlurText from "../ui/BlurText";
import VariableProximity from "../ui/VariableProximity";
import CloudAspectImage from "../common/CloudAspectImage";
import { LandingCta } from "../ui/LandingCta";

/* Wave background and phone mockup — Cloudinary (glass/hero/hero,
   glass/hero/iphone, see docs/cloudinary.md). The iphone is a natural-
   aspect image (w-full h-auto): CloudImage's fixed box can't drive
   intrinsic aspect ratio, but CloudAspectImage's wrapper reserves it via
   CSS aspect-ratio, so both copies hold their space before load. */
const waveBg = cldUrl("glass/hero/hero", { width: 1920 });
const IPHONE = {
  width: 1240,
  sizes: "(min-width: 640px) 55vw, 330px",
  // Intrinsic dimensions of glass/hero/iphone (876 x 791) — reserves the
  // mockup's space before the image lands so the hero never layout-snaps.
  aspect: "876 / 791",
};

export default function MembersHero() {
  const navigate = useNavigate();
  const sectionRef = useRef(null);
  const containerRef = useRef(null);

  function handleJoin() {
    navigate("/member/join");
  }

  useEffect(() => {
    // index.css sets `scroll-behavior: smooth` globally for anchor links —
    // that also hijacks plain scrollTo() calls, turning this reset into a
    // visible multi-hundred-ms slide instead of an instant jump. Suppressing
    // it has to survive past the browser's next paint, or restoring it
    // synchronously here wins the race and the scroll still animates.
    const root = document.documentElement;
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      root.style.scrollBehavior = prevBehavior;
    });
  }, []);

  useEffect(() => {
    const canvas = document.getElementById("members-hero-canvas");
    if (!canvas) return;
    const draw = () => {
      canvas.width = canvas.offsetWidth || window.innerWidth;
      canvas.height = canvas.offsetHeight || window.innerHeight;
      const ctx = canvas.getContext("2d");
      const img = ctx.createImageData(canvas.width, canvas.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() > 0.5 ? 255 : 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <>
      <style>{`
      @keyframes waveDrift {
        0%   { transform: scale(1.06) translate(0px, 0px); }
        30%  { transform: scale(1.09) translate(-16px, -8px); }
        65%  { transform: scale(1.07) translate(12px, -14px); }
        100% { transform: scale(1.06) translate(0px, 0px); }
      }
      @media (max-width: 640px) {
        .hero-wave-bg { animation: none !important; transform: scale(1.06) !important; will-change: auto !important; }
      }
    `}</style>
      <section
        ref={sectionRef}
        className="relative min-h-screen flex flex-col justify-center pt-[68px] overflow-hidden"
      >
        {/* Wave background */}
        <div
          className="hero-wave-bg absolute inset-0 w-full h-full"
          style={{
            backgroundImage: `url(${waveBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "waveDrift 28s ease-in-out infinite",
            willChange: "transform",
          }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(2,3,18,0.82)_0%,rgba(3,4,22,0.78)_35%,rgba(6,3,20,0.65)_60%,rgba(10,4,24,0.45)_100%)]" />

        <canvas
          id="members-hero-canvas"
          className="absolute inset-0 pointer-events-none select-none w-full h-full opacity-[0.035] mix-blend-screen"
        />

        {/* ── DESKTOP ── */}
        <div className="hidden sm:flex relative z-10 w-full max-w-[1280px] mx-auto px-8 lg:px-16 min-h-[calc(100vh-68px)] flex-row items-center">
          {/* Left: Text */}
          <div
            ref={containerRef}
            className="flex flex-col justify-start pt-8 w-[45%] flex-shrink-0 relative -mt-[60px]"
          >
            {/* Line 1 */}
            <div className="text-[clamp(38px,5.8vw,62px)] font-bold leading-[1.05] tracking-[-0.03em] mb-0.5">
              <BlurText
                text="Pay Your Dues"
                delay={80}
                animateBy="words"
                direction="top"
                stepDuration={0.36}
                className="text-white block"
              />
            </div>

            {/* Line 2 */}
            <div className="mb-6 text-white text-[clamp(38px,5.8vw,62px)] font-bold leading-[1.05] tracking-[-0.03em]">
              <BlurText
                text="Effortlessly"
                delay={400}
                animateBy="words"
                direction="top"
                stepDuration={0.42}
                className="block"
              />
            </div>

            {/* Sub-text */}
            <div className="mb-8 max-w-[420px]">
              <VariableProximity
                label="Stop sending screenshots of receipts. Get instant proof of payment, track your history, and never miss a deadline again."
                s
                fromFontVariationSettings="'wght' 300, 'opsz' 9"
                toFontVariationSettings="'wght' 700, 'opsz' 40"
                containerRef={containerRef}
                radius={140}
                falloff="gaussian"
                className="text-[15px] text-[rgba(255,255,255,0.55)] leading-[1.7]"
              />
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
                delay: 1.4,
              }}
            >
              <LandingCta onClick={handleJoin} className="shadow-lg shadow-black/30">
                Join A Community
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="inline-flex items-center"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </motion.span>
              </LandingCta>
            </motion.div>
          </div>

          {/* Right: iPhone */}
          <div className="relative self-stretch flex items-end justify-start w-[55%] pb-0">
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1.2,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.25,
              }}
              className="relative w-[min(95%,620px)] -ml-[90px]"
            >
              {/* loading="lazy" here (and on the mobile copy below) is
                deliberate, not an oversight: this and the mobile-only
                <img> further down both render the same iphone.webp,
                one hidden via `hidden sm:flex` and the other via
                `sm:hidden`. display:none doesn't stop an eager <img> from
                fetching, so without this every visitor downloaded BOTH
                copies. Browsers skip fetching a lazy image with no
                generated box (i.e. currently display:none), so only the
                one actually visible at the matching breakpoint loads --
                whichever one that is still loads promptly since it's in
                the initial viewport, "lazy" here just means "skip if
                hidden," not "defer until scrolled to." */}
              <CloudAspectImage
                publicId="glass/hero/iphone"
                width={IPHONE.width}
                sizes={IPHONE.sizes}
                aspectRatio={IPHONE.aspect}
                alt="Glass app on iPhone"
                className="relative z-10 w-full"
                imgClassName="object-contain"
                draggable={false}
                loading="lazy"
              />
            </motion.div>
          </div>
        </div>

        {/* ── MOBILE ── */}
        {/* Taken out of the section's flex/justify-center flow and pinned to
          inset:0 instead — that way the phone mockup below can be
          absolutely bottom-pinned to the actual screen edge (filling it on
          any phone height) without the section's centering logic shifting
          the whole group up and leaving a gap underneath. */}
        <div className="sm:hidden absolute top-[68px] left-0 right-0 bottom-0 z-10 flex flex-col">
          <div ref={containerRef} className="px-6 pt-30 relative">
            <div className="text-[clamp(38px,10vw,56px)] font-semibold leading-[1.05] tracking-[-0.03em] mb-0.5">
              <BlurText
                text="Pay Your Dues"
                delay={80}
                animateBy="words"
                direction="top"
                stepDuration={0.36}
                className="text-white block"
              />
            </div>
            <div className="mb-6 text-white text-[clamp(38px,10vw,62px)] font-semibold leading-[1.05] tracking-[-0.03em]">
              <BlurText
                text="Effortlessly"
                delay={400}
                animateBy="words"
                direction="top"
                stepDuration={0.42}
                className="block"
              />
            </div>
            <p className="text-[15px] leading-relaxed mb-8 text-white/50">
              Stop sending screenshots of receipts. Get instant proof of payment, track your
              history, and never miss a deadline again.
            </p>
            <LandingCta onClick={handleJoin} className="shadow-lg shadow-black/30">
              Join A Community
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="inline-flex items-center"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.span>
            </LandingCta>
          </div>

          {/* Phone on mobile — pinned to the screen's bottom edge so it
            always fills flush to the bottom regardless of phone height,
            instead of floating with a gap beneath it. Cropped from the
            top (items-end) if it doesn't fit, never from the bottom. */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end overflow-hidden max-h-[58vh]">
            <div className="relative w-[330px]">
              {/* See the desktop copy of this <img> above for why
                loading="lazy" is deliberate here, not an oversight. */}
              <CloudAspectImage
                publicId="glass/hero/iphone"
                width={IPHONE.width}
                sizes={IPHONE.sizes}
                aspectRatio={IPHONE.aspect}
                alt="Glass app on iPhone"
                className="relative z-10 w-full"
                imgClassName="drop-shadow-[0_16px_40px_rgba(120,10,160,0.5)]"
                draggable={false}
                loading="lazy"
              />
            </div>
          </div>
        </div>

        {/* Bottom fades */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 hidden sm:block h-10 bg-[linear-gradient(to_top,rgba(229,229,229,0.97)_0%,rgba(229,229,229,0.65)_35%,rgba(229,229,229,0.1)_75%,transparent_100%)]" />
      </section>
    </>
  );
}
