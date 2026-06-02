import { getVideoUrl } from "../copy/videoUrls";

/** Resolve play URL: local in dev, GitHub CDN in production (public repo). */
export async function resolveVideoPlayUrl(id: number): Promise<string> {
  const url = getVideoUrl(id);
  if (url.startsWith("http")) return url;

  const res = await fetch(`/api/video?id=${id}&format=json`, {
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(data.error || `Failed to resolve video ${id}`);
  }
  return data.url;
}
