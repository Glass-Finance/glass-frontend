import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Crisp } from "crisp-sdk-web";
import { goToApp } from "../utils/deviceRedirect";
import glassLogo from "../assets/Glass.webp";
import BlurText from "./ui/BlurText";
import { LandingCta } from "./ui/LandingCta";

// Help Centre opens the support chat when Crisp is configured; the mailto
// href stays as the no-JS / chat-disabled fallback.
const openChat = (e) => {
  if (!import.meta.env.VITE_CRISP_WEBSITE_ID) return;
  e.preventDefault();
  Crisp.chat.open();
};

const links = {
  Product: [
    { label: "Features", href: "/#solution" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Pricing", href: "/#pricing" },
    { label: "Integrations", href: null },
  ],
  "Use Cases": [
    { label: "Schools", href: null },
    { label: "Religious Organizations", href: null },
    { label: "Clubs", href: null },
    { label: "Professional Bodies", href: null },
  ],
  Resources: [{ label: "Help Centre", href: "mailto:glasspayhq@gmail.com", chat: true }],
  Company: [
    { label: "About", href: null },
    { label: "Team", href: null },
    { label: "Careers", href: null },
    { label: "Contact", href: "mailto:glasspayhq@gmail.com" },
  ],
  Legal: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "Acceptable Use", href: "/acceptable-use" },
    { label: "Refund Policy", href: "/refund-policy" },
  ],
};

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="relative isolate overflow-hidden bg-brand-ink text-white">
      {/* Decorative Glass mark, centred on the whole footer. Not a Figma node
          (1:1374 draws no watermark) — owner-approved extension, see
          DESIGN-SYSTEM.md §9.8. Stops are the sanctioned brand blue and deep
          navy; the mask is what cuts the stepped line through the plate.
          Hidden below md: on a phone the mark outgrows the footer and its cut
          line collides with the nav columns, so the footer stays flat there. */}
      <svg
        aria-hidden="true"
        viewBox="26 18 204 182"
        className="hidden md:block pointer-events-none select-none absolute left-1/2 top-1/2 z-0 h-[104%] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.55]"
      >
        <defs>
          <linearGradient id="footerMarkGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#002fa7" />
            <stop offset="1" stopColor="#001f6e" />
          </linearGradient>
          <mask id="footerMarkMask">
            <rect x="0" y="0" width="260" height="220" fill="#fff" />
            <path
              d="M165 10 L165 80 L103 80 L103 140 L157 140 L157 120 L240 120"
              fill="none"
              stroke="#000"
              strokeWidth="6.5"
              strokeLinejoin="miter"
            />
          </mask>
        </defs>
        <path
          mask="url(#footerMarkMask)"
          fill="url(#footerMarkGrad)"
          d="M31 84 L90 22 L222 22 L222 140 L150 194 L31 194Z"
        />
      </svg>

      {/* ── CTA ── */}
      <div className="relative pt-20 md:pt-28 pb-20 overflow-hidden">
        <div className="relative z-10 max-w-[860px] mx-auto px-6 text-center">
          <h2 className="text-[clamp(30px,5vw,54px)] font-bold text-white leading-tight tracking-tight mb-5">
            <BlurText
              text="Stop chasing payments."
              delay={80}
              animateBy="words"
              direction="top"
              stepDuration={0.35}
              centered
              className="justify-center text-[clamp(30px,5vw,54px)] font-bold text-white leading-tight tracking-tight"
            />
            <br />
            <BlurText
              text="Start building your Community."
              delay={120}
              animateBy="words"
              direction="top"
              stepDuration={0.35}
              centered
              className="justify-center text-[clamp(30px,5vw,54px)] font-bold text-white leading-tight tracking-tight"
            />
          </h2>
          <p className="text-[16px] text-white/60 max-w-[720px] mx-auto leading-relaxed mb-10">
            Join communities already running transparent finances on Glass.
          </p>
          <LandingCta
            onClick={() => goToApp("/sign-up", navigate)}
            className="shadow-lg shadow-black/20"
          >
            Get Started Free
          </LandingCta>
        </div>
      </div>

      {/* ── Footer content ── */}
      {/* z-10 so the nav columns and copyright sit above the watermark. */}
      <div className="relative z-10 max-w-[1140px] mx-auto px-6 pt-14 pb-8">
        {/* Brand */}
        <div className="mb-6">
          <a href="/" className="inline-flex items-center gap-2 no-underline mb-3">
            {/* Local bundle, not Cloudinary: the remote logo kept rendering
                unreliably here, and this ships with the app — no CDN round
                trip for a 28px icon. */}
            <img
              src={glassLogo}
              alt="Glass"
              loading="lazy"
              decoding="async"
              className="w-7 h-7 object-contain"
            />
            <span className="font-bold text-[20px] text-white">Glass</span>
          </a>
          <a
            href="https://www.google.com/maps/search/?api=1&query=1%2C+Onyemargwu+Street%2C+Abule+Egba%2C+Lagos"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white no-underline transition-colors"
          >
            <MapPin size={14} className="text-white/40 flex-shrink-0" />
            1, Onyemargwu Street, Abule Egba, Lagos
          </a>
        </div>

        {/* Nav columns */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-30 mb-12">
          {Object.entries(links).map(([section, items]) => (
            <div key={section}>
              <p className="text-[13px] font-bold text-white mb-4">{section}</p>
              <ul className="space-y-2.5 list-none p-0 m-0">
                {items.map(({ label, href, chat }) => (
                  <li key={label}>
                    {href ? (
                      <a
                        href={href}
                        onClick={chat ? openChat : undefined}
                        className="text-[13px] text-white/60 hover:text-white no-underline transition-colors"
                      >
                        {label}
                      </a>
                    ) : (
                      <span className="text-[13px] text-white/35 cursor-default select-none">
                        {label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div className="border-t border-white/10 pt-7 text-center">
          <p className="text-[13px] text-white/50">
            Copyright © {new Date().getFullYear()} Glass Limited | Made for Nigerian communities
          </p>
        </div>
      </div>
    </footer>
  );
}
