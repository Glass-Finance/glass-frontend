import { useRef, useEffect } from "react";

// Trimmed to just the confirmed partner. GDG Babcock is intentionally
// left out for now -- the only GDG asset we ever had was a GDG *Lagos*
// logo (wrong chapter, name baked into the image). Add it back once a
// correct GDG Babcock logo file is dropped into public/logos/.
const trustedLogos = [{ name: "The Babcock Torch", logo: "/logos/babcock-torch.webp" }];

export default function TrustedBy() {
  const labelRef = useRef(null);
  const logoRefs = useRef([]);

  useEffect(() => {
    const io1 = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          e.target.style.opacity = "1";
          e.target.style.transform = "translateY(0)";
          io1.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    const io2 = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.opacity = "1";
            e.target.style.transform = "translateY(0)";
            io2.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 },
    );

    if (labelRef.current) {
      labelRef.current.style.opacity = "0";
      labelRef.current.style.transform = "translateY(12px)";
      labelRef.current.style.transition = "opacity 0.5s ease, transform 0.5s ease";
      io1.observe(labelRef.current);
    }

    logoRefs.current.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
      el.style.transition = `opacity 0.5s ease ${i * 80}ms, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 80}ms`;
      io2.observe(el);
    });

    return () => {
      io1.disconnect();
      io2.disconnect();
    };
  }, []);

  return (
    <section className="relative isolate pt-8 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <p
          ref={labelRef}
          className="text-center text-[13px] font-semibold text-ink-cool uppercase tracking-widest mb-10"
        >
          Trusted by forward-thinking communities
        </p>
        <div className="flex items-center justify-center gap-10 md:gap-16 flex-wrap">
          {trustedLogos.map((item, i) => (
            <div
              key={item.name}
              ref={(el) => (logoRefs.current[i] = el)}
              className="grayscale hover:grayscale-0 opacity-50 hover:opacity-90 transition-all duration-300"
            >
              <img
                src={item.logo}
                alt={item.name}
                className="h-10 md:h-14 w-auto object-contain"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.target.style.display = "none";
                  // Build the fallback with DOM APIs, not innerHTML — the
                  // text is static today, but createElement/textContent
                  // keeps any future interpolation inert by construction.
                  const span = document.createElement("span");
                  span.textContent = item.name;
                  span.style.cssText =
                    "color:#9099b2;font-weight:600;font-size:15px;white-space:nowrap";
                  e.target.parentElement.replaceChildren(span);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
