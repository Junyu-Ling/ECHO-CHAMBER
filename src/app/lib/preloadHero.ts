import heroImage from "../../assets/hero.webp";
import heroPlaceholder from "../../assets/hero-placeholder.webp";

let started = false;

/** Start loading hero assets before React paints the hero section. */
export function preloadHeroAssets() {
  if (started) return;
  started = true;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = heroImage;
  link.setAttribute("fetchpriority", "high");
  document.head.appendChild(link);

  const hq = new Image();
  hq.decoding = "async";
  hq.fetchPriority = "high";
  hq.src = heroImage;

  const lq = new Image();
  lq.decoding = "async";
  lq.src = heroPlaceholder;
}

export { heroImage, heroPlaceholder };
