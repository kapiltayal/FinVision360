import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

type DashboardSlide = {
  label: string;
  src: string;
  alt: string;
};

const slides: DashboardSlide[] = [
  {
    label: "Financial Snapshot",
    src: "/Images/landing-snapshot.jpg",
    alt: "Financial Snapshot page showing net worth, monthly cash flow, emergency savings, and retirement progress with illustrative demo data",
  },
  {
    label: "Liability Map",
    src: "/Images/landing-liability-map.jpg",
    alt: "Liability Map page comparing mortgage, auto loan, and student loan payoff timelines with illustrative demo data",
  },
  {
    label: "Budget Planning",
    src: "/Images/landing-budget-planning.jpg",
    alt: "Budgeting Plan page showing monthly income, outflows, cash flow, and plan sections with illustrative demo data",
  },
];

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
      aria-label="FinVision360 product screenshots"
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
              <img
                className="block h-auto w-full rounded-lg border bg-card"
                src={slide.src}
                alt={slide.alt}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">Sample workspace · all values shown are illustrative</p>
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
