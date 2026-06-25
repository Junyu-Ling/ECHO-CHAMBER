import { getVideoUrl } from "../copy/videoUrls";

const warmed = new Set<number>();
const pool = new Map<number, HTMLVideoElement>();

const RANGE_BYTES = 2 * 1024 * 1024; // first 2MB — covers faststart + initial frames

/** Warm browser cache: range fetch + hidden video element. */
export function warmVideo(id: number, priority: "high" | "low" = "low"): void {
  if (warmed.has(id)) return;
  warmed.add(id);

  const url = getVideoUrl(id);

  fetch(url, {
    headers: { Range: `bytes=0-${RANGE_BYTES - 1}` },
    priority: priority === "high" ? "high" : "auto",
  }).catch(() => {});

  const el = document.createElement("video");
  el.preload = "auto";
  el.muted = true;
  el.playsInline = true;
  el.src = url;
  el.load();
  pool.set(id, el);
}

export function warmAllVideos(priority: "high" | "low" = "low"): void {
  for (const id of [1, 2, 3]) warmVideo(id, priority);
}

export function prefetchVideo(id: number): void {
  warmVideo(id, "high");
}

export async function resolveVideoPlayUrl(id: number): Promise<string> {
  warmVideo(id, "high");
  return getVideoUrl(id);
}
