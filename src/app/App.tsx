import { useState, useEffect, lazy, Suspense } from "react";
import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { MembersSection } from "./components/MembersSection";
import { Footer } from "./components/Footer";
import { Users } from "lucide-react";
import { supabase } from "./supabaseClient";

const VideosSection = lazy(() =>
  import("./components/VideosSection").then((m) => ({ default: m.VideosSection }))
);

const SongRequestSection = lazy(() =>
  import("./components/SongRequestSection").then((m) => ({ default: m.SongRequestSection }))
);

function SectionFallback() {
  return <div className="py-24 px-6" style={{ background: "#07070C", minHeight: "12rem" }} />;
}

export default function App() {
  const [onlineCount, setOnlineCount] = useState(1);
  const [loadBelowFold, setLoadBelowFold] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setLoadBelowFold(true);
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(enable, { timeout: 800 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const t = window.setTimeout(enable, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const channel = supabase.channel("online-presence", {
      config: {
        presence: {
          key: Math.random().toString(36).substring(2, 15),
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setOnlineCount(count > 0 ? count : 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground relative" style={{ overflowX: "hidden" }}>
      <Navbar />
      <main>
        <HeroSection />
        {loadBelowFold ? (
          <Suspense fallback={<SectionFallback />}>
            <VideosSection />
            <MembersSection />
            <SongRequestSection />
          </Suspense>
        ) : (
          <SectionFallback />
        )}
      </main>
      <Footer />

      <div
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all duration-500"
        style={{
          background: "rgba(14, 14, 28, 0.85)",
          borderColor: "rgba(255, 159, 212, 0.35)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">技术支持</span>
        <span
          className="text-[11px] font-bold"
          style={{ color: "#FF9FD4", fontFamily: "'Anton', sans-serif", letterSpacing: "0.04em" }}
        >
          灵俊宇
        </span>
      </div>

      <div
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all duration-500 group hover:scale-105"
        style={{
          background: "rgba(14, 14, 28, 0.8)",
          borderColor: "rgba(255, 159, 212, 0.2)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF9FD4] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF9FD4]"></span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={12} className="text-muted-foreground group-hover:text-[#FF9FD4] transition-colors" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            Online <span className="text-[#FF9FD4] ml-1 font-bold tabular-nums">{onlineCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
