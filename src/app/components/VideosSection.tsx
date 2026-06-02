import { useState } from "react";
import { Play, Calendar } from "lucide-react";
import { VideoModal } from "./VideoModal";
import { videoMeta, sectionLabel, dateVenueSep } from "../copy/videoMeta";
import tempVideo from "../../imports/__.mp4";
import videoYsh from "../../imports/_______1_-2.mp4";
import videoXshlds from "../../imports/_________1_-1.mp4";

const videoSources: Record<number, string> = {
  1: tempVideo,
  2: videoYsh,
  3: videoXshlds,
};

const videos = videoMeta.map((v) => ({
  ...v,
  videoUrl: videoSources[v.id],
}));

export function VideosSection() {
  const [selected, setSelected] = useState<(typeof videos)[number] | null>(null);

  return (
    <section id="videos" className="py-24 px-6" style={{ background: "#07070C" }}>
      <div className="max-w-7xl mx-auto">
        <SectionHeader label={sectionLabel} title="LIVE ARCHIVE" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} onClick={() => setSelected(video)} />
          ))}
        </div>
      </div>

      {selected && (
        <VideoModal video={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

function VideoCard({
  video,
  onClick,
}: {
  video: (typeof videos)[number];
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="text-left group w-full"
      style={{ background: "#0E0E1C", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="relative overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
        <video
          src={`${video.videoUrl}#t=0.001`}
          className="w-full h-full object-cover transition-transform duration-500"
          style={{ transform: hovered ? "scale(1.06)" : "scale(1)" }}
          muted
          playsInline
          preload="metadata"
        />
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: "rgba(7,7,12,0.5)",
            opacity: hovered ? 0.3 : 0.55,
          }}
        />
        {video.newest && (
          <div
            className="absolute top-3 left-3 px-2 py-0.5 text-xs uppercase tracking-[0.2em] z-10"
            style={{
              background: "#FF9FD4",
              color: "#07070C",
              fontFamily: "'Anton', sans-serif",
              letterSpacing: "0.15em",
            }}
          >
            Newest
          </div>
        )}
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{ opacity: hovered ? 1 : 0.6 }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-300"
            style={{
              background: "#FF9FD4",
              transform: hovered ? "scale(1.1)" : "scale(1)",
            }}
          >
            <Play size={18} fill="#07070C" style={{ color: "#07070C", marginLeft: 2 }} />
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3
          className="text-foreground mb-2 transition-colors duration-200"
          style={{
            fontFamily: "'Anton', sans-serif",
            letterSpacing: "0.04em",
            fontSize: "1.1rem",
            color: hovered ? "#FF9FD4" : undefined,
          }}
        >
          {video.title}
        </h3>
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <Calendar size={11} />
          <span>{video.date}</span>
          <span className="mx-1 opacity-40">{dateVenueSep}</span>
          <span>{video.venue}</span>
        </div>
      </div>
    </button>
  );
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <div
        className="text-xs uppercase tracking-[0.3em] px-3 py-1"
        style={{ color: "#FF9FD4", border: "1px solid rgba(255,159,212,0.3)", background: "rgba(255,159,212,0.05)" }}
      >
        {label}
      </div>
      <h2
        className="text-foreground leading-none"
        style={{
          fontFamily: "'Anton', sans-serif",
          fontSize: "clamp(2.5rem, 6vw, 5rem)",
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </h2>
      <div className="w-16 h-px" style={{ background: "#FF9FD4" }} />
    </div>
  );
}

export { SectionHeader };
