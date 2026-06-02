import { getVideoUrl } from "../copy/videoUrls";

/** Production: fetch real LFS/CDN URL from /api/video. Dev: local file URL. */
export async function resolveVideoPlayUrl(id: number): Promise<string> {
  if (import.meta.env.DEV) {
    return getVideoUrl(id);
  }

  const custom = getVideoUrl(id);
  if (custom.startsWith("http")) {
    return custom;
  }

  const res = await fetch(`/api/video?id=${id}&format=json`, {
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(data.error || `Failed to resolve video ${id}`);
  }
  return data.url;
}
