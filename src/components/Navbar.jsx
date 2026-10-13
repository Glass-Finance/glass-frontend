import { useEffect, useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { goToApp } from "../utils/deviceRedirect";
import { motion, useScroll, useSpring } from "motion/react";
import { LandingCta } from "./ui/LandingCta";

const scrollTo = (id) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  const viewMode = location.pathname === "/members" ? "members" : "organizations";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleViewModeChange = (mode) => {
    if (mode === "organizations") navigate("/");
    else if (mode === "members") navigate("/members");
  };

  return (
    <>
      <motion.div
        className="[transform-origin:0%_50%] bg-[linear-gradient(90deg,var(--color-brand)_0%,var(--color-brand-purple)_100%)] h-[3px] fixed top-0 left-0 right-0 z-[200] pointer-events-none"
        style={{ scaleX }}
      />
      <nav
        className={`fixed top-0 left-0 right-0 z-50 min-h-[80px] transition-all duration-300 ${
          scrolled
            ? "bg-brand-night-deep/95 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_30px_rgba(0,0,0,0.4)]"
            : "bg-transparent"
        }`}
      >
        {/* ── Toggle pill mobile ── */}
        <div className="lg:hidden bg-white/10 border border-white/[0.1] flex mt-[6px] mx-3 rounded-full">
          <button
            onClick={() => {
              handleViewModeChange("organizations");
              setMenuOpen(false);
            }}
            className={`flex-1 px-4 py-2 rounded-md text-[13px] font-medium cursor-pointer transition-all ${
              viewMode === "organizations"
                ? "bg-white/20 text-white hover:text-white/70"
                : "text-white/55"
            }`}
          >
            Organizations
          </button>
          <button
            onClick={() => {
              handleViewModeChange("members");
              setMenuOpen(false);
            }}
            className={`flex-1 px-4 py-3 rounded-md text-[13px] font-medium cursor-pointer transition-all ${
              viewMode === "members"
                ? "bg-white/20 text-white hover:text-white/70"
                : "text-white/55"
            }`}
          >
            Members
          </button>
        </div>

        <div className="max-w-[1280px] mx-auto px-6 lg:px-12 h-full flex items-center justify-between gap-6 py-4">
          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2.5 no-underline shrink-0">
            {/* Inline vector logomark -- was a 46x41 raster export displayed at
              32x32, soft on any high-DPI screen. Vector is sharp at any size. */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 37 35"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M25.5223 34.5399C25.3425 34.7248 25.0955 34.8293 24.8372 34.8293C22.0105 34.8293 5.17573 34.8293 0.955684 34.8293C0.701557 34.8293 0.458453 34.7284 0.279069 34.5483C0.099685 34.3686 -0.000691699 34.1244 3.58813e-06 33.8705C0.0139093 29.8531 0.0666887 14.4661 0.0750322 11.9412C0.0760751 11.7159 0.165026 11.4999 0.323204 11.3394C1.82642 9.8162 9.73395 1.80367 11.2584 0.259263C11.4211 0.0941638 11.643 0.0018325 11.8745 0.00287743C13.6621 0.0105402 21.521 0.0443052 23.0718 0.0509231C23.2192 0.0516197 23.3383 0.171461 23.3383 0.318448C23.3383 2.00287 23.3383 11.1052 23.3383 11.1052L11.1382 11.3463V23.914L25.0079 24.1578C25.0079 24.1578 25.1565 20.5838 25.1933 19.6995C25.1978 19.5898 25.2878 19.503 25.3977 19.503C26.6412 19.503 33.411 19.503 34.7776 19.503C34.9104 19.503 35.0183 19.6106 35.0183 19.7437C35.0183 20.589 35.0183 23.4264 35.0183 24.4226C35.0183 24.6469 34.931 24.8621 34.7746 25.0227C33.4333 26.4027 26.9563 33.0648 25.5223 34.5399Z"
                fill="#94B1FB"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M27.163 34.5489C26.9839 34.7283 26.7408 34.8293 26.487 34.8293C23.6941 34.8293 6.96395 34.8293 2.76476 34.8293C2.23704 34.8293 1.80908 34.4016 1.80908 33.8735C1.80908 29.8878 1.80908 14.6778 1.80908 12.1529C1.80908 11.9251 1.89934 11.7064 2.06065 11.5447C3.60419 9.99825 11.7807 1.80603 13.3312 0.252567C13.4936 0.0899068 13.7146 -0.00103602 13.9447 8.90607e-06C15.7107 0.00802003 23.4471 0.0438946 24.9854 0.0508608C25.1328 0.0515574 25.2516 0.171391 25.2516 0.318726C25.2499 1.8802 25.2425 9.82098 25.2414 11.1557C25.2411 11.2609 25.1556 11.3463 25.0503 11.3463C23.6465 11.3463 14.9132 11.3463 13.1367 11.3463C13.0533 11.3463 12.9731 11.3797 12.914 11.4385C12.8549 11.4977 12.8216 11.5779 12.8216 11.6615C12.8216 13.4051 12.8216 21.8551 12.8216 23.5991C12.8216 23.6827 12.8549 23.7628 12.914 23.8216C12.9731 23.8808 13.0533 23.914 13.1367 23.914H24.7026C24.8768 23.914 25.0177 23.7729 25.0177 23.5991C25.0177 22.7708 25.0177 20.5434 25.0177 19.7712C25.0177 19.6231 25.1382 19.503 25.2859 19.503C26.8861 19.503 35.1591 19.503 36.6804 19.503C36.7444 19.503 36.8056 19.5284 36.8505 19.5733C36.8957 19.6186 36.9211 19.6799 36.9211 19.7436C36.9211 20.5872 36.9211 23.4138 36.9211 24.4162C36.9211 24.644 36.8308 24.8628 36.6695 25.0244C35.2866 26.41 28.6165 33.0926 27.163 34.5489Z"
                fill="url(#glassLogoGradientA)"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M23.1507 12.1087C23.1507 12.1087 15.434 12.0878 13.8452 12.0832C13.7697 12.0832 13.6974 12.1128 13.6442 12.1661C13.591 12.2191 13.5608 12.2915 13.5608 12.3667C13.5608 13.9174 13.5608 21.3458 13.5608 22.8948C13.5608 22.97 13.5906 23.0417 13.6438 23.095C13.697 23.1483 13.7693 23.1779 13.8443 23.1779C15.1594 23.1779 20.6617 23.1779 21.9869 23.1779C22.0631 23.1779 22.1359 23.1476 22.1891 23.0932C22.2422 23.0393 22.2717 22.9658 22.2704 22.8898C22.2542 21.9097 22.2023 18.7624 22.2023 18.7624H36.6804C36.744 18.7624 36.8053 18.7369 36.8502 18.692C36.8955 18.6467 36.9209 18.5858 36.9209 18.5217C36.9209 16.6398 36.9209 4.26014 36.9209 0.863419C36.9209 0.387977 36.5357 0.00242425 36.0601 0.00242425C33.769 0.00207594 27.6033 0.00140381 26.2442 0.00140381C26.1736 0.00140381 26.1057 0.0295659 26.0556 0.0797225C26.005 0.129879 25.9773 0.197874 25.9773 0.268929V12.0825L23.1507 12.1087Z"
                fill="#94B1FB"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M24.6142 12.0825C24.6142 12.0825 16.4975 12.0849 14.8672 12.0853C14.7108 12.0853 14.5842 12.212 14.5842 12.3684C14.5842 13.917 14.5837 21.3458 14.5837 22.8948C14.5837 22.9697 14.6136 23.0417 14.6667 23.095C14.7195 23.1483 14.7918 23.1779 14.8668 23.1779C16.2831 23.1779 22.5824 23.1779 23.9987 23.1779C24.0737 23.1779 24.1456 23.1483 24.1988 23.095C24.2519 23.0417 24.2822 22.97 24.2822 22.8948C24.2822 22.0874 24.2822 19.784 24.2822 19.0212C24.2818 18.884 24.3931 18.7728 24.5304 18.7725C26.1419 18.7711 35.0941 18.7627 36.6808 18.7613C36.8133 18.7613 36.9213 18.6534 36.9213 18.5207C36.9213 16.6394 36.9213 4.25947 36.9213 0.862059C36.9213 0.633916 36.8306 0.414805 36.6693 0.253537C36.5076 0.0919215 36.2886 0.00140381 36.0601 0.00140381C33.9752 0.00175212 28.7347 0.00242425 27.4915 0.00242425C27.3437 0.00242425 27.2246 0.122266 27.2246 0.269949C27.2246 2.04737 27.2246 12.0825 27.2246 12.0825H24.6142Z"
                fill="url(#glassLogoGradientB)"
              />
              <defs>
                <linearGradient
                  id="glassLogoGradientA"
                  x1="1.80908"
                  y1="33.6197"
                  x2="36.9213"
                  y2="1.09211"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#072EAB" />
                  <stop offset="1" stopColor="#6B2FB5" />
                </linearGradient>
                <linearGradient
                  id="glassLogoGradientB"
                  x1="14.5838"
                  y1="22.8194"
                  x2="36.9214"
                  y2="0.00147021"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#072EAB" />
                  <stop offset="1" stopColor="#6B2FB5" />
                </linearGradient>
              </defs>
            </svg>
            <span className="font-bold text-[17px] text-white tracking-tight">Glass</span>
          </Link>

          {/* ── Toggle Pill (desktop) ── */}
          <div className="hidden lg:flex bg-white/10 border border-white/[0.1] rounded-full p-[2px] items-center backdrop-blur-sm cursor-pointer">
            <button
              onClick={() => handleViewModeChange("organizations")}
              className={`px-[13px] py-[9px] rounded-full text-[13.5px] font-medium transition-all duration-200 ${
                viewMode === "organizations"
                  ? "bg-white/20 text-white shadow-sm hover:text-white/70"
                  : "text-white/45 hover:text-white/50"
              }`}
            >
              Organizations
            </button>
            <button
              onClick={() => handleViewModeChange("members")}
              className={`px-[13px] py-[9px] rounded-full text-[13.5px] font-medium transition-all duration-200 ${
                viewMode === "members"
                  ? "bg-white/20 text-white shadow-sm hover:text-white/70"
                  : "text-white/45 hover:text-white/50"
              }`}
            >
              Members
            </button>
          </div>

          {/* ── Nav Links (desktop) ── */}
          <div className="hidden lg:flex items-center gap-7">
            <button
              onClick={() => scrollTo("use-cases")}
              className="text-[13.5px] text-white hover:text-white/55 transition-colors font-medium cursor-pointer"
            >
              Use Cases
            </button>
            <button
              onClick={() => scrollTo("how-it-works")}
              className="text-[13.5px] text-white hover:text-white/55 transition-colors font-medium cursor-pointer"
            >
              How It Works
            </button>
          </div>

          {/* ── CTA (desktop) ── */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            {viewMode === "organizations" ? (
              <>
                <LandingCta
                  onClick={() => goToApp("/sign-up", navigate)}
                  compact
                  className="shadow-lg shadow-black/20"
                >
                  Get Started Free
                  <ChevronRight className="w-3.5 h-3.5" />
                </LandingCta>
                <button
                  onClick={() => goToApp("/sign-in", navigate)}
                  className="text-[13.5px] text-white hover:text-white/70 transition-colors font-medium"
                >
                  Sign In
                </button>
              </>
            ) : (
              <LandingCta
                onClick={() => goToApp("/sign-in", navigate)}
                compact
                className="shadow-lg shadow-black/20"
              >
                Sign In
              </LandingCta>
            )}
          </div>

          {/* ── Mobile Hamburger ── */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            {menuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
          </button>
        </div>

        {/* ── Mobile Dropdown ── */}
        {menuOpen && (
          <div className="lg:hidden bg-brand-night/98 backdrop-blur-xl border-b border-white/[0.08]">
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1 pt-1">
                {[
                  { label: "Use Cases", id: "use-cases" },
                  { label: "How It Works", id: "how-it-works" },
                ].map(({ label, id }) => (
                  <button
                    key={label}
                    onClick={() => {
                      scrollTo(id);
                      setMenuOpen(false);
                    }}
                    className="flex items-center justify-between w-full py-3 text-[14px] font-medium text-white/60 hover:text-white transition-colors border-b border-white/[0.05]"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {viewMode === "organizations" ? (
                <div className="flex flex-col gap-3">
                  <LandingCta
                    onClick={() => {
                      goToApp("/sign-up", navigate);
                      setMenuOpen(false);
                    }}
                    compact
                  >
                    Get Started Free <ChevronRight className="w-4 h-4" />
                  </LandingCta>
                  <button
                    onClick={() => {
                      goToApp("/sign-in", navigate);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 text-white/70 py-2 text-[14px] font-medium cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <LandingCta
                  onClick={() => {
                    goToApp("/sign-in", navigate);
                    setMenuOpen(false);
                  }}
                  compact
                >
                  Sign In
                </LandingCta>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
