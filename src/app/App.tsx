import { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { HeroSection } from "./components/HeroSection";
import { VideosSection } from "./components/VideosSection";
import { MembersSection } from "./components/MembersSection";
import { SongRequestSection } from "./components/SongRequestSection";
import { Footer } from "./components/Footer";
import { Users } from "lucide-react";
import { supabase } from "./supabaseClient";

export default function App() {
  const [onlineCount, setOnlineCount] = useState(1);

  useEffect(() => {
    // 使用 Supabase Realtime Presence 追踪真实在线人数
    const channel = supabase.channel('online-presence', {
      config: {
        presence: {
          key: Math.random().toString(36).substring(2, 15),
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // 计算当前所有连接的在线终端数量
        const count = Object.keys(state).length;
        setOnlineCount(count > 0 ? count : 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // 开始追踪当前设备
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
        <VideosSection />
        <MembersSection />
        <SongRequestSection />
      </main>
      <Footer />

      {/* 在线人数显示 */}
      <div
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all duration-500 group hover:scale-105"
        style={{
          background: "rgba(14, 14, 28, 0.8)",
          borderColor: "rgba(255, 159, 212, 0.2)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
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
