import { getVideoUrl } from "../copy/videoUrls";

const prefetched = new Set<number>();

/** Warm cache: prefetch video on card hover. */
export function prefetchVideo(id: number): void {
  if (prefetched.has(id)) return;
  prefetched.add(id);
  const url = getVideoUrl(id);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "video";
  link.href = url;
  document.head.appendChild(link);
}

/** Same-origin web renditions — no API round-trip. */
export async function resolveVideoPlayUrl(id: number): Promise<string> {
  return getVideoUrl(id);
}
