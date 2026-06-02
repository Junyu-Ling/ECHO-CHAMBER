import { useState } from "react";
import { Play } from "lucide-react";
import { useInView } from "../hooks/useInView";
import { videoPosters } from "../copy/videoPosters";

type VideoThumbnailProps = {
  videoId: number;
  videoUrl: string;
  newest: boolean;
  hovered: boolean;
};

export function VideoThumbnail({ videoId, videoUrl, newest, hovered }: VideoThumbnailProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "280px 0px" });
  const [frameReady, setFrameReady] = useState(false);
  const poster = videoPosters[videoId];

  return (
    <div ref={ref} className="relative overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
      <img
        src={poster}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
        style={{
          transform: hovered ? "scale(1.06)" : "scale(1)",
          opacity: frameReady ? 0 : 1,
          transition: "opacity 0.3s ease, transform 0.5s ease",
        }}
        decoding="async"
        loading="lazy"
      />

      {inView && (
        <video
          src={`${videoUrl}#t=0.001`}
          poster={poster}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
          style={{
            transform: hovered ? "scale(1.06)" : "scale(1)",
            opacity: frameReady ? 1 : 0,
          }}
          muted
          playsInline
          preload="metadata"
          onLoadedData={() => setFrameReady(true)}
        />
      )}

      <div
        className="absolute inset-0 transition-opacity duration-300 pointer-events-none"
        style={{
          background: "rgba(7,7,12,0.5)",
          opacity: hovered ? 0.3 : 0.55,
        }}
      />
      {newest && (
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
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none"
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
  );
}
