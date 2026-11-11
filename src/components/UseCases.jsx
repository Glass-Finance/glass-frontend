import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import BlurText from "./ui/BlurText";
import { cldUrl, cldSrcSet } from "../lib/cloudinary";
import { goToApp } from "../utils/deviceRedirect";
import { USECASE_PHOTOS } from "./usecasePhotos";

// ─── Carousel geometry ──────────────────────────────────────────────────────
// Featured width = calc(100% - 352px - --T): 352 = strips (152+96+56) + 3
// gaps; --T absorbs the hovered strip's tease growth so the other strips keep
// their exact rest widths. Strips are absolutely positioned (left calc) so
// each box animates independently. ALL geometry motion (promote + hover tease)
// runs through one WAAPI FLIP pipeline — no CSS transitions on the boxes,
// because a running CSS transition poisons getBoundingClientRect() during the
// FLIP measurement (it reports the old, mid-transition value).
const STRIP_W = [152, 96, 56];
const TEASE_ADD = 40;
const GAP = 16;
const STRIPS_PLUS_GAPS = 352;
const CARD_H = "h-[340px] md:h-[420px]";
const TICK_MS = 4500;
const SLIDE_MS = 650;
const SLIDE_EASE = [0.22, 1, 0.36, 1];
const TEASE_MS = 300;
const PHOTO_WIDTHS = [640, 960, 1280, 1600];
const STRIP_SRC_W = [320, 640, 960];
const PHOTO_QUALITY = "auto:best";
const PHOTO_SIZES = "(max-width: 768px) calc(100vw - 48px), 732px";
const STRIP_SIZES = "152px";
const WARM_TIMEOUT_MS = 3000;

const cases = [
  {
    title: "Schools & Alumni",
    body: "One payment link for school fees, PTA levies and alumni dues — parents pay from any bank and your bursar sees every payment land live.",
    variant: "schools",
  },
  {
    title: "Professional Bodies",
    body: "Members pay dues and certification fees in seconds, with automatic reminders and receipts handled for them.",
    variant: "professional",
  },
  {
    title: "Clubs & Associations",
    body: "Monthly dues, event fees and levies in one place — nudge anyone outstanding with a single tap.",
    variant: "clubs",
  },
  {
    title: "Religious Organizations",
    body: "Tithes, offerings and pledges recorded as they arrive, giving your leadership a clear shared record.",
    variant: "religious",
  },
];

const pools = cases.map((c) => USECASE_PHOTOS[c.variant]);

function pickWidth() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth <= 768 ? window.innerWidth - 48 : 732;
  const need = Math.min(Math.ceil(cssW * dpr), 1600);
  return PHOTO_WIDTHS.find((w) => w >= need) ?? 1600;
}

export default function UseCases() {
  const [active, setActive] = useState(0);
  // One image index per category: a category's strip preview and its featured
  // slot always show the same variant — demoting never swaps the image, so
  // nothing pops or reappears during the promote.
  const [imgIdx, setImgIdx] = useState(() =>
    cases.map((_, i) => Math.floor(Math.random() * pools[i].length)),
  );
  const [tease, setTease] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [inView, setInView] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const sectionRef = useRef(null);
  const rowRef = useRef(null);
  const boxRefs = useRef([]);
  const flipRef = useRef(null);
  const warmRef = useRef(new Set());
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const order = [0, 1, 2, 3].map((i) => (active + i) % cases.length);
  const teased = tease !== null && tease !== active;
  const teaseDelta = teased ? TEASE_ADD : 0;
  const slotWidth = (slot) => STRIP_W[slot - 1] + (teased && tease === order[slot] ? TEASE_ADD : 0);
  const stripLeft = (slot) => {
    let off = GAP;
    if (slot >= 2) off += slotWidth(1) + GAP;
    if (slot >= 3) off += slotWidth(2) + GAP;
    return `calc(100% - ${STRIPS_PLUS_GAPS}px - var(--T) + ${off}px)`;
  };

  // Warm the exact resource an <img> will select (same srcset + sizes).
  const warm = useCallback((pid, mode) => {
    const key = `${mode}:${pid}`;
    if (warmRef.current.has(key)) return Promise.resolve();
    warmRef.current.add(key);
    const featured = mode === "featured";
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(resolve, WARM_TIMEOUT_MS);
      const settle = () => {
        clearTimeout(timer);
        resolve(pid);
      };
      img.sizes = featured ? PHOTO_SIZES : STRIP_SIZES;
      img.srcset = cldSrcSet(pid, featured ? PHOTO_WIDTHS : STRIP_SRC_W, {
        quality: PHOTO_QUALITY,
      });
      img.src = cldUrl(pid, {
        width: featured ? pickWidth() : 640,
        quality: PHOTO_QUALITY,
      });
      if (img.decode) img.decode().then(settle, settle);
      else img.onload = settle;
      img.onerror = settle;
    });
  }, []);

  // Always ready: every category's current variant at featured size (a click
  // promotes it with no fetch) and its NEXT variant (autoplay promotes with
  // fresh image variety on every visit).
  useEffect(() => {
    pools.forEach((pool, i) => {
      const len = pool.length;
      warm(pool[imgIdx[i]].publicId, "featured");
      warm(pool[(imgIdx[i] + 1) % len].publicId, "featured");
      warm(pool[imgIdx[i]].publicId, "strip");
    });
  }, [imgIdx, warm]);

  // Entrance reveal (one-shot) + live in-view flag for autoplay gating.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) {
          setRevealed(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Capture all four boxes' geometry (relative to the row) BEFORE the state
  // change; useLayoutEffect then plays the FLIP before paint — no flash.
  const capture = useCallback(() => {
    const row = rowRef.current;
    if (!row) return null;
    const rowRect = row.getBoundingClientRect();
    const boxes = {};
    cases.forEach((c, i) => {
      const el = boxRefs.current[i];
      if (!el) return;
      const r = el.getBoundingClientRect();
      boxes[i] = { x: r.x - rowRect.x, w: r.width };
    });
    return { boxes };
  }, []);

  // Any geometry-affecting state change records First + timing, then flips.
  const flipThen = useCallback(
    (mutate, ms, easing) => {
      const c = capture();
      if (c) flipRef.current = { ...c, ms, easing };
      mutate();
    },
    [capture],
  );

  // `advance` = autoplay tick: the incoming category reveals the NEXT variant
  // of its image pool (show-diversity). A click keeps the exact peeked image.
  const promote = useCallback(
    (cat, advance) => {
      if (cat === active) return;
      flipThen(
        () => {
          // Clear tease only for the promoted box (functional update: keeps
          // this callback's deps stable so hovering never resets the timer).
          setTease((t) => (t === cat ? null : t));
          if (advance) {
            setImgIdx((prev) => {
              const next = [...prev];
              next[cat] = (next[cat] + 1) % pools[cat].length;
              return next;
            });
          }
          setActive(cat);
        },
        SLIDE_MS,
        `cubic-bezier(${SLIDE_EASE.join(",")})`,
      );
    },
    [active, flipThen],
  );

  // FLIP: each box animates its own left + width from First to Last —
  // promoted expands into the featured slot, the old featured demotes into
  // its strip slot, the middle strips slide over. Running animations are
  // finished first so Last is measured from the real base styles (a chained
  // tease/promote starts visually from where the box currently is). Four
  // boxes, one continuous motion; same DOM nodes throughout.
  useLayoutEffect(() => {
    const first = flipRef.current;
    flipRef.current = null;
    if (!first || reduce) return;
    const row = rowRef.current;
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    cases.forEach((c, i) => {
      const el = boxRefs.current[i];
      const f = first.boxes[i];
      if (!el || !f) return;
      el.getAnimations().forEach((a) => a.finish());
      const r = el.getBoundingClientRect();
      if (!r.width) return; // hidden on mobile
      const last = { x: r.x - rowRect.x, w: r.width };
      if (Math.abs(f.x - last.x) < 2 && Math.abs(f.w - last.w) < 2) return;
      el.animate(
        [
          { left: `${f.x}px`, width: `${f.w}px` },
          { left: `${last.x}px`, width: `${last.w}px` },
        ],
        { duration: first.ms, easing: first.easing },
      );
    });
  }, [active, tease, imgIdx, reduce]);

  // Autoplay: promote the next category every tick (ring order), continuously
  // while in view — hover does not pause (Stripe-like). Paused for reduced
  // motion, hidden tabs, and keyboard focus.
  const playing = inView && !focused && !tabHidden && !reduce;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => promote((active + 1) % cases.length, true), TICK_MS);
    return () => clearInterval(id);
  }, [playing, active, promote]);

  const enter = `uc-enter ${revealed ? "uc-in" : ""}`;
  const featured = cases[active];

  // Pause on keyboard focus anywhere in the section.
  const handleFocus = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFocused(true);
  };
  const handleBlur = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFocused(false);
  };

  return (
    <section
      ref={sectionRef}
      id="use-cases"
      className="pt-20 pb-0 md:pt-28 relative isolate overflow-hidden"
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <style>{`
        @keyframes ucEnter {
          from { opacity: 0; transform: translateY(26px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .uc-enter { opacity: 0; }
        .uc-in { animation: ucEnter 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .uc-enter, .uc-in { animation: none; }
          .uc-enter { opacity: 1; transform: none; }
        }
      `}</style>

      <div className="max-w-[1140px] mx-auto px-6 relative z-10">
        {/* ── Header — centered, original sizing (uniform with other sections) ── */}
        <div className={`${enter} text-center mb-14`} style={{ animationDelay: "0ms" }}>
          <div className="mb-5 flex justify-center">
            <span className="inline-flex items-center border border-brand-deep/25 text-brand-deep text-[13px] font-medium px-5 py-2 rounded-full">
              Use Cases
            </span>
          </div>
          <div className="flex justify-center mb-4">
            <h2 className="text-[clamp(26px,5.5vw,64px)] font-bold text-brand-ink leading-[1.15] tracking-[-0.02em] max-w-[1080px] text-center">
              <BlurText
                text="Built for every Nigerian community"
                animateBy="words"
                direction="top"
                delay={65}
                stepDuration={0.42}
                centered
              />
            </h2>
          </div>
          <div className="flex justify-center">
            <p className="text-[clamp(15px,2vw,17px)] text-black/60 max-w-[700px] leading-[1.7] text-center">
              Whether you run a small club or a national association, Glass scales with you.
            </p>
          </div>
        </div>

        {/* ── Visual row — featured + filmstrips; promote is an exact FLIP ── */}
        <div
          className={`${enter} relative overflow-hidden ${CARD_H}`}
          style={{ animationDelay: "120ms", "--T": `${teaseDelta}px` }}
          ref={rowRef}
          role="group"
          aria-roledescription="carousel"
          aria-label="Use cases"
        >
          {cases.map((c, cat) => {
            const slot = order.indexOf(cat);
            const isFeatured = slot === 0;
            const photo = pools[cat][imgIdx[cat]];
            const boxCls = isFeatured
              ? "absolute left-0 top-0 h-full z-10 overflow-hidden rounded-sm bg-white shadow-[0_0_0_1px_rgba(28,43,138,0.06),0_4px_24px_rgba(28,43,138,0.08)] w-full md:w-[calc(100%_-_352px_-_var(--T))]"
              : "hidden md:block absolute top-0 h-full overflow-hidden rounded-sm bg-[#F5F7FD]";
            const boxStyle = isFeatured
              ? undefined
              : { left: stripLeft(slot), width: slotWidth(slot) };
            return (
              <div
                key={cat}
                ref={(el) => {
                  boxRefs.current[cat] = el;
                }}
                className={boxCls}
                style={boxStyle}
              >
                <img
                  data-featured={isFeatured ? "true" : undefined}
                  src={cldUrl(photo.publicId, {
                    width: isFeatured ? pickWidth() : 640,
                    quality: PHOTO_QUALITY,
                  })}
                  srcSet={cldSrcSet(photo.publicId, isFeatured ? PHOTO_WIDTHS : STRIP_SRC_W, {
                    quality: PHOTO_QUALITY,
                  })}
                  sizes={isFeatured ? PHOTO_SIZES : `${STRIP_W[slot - 1]}px`}
                  alt={isFeatured ? photo.alt : ""}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                {!isFeatured && (
                  <button
                    type="button"
                    aria-label={`Show ${c.title}`}
                    onClick={(e) => {
                      if (e.detail > 0) e.currentTarget.blur();
                      promote(cat, false);
                    }}
                    onMouseEnter={() => {
                      if (tease !== cat) flipThen(() => setTease(cat), TEASE_MS, "ease-out");
                    }}
                    onMouseLeave={() => {
                      if (tease === cat) flipThen(() => setTease(null), TEASE_MS, "ease-out");
                    }}
                    className="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand/60"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Caption — mirrors the rest widths so it sits under the featured card ── */}
        <div className={`${enter} flex gap-2.5 md:gap-4 mt-5 md:mt-7`}>
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
            <div className="min-w-0" aria-live="polite">
              <AnimatePresence initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.28, ease: "easeOut" }}
                >
                  <h3 className="text-[clamp(19px,2.2vw,24px)] font-bold text-brand-ink leading-snug">
                    {featured.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] md:text-[16px] text-ink-cool leading-[1.6] max-w-[560px]">
                    {featured.body}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={() => goToApp("/sign-up", navigate)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand/25 bg-white px-5 py-2.5 text-[14px] font-semibold text-brand transition-colors hover:bg-brand hover:border-brand hover:text-white motion-reduce:transition-none"
            >
              Get started
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {STRIP_W.map((w) => (
            <div key={w} aria-hidden className="hidden md:block shrink-0" style={{ width: w }} />
          ))}
        </div>
      </div>
    </section>
  );
}
