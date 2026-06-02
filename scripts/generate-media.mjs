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

async function memberPortrait(inputPath, outputPath, zoom = 1) {
  const w = 800;
  const h = 1067;
  const meta = await sharp(inputPath).metadata();
  const scale = Math.min((w * zoom) / meta.width, (h * zoom) / meta.height);
  const resized = await sharp(inputPath)
    .resize(Math.round(meta.width * scale), Math.round(meta.height * scale))
    .toBuffer();

  await sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: { r: 7, g: 7, b: 12 },
    },
  })
    .composite([{ input: resized, gravity: "centre" }])
    .webp({ quality: 85 })
    .toFile(outputPath);
}

const memberSources = [
  ["shen-xinyu.png", "shen-xinyu.webp", 0.82],
  ["richard.png", "richard.webp", 1],
];

for (const [input, output, zoom] of memberSources) {
  const inputPath = path.join(memberSourcesDir, input);
  if (!existsSync(inputPath)) {
    console.warn(`Skip ${output}: place source at scripts/member-sources/${input}`);
    continue;
  }
  await memberPortrait(inputPath, path.join(assetsDir, "members", output), zoom);
}

console.log("Generated hero, posters, and member webp assets");
