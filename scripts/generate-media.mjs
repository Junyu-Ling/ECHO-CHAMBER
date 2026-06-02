import sharp from "sharp";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const memberSourcesDir = path.join(root, "scripts/member-sources");
const assetsDir = path.join(root, "src/assets");
const postersDir = path.join(assetsDir, "posters");
const fallbackHero = path.join(root, "src/imports/fc9ade432714e08066f2002932e6f98b-1.jpg");
const heroSrc = path.join(memberSourcesDir, "hero-cover.png");

const heroSource = existsSync(heroSrc) ? heroSrc : fallbackHero;

await mkdir(postersDir, { recursive: true });
await mkdir(path.join(assetsDir, "members"), { recursive: true });

await sharp(heroSource)
  .resize(1920, null, { withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(path.join(assetsDir, "hero.webp"));

await sharp(heroSource)
  .resize(32, null)
  .blur(6)
  .webp({ quality: 55 })
  .toFile(path.join(assetsDir, "hero-placeholder.webp"));

const posterSrc = existsSync(fallbackHero) ? fallbackHero : heroSource;
for (const id of [1, 2, 3]) {
  await sharp(posterSrc)
    .resize(640, 360, { fit: "cover" })
    .webp({ quality: 78 })
    .toFile(path.join(postersDir, `video-${id}.webp`));
}

const memberSources = [
  ["shen-xinyu.png", "shen-xinyu.webp"],
  ["richard.png", "richard.webp"],
];

for (const [input, output] of memberSources) {
  const inputPath = path.join(memberSourcesDir, input);
  if (!existsSync(inputPath)) {
    console.warn(`Skip ${output}: place source at scripts/member-sources/${input}`);
    continue;
  }
  await sharp(inputPath)
    .resize(800, 1067, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toFile(path.join(assetsDir, "members", output));
}

console.log("Generated hero, posters, and member webp assets");
