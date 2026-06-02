import sharp from "sharp";
import { existsSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const ffmpegPath = ffmpegInstaller.path;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const importsDir = path.join(root, "src/imports");
const memberSourcesDir = path.join(root, "scripts/member-sources");
const assetsDir = path.join(root, "src/assets");
const postersDir = path.join(assetsDir, "posters");
const fallbackHero = path.join(root, "src/imports/fc9ade432714e08066f2002932e6f98b-1.jpg");
const heroSrc = path.join(memberSourcesDir, "hero-cover.png");

const heroSource = existsSync(heroSrc) ? heroSrc : fallbackHero;

const videoPosterSources = [
  [1, path.join(importsDir, "__.mp4")],
  [2, path.join(importsDir, "_______1_-2.mp4")],
  [3, path.join(importsDir, "_________1_-1.mp4")],
];

async function extractVideoPoster(videoPath, webpOut) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary not found");
  }
  const tmpJpg = webpOut.replace(/\.webp$/, ".jpg");
  const result = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "0.05",
      "-i",
      videoPath,
      "-vframes",
      "1",
      "-vf",
      "scale=640:360:force_original_aspect_ratio=increase,crop=640:360",
      "-q:v",
      "2",
      tmpJpg,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `ffmpeg failed for ${videoPath}`);
  }
  try {
    await sharp(tmpJpg).webp({ quality: 80 }).toFile(webpOut);
  } finally {
    if (existsSync(tmpJpg)) unlinkSync(tmpJpg);
  }
}

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

for (const [id, videoPath] of videoPosterSources) {
  if (!existsSync(videoPath)) {
    console.warn(`Skip video-${id} poster: missing ${videoPath}`);
    continue;
  }
  console.log(`Extracting poster for video ${id}...`);
  await extractVideoPoster(videoPath, path.join(postersDir, `video-${id}.webp`));
}

const memberSources = [
  ["shen-xinyu.png", "shen-xinyu.webp"],
  ["richard.png", "richard.webp"],
  ["ellis.png", "ellis.webp"],
  ["bai-qianhe.png", "bai-qianhe.webp"],
  ["gu-chenyang.png", "gu-chenyang.webp"],
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

console.log("Generated hero, video frame posters, and member webp assets");
