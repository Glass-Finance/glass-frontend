import { useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import CloudImage from "../common/CloudImage";
import CloudAspectImage from "../common/CloudAspectImage";

const isMobileScreen =
  typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

const ICON_POP_CSS = `
@keyframes iconPop {
  0%   { transform: scale(1) rotate(0deg); }
  35%  { transform: scale(1.28) rotate(-6deg); }
  65%  { transform: scale(0.92) rotate(3deg); }
  100% { transform: scale(1) rotate(0deg); }
}
.step-icon-pop { animation: iconPop 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }
`;

export default function StepRow({ step, index, innerRef, badgeRef, desktopLayout = "flow" }) {
  const iconRef = useRef(null);
  // The legacy flow layout alternates each fixed-width row's position.
  const hugRight = index % 2 === 0;
  const { scrollYProgress } = useScroll({
    target: innerRef,
    offset: ["start 90%", "end 10%"],
  });
  // On mobile lock to static values so Framer Motion never writes back to
  // the DOM on every scroll tick — scroll-linked opacity/y is a desktop
  // effect only. useScroll still runs so the icon-pop scroll threshold
  // fires correctly when the row enters the viewport on both breakpoints.
  const gridLayout = desktopLayout === "grid";
  const isGridDesktop =
    gridLayout && typeof window !== "undefined" && window.matchMedia("(min-width: 1041px)").matches;
  const rowOpacity = useTransform(
    scrollYProgress,
    isMobileScreen ? [0, 1] : isGridDesktop ? [0, 0.18] : [0, 0.18, 0.75, 1],
    isMobileScreen ? [1, 1] : isGridDesktop ? [0, 1] : [0, 1, 1, 0],
  );
  const rowY = useTransform(
    scrollYProgress,
    isMobileScreen ? [0, 1] : [0, 0.18],
    isMobileScreen ? [0, 0] : [40, 0],
  );

  useEffect(() => {
    let fired = false;
    const unsub = scrollYProgress.on("change", (v) => {
      if (!fired && v > 0.12 && iconRef.current) {
        fired = true;
        iconRef.current.classList.add("step-icon-pop");
        unsub();
      }
    });
    return unsub;
  }, [scrollYProgress]);

  const glassCardCls = isMobileScreen
    ? "bg-white border border-white/80 shadow-[0_8px_30px_rgba(15,29,110,0.1)]"
    : "bg-white/60 backdrop-blur-md [-webkit-backdrop-filter:blur(12px)] border border-white/80 shadow-[0_8px_30px_rgba(15,29,110,0.1)]";
  const glassSurfaceCls = isMobileScreen
    ? "bg-white"
    : "bg-white/85 backdrop-blur-md [-webkit-backdrop-filter:blur(12px)]";

  return (
    <>
      <style>{ICON_POP_CSS}</style>
      <motion.div
        ref={innerRef}
        className={gridLayout ? "min-[1041px]:h-full" : undefined}
        style={{ opacity: rowOpacity, y: rowY }}
      >
        {/* ── Mobile — label overlaps top-left of image ── */}
        <div
          className={`flex flex-col relative ${gridLayout ? "min-[1041px]:hidden" : "md:hidden"}`}
        >
          <div className="relative w-full rounded-lg overflow-hidden shadow-2xl shadow-brand-deep/15">
            <CloudAspectImage
              publicId={step.img.publicId}
              width={step.img.width}
              aspectRatio={step.img.aspect}
              sizes="100vw"
              alt={step.label}
              draggable={false}
              loading="lazy"
            />
            <div
              className={`absolute bottom-3 right-3 flex items-center gap-2 rounded-full py-2 px-3.5 border border-white/90 shadow-[0_4px_20px_rgba(15,29,110,0.14)] ${glassSurfaceCls}`}
            >
              <span className="w-[7px] h-[7px] rounded-full bg-brand flex-shrink-0 inline-block" />
              <span className="text-xs font-bold text-brand-ink">{step.badge}</span>
            </div>
          </div>
          <div
            className={`absolute -top-5 -left-2.5 w-[130px] rounded-xl py-3.5 px-3 flex flex-col items-center text-center z-20 ${glassCardCls}`}
          >
            <CloudImage
              publicId={step.stepIcon.publicId}
              alt=""
              width={step.stepIcon.width}
              objectFit="contain"
              imgRef={iconRef}
              className="w-8 h-8 mb-2"
            />
            <p className="text-xs font-bold text-brand-ink leading-[1.3] m-0">{step.label}</p>
          </div>
        </div>

        {gridLayout ? (
          <div className="hidden min-[1041px]:flex h-full min-h-[360px] flex-col overflow-hidden rounded-g-2 border border-[#e2e4ee] bg-white/80">
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full border border-[#e2e4ee] bg-white">
                <CloudImage
                  publicId={step.stepIcon.publicId}
                  alt=""
                  width={step.stepIcon.width}
                  objectFit="contain"
                  imgRef={iconRef}
                  className="h-5 w-5"
                />
              </div>
              <p className="m-0 text-[16px] font-semibold leading-snug text-brand-ink">
                {step.label}
              </p>
            </div>
            <div className="relative flex-1 overflow-hidden bg-[#f9f9fb]">
              <CloudAspectImage
                publicId={step.img.publicId}
                width={step.img.width}
                aspectRatio={step.img.aspect}
                sizes="(min-width: 768px) 50vw, 100vw"
                alt={step.label}
                draggable={false}
                loading="lazy"
              />
              <div
                ref={badgeRef}
                className={`absolute right-4 bottom-4 flex items-center gap-2 rounded-full border border-white/90 px-[18px] py-2.5 shadow-[0_4px_20px_rgba(15,29,110,0.14)] ${glassSurfaceCls}`}
              >
                <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-brand" />
                <span className="text-xs font-bold text-brand-ink">{step.badge}</span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`hidden md:flex relative items-center w-[min(720px,100%)] ${hugRight ? "ml-auto" : "mr-auto"}`}
          >
            <div
              className={`flex-shrink-0 w-[190px] rounded-2xl p-5 z-20 flex flex-col items-center text-center mr-[-30px] ${glassCardCls}`}
            >
              <CloudImage
                publicId={step.stepIcon.publicId}
                alt=""
                width={step.stepIcon.width}
                objectFit="contain"
                imgRef={iconRef}
                className="w-10 h-10 mb-2.5"
              />
              <p className="text-[13px] font-bold text-brand-ink leading-snug">{step.label}</p>
            </div>
            <div className="relative flex-1 rounded-3xl overflow-hidden shadow-2xl shadow-brand-deep/15">
              <CloudAspectImage
                publicId={step.img.publicId}
                width={step.img.width}
                aspectRatio={step.img.aspect}
                sizes="(min-width: 768px) 720px, 100vw"
                alt={step.label}
                draggable={false}
                loading="lazy"
              />
              <div
                ref={badgeRef}
                className={`absolute bottom-4 right-4 flex items-center gap-2 rounded-full py-2.5 px-[18px] border border-white/90 shadow-[0_4px_20px_rgba(15,29,110,0.14)] ${glassSurfaceCls}`}
              >
                <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0 inline-block" />
                <span className="text-xs font-bold text-brand-ink">{step.badge}</span>
              </div>
            </div>
            <div className="absolute top-3 right-[-8px] w-[calc(100%-160px)] h-full rounded-3xl border border-brand-deep/8 bg-[#EEF1FB]/45 -z-10" />
            <div className="absolute top-6 right-[-15px] w-[calc(100%-160px)] h-full rounded-3xl border border-brand-deep/4 bg-[#E8ECF8]/28 -z-20" />
          </div>
        )}
      </motion.div>
    </>
  );
}
