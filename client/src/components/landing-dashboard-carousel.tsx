import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

type DashboardSlide = {
  label: string;
  src?: string;
  alt: string;
};

const slides: DashboardSlide[] = [
  { label: "Your financial snapshot", src: undefined, alt: "Net worth, assets, liabilities, and interest spread dashboard preview" },
  { label: "A clearer view of your finances", src: undefined, alt: "Net worth, assets, liabilities, and interest spread dashboard preview" },
  { label: "Your progress, all in one place", src: undefined, alt: "Net worth, assets, liabilities, and interest spread dashboard preview" },
];

function DashboardPreview() {
  return (
    <div className="rounded-lg border bg-card p-4 text-left shadow-lg">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-yellow-400" />
        <div className="h-3 w-3 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs text-muted-foreground">Net Worth</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Net Worth", value: "$421,300", color: "text-emerald-500" },
          { label: "Total Assets", value: "$732,300", color: "text-[#1C91D4]" },
          { label: "Total Liabilities", value: "$311,000", color: "text-red-500" },
          { label: "Interest Spread", value: "+3.21%", color: "text-violet-500" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md bg-muted/80 p-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 flex h-24 items-end gap-1 rounded-md bg-muted/80 p-3">
          {[40, 55, 45, 70, 65, 80, 72, 85, 90, 88, 95, 100].map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-sm bg-primary/60"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="flex h-24 items-center justify-center rounded-md bg-muted/80 p-3">
          <div className="relative h-14 w-14">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
              <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(var(--chart-1))" strokeWidth="4" strokeDasharray="50 82" />
              <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(var(--chart-2))" strokeWidth="4" strokeDasharray="20 82" strokeDashoffset="-50" />
              <circle cx="18" cy="18" r="13" fill="none" stroke="hsl(var(--chart-3))" strokeWidth="4" strokeDasharray="12 82" strokeDashoffset="-70" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingDashboardCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [viewportRef, carousel] = useEmblaCarousel({ loop: true, duration: 40 });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!carousel) return;
    const updateActiveSlide = () => setActiveIndex(carousel.selectedScrollSnap());
    updateActiveSlide();
    carousel.on("select", updateActiveSlide);
    carousel.on("reInit", updateActiveSlide);
    return () => {
      carousel.off("select", updateActiveSlide);
      carousel.off("reInit", updateActiveSlide);
    };
  }, [carousel]);

  useEffect(() => {
    if (!carousel || isHovered || isFocused || reducedMotion) return;
    const timer = window.setInterval(() => {
      carousel.scrollNext();
    }, 6000);
    return () => window.clearInterval(timer);
  }, [carousel, activeIndex, isHovered, isFocused, reducedMotion]);

  const showPrevious = () => carousel?.scrollPrev(reducedMotion);
  const showNext = () => carousel?.scrollNext(reducedMotion);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    } else if (event.key === "Home") {
      event.preventDefault();
      carousel?.scrollTo(0, reducedMotion);
    } else if (event.key === "End") {
      event.preventDefault();
      carousel?.scrollTo(slides.length - 1, reducedMotion);
    }
  };

  const currentSlide = slides[activeIndex];

  return (
    <section
      className="mt-14 relative mx-auto max-w-4xl"
      role="region"
      aria-roledescription="carousel"
      aria-label="FinVision360 dashboard preview"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false);
      }}
      onKeyDown={handleKeyDown}
    >
      <div ref={viewportRef} className="overflow-hidden rounded-lg shadow-lg">
        <div className="flex touch-pan-y">
          {slides.map((slide, index) => (
            <div
              key={slide.label}
              className="min-w-0 flex-[0_0_100%]"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}: ${slide.label}`}
              aria-hidden={index !== activeIndex}
            >
              {slide.src ? (
                <img
                  className="block h-auto w-full rounded-lg border bg-card"
                  src={slide.src}
                  alt={slide.alt}
                />
              ) : (
                <DashboardPreview />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center">
        <div className="flex items-center gap-1.5" aria-label="Choose a dashboard preview slide">
          {slides.map((slide, index) => (
            <button
              key={slide.label}
              type="button"
              className={`group flex h-8 w-8 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                index === activeIndex ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={`Show slide ${index + 1}: ${slide.label}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => carousel?.scrollTo(index, reducedMotion)}
            >
              <span
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === activeIndex ? "w-6 bg-primary" : "w-2 bg-primary/25 group-hover:bg-primary/50"
                }`}
              />
            </button>
          ))}
        </div>

      </div>
      <p className="sr-only" aria-live={isHovered || isFocused || reducedMotion ? "polite" : "off"} aria-atomic="true">
        Slide {activeIndex + 1} of {slides.length}: {currentSlide.label}
      </p>
    </section>
  );
}
