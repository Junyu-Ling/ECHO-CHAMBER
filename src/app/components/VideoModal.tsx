import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Video {
  id: number;
  title: string;
  date: string;
  venue: string;
  newest: boolean;
  videoUrl: string;
  poster: string;
}

interface VideoModalProps {
  video: Video;
  onClose: () => void;
}

export function VideoModal({ video, onClose }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadVideo, setLoadVideo] = useState(false);

  useEffect(() => {
    setLoadVideo(true);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    if (!loadVideo || !videoRef.current) return;
    videoRef.current.play().catch((err) => {
      console.warn("Autoplay was prevented:", err);
    });
  }, [loadVideo]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10"
      style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 text-muted-foreground hover:text-foreground transition-colors p-2"
          aria-label="关闭"
        >
          <X size={28} />
        </button>

        <div
          className="w-full aspect-video flex items-center justify-center relative overflow-hidden shadow-2xl"
          style={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <img
            src={video.poster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: loadVideo ? 0 : 1, transition: "opacity 0.3s" }}
          />
          {loadVideo && (
            <video
              ref={videoRef}
              src={video.videoUrl}
              poster={video.poster}
              controls
              playsInline
              className="w-full h-full object-cover"
              preload="auto"
            >
              您的浏览器不支持 video 标签。
            </video>
          )}
        </div>

        <div className="mt-6 px-2">
          <h4
            className="text-foreground text-xl"
            style={{ fontFamily: "'Anton', sans-serif", letterSpacing: "0.04em" }}
          >
            {video.title}
          </h4>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-muted-foreground text-sm">{video.venue}</span>
            <span className="text-muted-foreground/30 text-sm">|</span>
            <span className="text-muted-foreground text-sm">{video.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
