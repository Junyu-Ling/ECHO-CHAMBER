const webRenditions: Record<number, string> = {
  1: "/videos/1.mp4",
  2: "/videos/2.mp4",
  3: "/videos/3.mp4",
};

const envOverride: Record<number, string | undefined> = {
  1: import.meta.env.VITE_VIDEO_1,
  2: import.meta.env.VITE_VIDEO_2,
  3: import.meta.env.VITE_VIDEO_3,
};

/** Site-hosted H.264 web renditions (public/videos). Override via VITE_VIDEO_* if needed. */
export function getVideoUrl(id: number): string {
  const custom = envOverride[id];
  if (custom) return custom;
  return webRenditions[id];
}

export const videoSources: Record<number, string> = {
  1: getVideoUrl(1),
  2: getVideoUrl(2),
  3: getVideoUrl(3),
};
