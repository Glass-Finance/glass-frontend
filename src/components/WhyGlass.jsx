import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import BlurText from "./ui/BlurText";

const faqs = [
  {
    q: "How does Glass collect payments automatically?",
    a: "Members securely link their cards once, and dues are deducted based on the schedule you set — monthly, yearly, or custom.",
  },
  {
    q: "What happens if a payment fails?",
    a: "Glass automatically retries the payment and sends a gentle SMS/WhatsApp reminder to the member. Your treasurer is notified immediately so nothing slips through the cracks.",
  },
  {
    q: "Can members see all transactions?",
    a: "Yes. Every member has access to a transparent ledger showing all income and expenditure for the organisation. Admins can control visibility settings per category.",
  },
  {
    q: "Is Glass secure?",
    a: "Absolutely. Sensitive data is AES-256 encrypted and everything is protected by TLS in transit, with OTP/MFA, rate-limited access, audit trails, and 24/7 monitoring. Payments run through Paystack — we never hold your funds, and every transaction needs your authorisation. Your NDPR rights are set out in our Privacy Policy.",
  },
  {
    q: "Can we customize our dues structure?",
    a: "Yes. You can create multiple due types (monthly, annual, one-time levies), set different amounts per member tier, and configure custom payment schedules to match your organisation's rules.",
  },
];

export default function WhyGlass() {
  const [open, setOpen] = useState(0);

  /* Refs for scroll-triggered animations */
  const itemRefs = useRef([]);
  const btnRef = useRef(null);

  useEffect(() => {
    /* ── Accordion rows: slide up from below, staggered ── */
    const io2 = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.transform = "translateY(0)";
            io2.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.transform = "translateY(36px)";
      el.style.transition = `transform 0.65s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`;
      io2.observe(el);
    });

    /* ── CTA button: scale bounce in ── */
    const io3 = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          e.target.style.transform = "scale(1)";
          e.target.style.opacity = "1";
          io3.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    if (btnRef.current) {
      btnRef.current.style.transform = "scale(0.88)";
      btnRef.current.style.opacity = "0";
      btnRef.current.style.transition =
        "transform 0.6s cubic-bezier(0.34,1.56,0.64,1) 200ms, opacity 0.4s ease 200ms";
      io3.observe(btnRef.current);
    }

    return () => {
      io2.disconnect();
      io3.disconnect();
    };
  }, []);

  return (
    <section className="relative isolate py-20 md:py-28 overflow-hidden">
      <div className="relative z-10 mx-auto max-w-[1140px] px-6 lg:max-w-[1280px] lg:px-8">
        {/* ── Header ── */}
        <div className="text-center mb-14">
          {/* Badge */}
          <div className="mb-6">
            <span className="inline-flex items-center border border-brand-deep/25 text-brand-deep text-[13px] font-medium px-5 py-2 rounded-full">
              FAQ
            </span>
          </div>

          {/* Headline — BlurText word-by-word */}
          <h2 className="font-sans text-[clamp(32px,5vw,58px)] font-bold text-brand-ink leading-tight tracking-tight mb-4">
            <BlurText
              text="Frequently Asked Questions"
              animateBy="words"
              direction="top"
              delay={60}
              stepDuration={0.4}
              centered
            />
          </h2>

          <p className="text-[16px] text-ink-cool max-w-[640px] mx-auto leading-relaxed text-center">
            Everything you need to know about using Glass, from setting up dues to tracking payments
            and ensuring full transparency.
          </p>
        </div>

        {/* ── Accordion ── */}
        <div className="max-w-[1114px] mx-auto mb-14">
          {faqs.map((faq, i) => (
            <div
              key={faq.q}
              ref={(el) => (itemRefs.current[i] = el)}
              className="bg-surface-container border-surface-container-border rounded-xl mb-3 overflow-hidden border shadow-[0_2px_10px_rgba(15,29,110,0.06)] transition-all duration-300"
            >
              <button
                className="w-full flex items-center gap-4 px-6 py-5 text-left bg-transparent border-none cursor-pointer"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <div
                  className={`flex-shrink-0 w-1 rounded-full self-stretch transition-all duration-300 ${
                    open === i ? "bg-brand-deep" : "bg-transparent"
                  }`}
                />
                <span
                  className={`flex-1 font-bold text-[16px] leading-snug transition-colors duration-200 ${
                    open === i ? "text-brand-deep" : "text-brand-ink"
                  }`}
                >
                  {faq.q}
                </span>
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-[18px] leading-none transition-all duration-300 ${
                    open === i
                      ? "bg-brand-deep border-brand-deep text-white"
                      : "border-[#d1d5e0] text-ink-cool"
                  }`}
                >
                  {open === i ? "−" : "+"}
                </div>
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${open === i ? "max-h-[200px]" : "max-h-0"}`}
              >
                <p className="text-[15px] text-ink-cool leading-relaxed pl-11 pr-14 pb-6">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="flex justify-center">
          <a
            ref={btnRef}
            href="mailto:glasspayhq@gmail.com"
            className="inline-flex items-center gap-2.5 bg-brand text-white font-semibold text-[15px] px-7 py-3.5 rounded-full no-underline shadow-lg shadow-brand/25 transition-[background,transform,box-shadow] duration-200 ease-in-out hover:opacity-90 hover:-translate-y-[3px] hover:shadow-[0_10px_28px_rgba(0,47,167,0.35)]"
          >
            Ask A Question
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
