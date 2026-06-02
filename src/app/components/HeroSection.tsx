import { ChevronDown, Disc3 } from "lucide-react";
import heroImage from "../../imports/fc9ade432714e08066f2002932e6f98b-3.png";
import { ImageWithFallback } from "./ImageWithFallback";

export function HeroSection() {
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
        <ImageWithFallback
          src={heroImage}
          alt="乐队合照"
          className="w-full h-full object-cover object-center"
          loading="eager"
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
            SCLSDD乐队
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
        aria-label="向下滚动"
      >
        <span className="text-muted-foreground text-xs uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">
          scroll
        </span>
        <ChevronDown size={16} className="text-muted-foreground animate-bounce" />
      </button>
    </section>
  );
}
