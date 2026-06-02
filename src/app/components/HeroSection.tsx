import { useState } from "react";
import { ChevronDown, Disc3 } from "lucide-react";
import { heroImage, heroPlaceholder } from "../lib/preloadHero";
import { heroAlt, heroBandLabel, heroScrollAria, heroScrollLabel } from "../copy/heroCopy";
import { ImageWithFallback } from "./ImageWithFallback";

export function HeroSection() {
  const [hqReady, setHqReady] = useState(false);

  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="home"
      className="relative w-full overflow-hidden"
      style={{ minHeight: "100vh", background: "#07070C" }}
    >
      <div className="absolute inset-0 z-0">
        <img
          src={heroPlaceholder}
          alt=""
          aria-hidden
          className="w-full h-full object-cover object-center scale-105 blur-md"
          decoding="async"
        />
        <ImageWithFallback
          src={heroImage}
          alt={heroAlt}
          className="absolute inset-0 w-full h-full object-cover object-center"
          loading="eager"
          fetchPriority="high"
          showSkeleton={false}
          onLoad={() => setHqReady(true)}
          style={{ opacity: hqReady ? 1 : 0, transition: "opacity 0.4s ease-out" }}
        />
      </div>

      <div className="absolute bottom-20 right-6 z-10 text-right px-2 max-w-[min(100%,36rem)]">
        <div className="flex items-center justify-end gap-2 mb-4">
          <div className="h-px w-8" style={{ background: "rgba(255,159,212,0.5)" }} />
          <div
            className="inline-flex items-center gap-2 px-4 py-1 text-xs uppercase tracking-[0.3em]"
            style={{
              border: "1px solid rgba(255,159,212,0.3)",
              color: "#FF9FD4",
              background: "rgba(255,159,212,0.05)",
            }}
          >
            <Disc3 size={11} />
            {heroBandLabel}
          </div>
        </div>

        <h1
          className="leading-none text-foreground uppercase"
          style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: "clamp(2.75rem, 9vw, 7rem)",
            letterSpacing: "0.04em",
            textShadow: "0 4px 30px rgba(0,0,0,0.7)",
          }}
        >
          ECHO <span style={{ color: "#FF9FD4" }}>CHAMBER</span>
        </h1>
      </div>

      <button
        onClick={() => scrollTo("#videos")}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 group"
        aria-label={heroScrollAria}
      >
        <span className="text-muted-foreground text-xs uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">
          {heroScrollLabel}
        </span>
        <ChevronDown size={16} className="text-muted-foreground animate-bounce" />
      </button>
    </section>
  );
}
