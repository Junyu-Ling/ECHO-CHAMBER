import { useState } from "react";
import { Calendar } from "lucide-react";
import { VideoModal } from "./VideoModal";
import { VideoThumbnail } from "./VideoThumbnail";
import { SectionHeader } from "./SectionHeader";
import { videoMeta, sectionLabel, dateVenueSep } from "../copy/videoMeta";
import { getVideoUrl } from "../copy/videoUrls";
import { prefetchVideo } from "../lib/resolveVideoUrl";
import { videoPosters } from "../copy/videoPosters";

const videos = videoMeta.map((v) => ({
  ...v,
  videoUrl: getVideoUrl(v.id),
  poster: videoPosters[v.id],
}));

export function VideosSection() {
  const [selected, setSelected] = useState<(typeof videos)[number] | null>(null);

  return (
    <section id="videos" className="py-24 px-6" style={{ background: "#07070C" }}>
      <div className="max-w-7xl mx-auto">
        <SectionHeader label={sectionLabel} title="LIVE ARCHIVE" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
          {videos.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              priority={index === 0}
              onClick={() => setSelected(video)}
            />
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
  priority,
  onClick,
}: {
  video: (typeof videos)[number];
  priority?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
        prefetchVideo(video.id);
      }}
      onMouseLeave={() => setHovered(false)}
      className="text-left group w-full cursor-pointer"
      style={{ background: "#0E0E1C", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <VideoThumbnail
        videoId={video.id}
        newest={video.newest}
        hovered={hovered}
        priority={priority}
      />

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
