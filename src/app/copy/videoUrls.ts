const cdnBase =
  import.meta.env.VITE_VIDEO_CDN_BASE ??
  "https://media.githubusercontent.com/media/Miyeon-0131/ECHO-CHAMBER/ECHO-CHAMBER/src/imports";

export const videoSources: Record<number, string> = {
  1: import.meta.env.VITE_VIDEO_1 ?? `${cdnBase}/__.mp4`,
  2: import.meta.env.VITE_VIDEO_2 ?? `${cdnBase}/_______1_-2.mp4`,
  3: import.meta.env.VITE_VIDEO_3 ?? `${cdnBase}/_________1_-1.mp4`,
};
