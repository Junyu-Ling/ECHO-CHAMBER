import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src/imports/fc9ade432714e08066f2002932e6f98b-1.jpg");
const assetsDir = path.join(root, "src/assets");
const postersDir = path.join(assetsDir, "posters");

await mkdir(postersDir, { recursive: true });

await sharp(src)
  .resize(1920, null, { withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(path.join(assetsDir, "hero.webp"));

await sharp(src)
  .resize(32, null)
  .blur(6)
  .webp({ quality: 55 })
  .toFile(path.join(assetsDir, "hero-placeholder.webp"));

for (const id of [1, 2, 3]) {
  await sharp(src)
    .resize(640, 360, { fit: "cover" })
    .webp({ quality: 78 })
    .toFile(path.join(postersDir, `video-${id}.webp`));
}

console.log("Generated hero.webp, hero-placeholder.webp, posters/video-*.webp");
