const cdnBase =
  import.meta.env.VITE_VIDEO_CDN_BASE ??
  "https://media.githubusercontent.com/media/Miyeon-0131/ECHO-CHAMBER/ECHO-CHAMBER/src/imports";

const prodCdn: Record<number, string> = {
  1: import.meta.env.VITE_VIDEO_1 ?? `${cdnBase}/__.mp4`,
  2: import.meta.env.VITE_VIDEO_2 ?? `${cdnBase}/_______1_-2.mp4`,
  3: import.meta.env.VITE_VIDEO_3 ?? `${cdnBase}/_________1_-1.mp4`,
};

const devLocal: Record<number, string> = {
  1: new URL("../../imports/__.mp4", import.meta.url).href,
  2: new URL("../../imports/_______1_-2.mp4", import.meta.url).href,
  3: new URL("../../imports/_________1_-1.mp4", import.meta.url).href,
};

const envOverride: Record<number, string | undefined> = {
  1: import.meta.env.VITE_VIDEO_1,
  2: import.meta.env.VITE_VIDEO_2,
  3: import.meta.env.VITE_VIDEO_3,
};

/** Dev: local files. Prod: public GitHub LFS CDN (repo is public). */
export function getVideoUrl(id: number): string {
  if (import.meta.env.DEV) return devLocal[id];
  const custom = envOverride[id];
  if (custom) return custom;
  return prodCdn[id];
}

export const videoSources: Record<number, string> = {
  1: getVideoUrl(1),
  2: getVideoUrl(2),
  3: getVideoUrl(3),
};
