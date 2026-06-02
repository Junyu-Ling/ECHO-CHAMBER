import { X, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
    setPlaying(false);
    setLoading(true);
    setError(false);
  }, [video.id, video.videoUrl]);

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10"
      style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
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
            style={{ opacity: playing ? 0 : 1, transition: "opacity 0.3s" }}
          />

          {loading && !error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="animate-spin text-[#FF9FD4]" size={36} />
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 px-6 text-center">
              <p className="text-muted-foreground text-sm">视频加载失败</p>
              <button
                type="button"
                className="text-xs px-3 py-1 rounded"
                style={{ background: "#FF9FD4", color: "#07070C" }}
                onClick={() => {
                  setError(false);
                  setLoading(true);
                  if (videoRef.current) {
                    videoRef.current.load();
                  }
                }}
              >
                重试
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              key={video.videoUrl}
              src={video.videoUrl}
              poster={video.poster}
              controls
              playsInline
              className="relative z-[1] w-full h-full object-cover"
              preload="auto"
              onLoadedData={() => setLoading(false)}
              onCanPlay={() => {
                setLoading(false);
                setPlaying(true);
              }}
              onPlaying={() => setPlaying(true)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
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

  return createPortal(modal, document.body);
}
