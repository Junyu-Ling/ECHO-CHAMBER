import { useState, useEffect, useRef } from "react";
import { Search, Music, Loader2, X } from "lucide-react";
import {
  SEARCH_PLACEHOLDER,
  PREVIEW_LABEL,
  APPLE_MUSIC_CREDIT,
  NO_SONG_RESULTS,
} from "../copy/zhUI";

export interface TrackResult {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  artworkUrl60: string;
  previewUrl?: string;
  collectionName: string;
}

interface MusicSearchInputProps {
  onSelect: (track: TrackResult) => void;
  value: string;
  onChange: (v: string) => void;
  selectedTrackId?: number | null;
}

export function MusicSearchInput({ onSelect, value, onChange, selectedTrackId }: MusicSearchInputProps) {
  const [results, setResults] = useState<TrackResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (selectedTrackId != null) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    if (!value.trim() || value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(value)}&media=music&entity=song&limit=8&country=CN`
        );
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
        setActiveIdx(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [value, selectedTrackId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // 始终阻止冒泡到 form，避免误触表单提交
      e.preventDefault();
      if (open && results.length > 0) {
        // 有高亮则选高亮项，否则选第一条
        handleSelect(results[activeIdx >= 0 ? activeIdx : 0]);
      }
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const handleSelect = (track: TrackResult) => {
    onSelect(track);
    setOpen(false);
    setResults([]);
  };

  const clearInput = () => {
    onChange("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-3 px-4 py-2.5 transition-all duration-200"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${open || value ? "rgba(255,159,212,0.55)" : "rgba(255,255,255,0.14)"}`,
        }}
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin flex-shrink-0" style={{ color: "#FF9FD4" }} />
        ) : (
          <Search size={15} className="flex-shrink-0" style={{ color: value ? "#FF9FD4" : "#6B6B8A" }} />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={SEARCH_PLACEHOLDER}
          className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none"
        />
        {value && (
          <button type="button" onClick={clearInput} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute left-0 right-0 top-full z-50 overflow-y-auto"
          style={{
            background: "#13122a",
            border: "1px solid rgba(255,159,212,0.3)",
            borderTop: "none",
            maxHeight: 300,
            scrollbarWidth: "thin",
          }}
        >
          {results.map((track, idx) => (
            <button
              key={track.trackId}
              onClick={() => handleSelect(track)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100"
              style={{
                background: activeIdx === idx ? "rgba(255,159,212,0.08)" : "transparent",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <div className="flex-shrink-0 w-9 h-9 bg-muted overflow-hidden" style={{ borderRadius: 2 }}>
                {track.artworkUrl60 ? (
                  <img src={track.artworkUrl60} alt={track.trackName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music size={14} style={{ color: "#6B6B8A" }} />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{track.trackName}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{track.artistName}</p>
              </div>
              {track.previewUrl && (
                <span
                  className="flex-shrink-0 text-xs px-1.5 py-0.5 uppercase tracking-wider"
                  style={{ background: "rgba(255,159,212,0.1)", color: "#FF9FD4", fontSize: "0.6rem" }}
                >
                  {PREVIEW_LABEL}
                </span>
              )}
            </button>
          ))}
          <div className="px-4 py-2 flex items-center gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-xs text-muted-foreground opacity-40">{APPLE_MUSIC_CREDIT}</span>
          </div>
        </div>
      )}

      {open && results.length === 0 && !loading && value.length >= 2 && (
        <div
          className="absolute left-0 right-0 top-full z-50 px-4 py-4 text-sm text-center"
          style={{ background: "#13122a", border: "1px solid rgba(255,159,212,0.3)", borderTop: "none", color: "#8080b0" }}
        >
          {NO_SONG_RESULTS}
        </div>
      )}
    </div>
  );
}
