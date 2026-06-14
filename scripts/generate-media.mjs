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
  .rotate()
  .resize(1920, null, {
    withoutEnlargement: false,
    kernel: sharp.kernel.lanczos3,
  })
  .webp({ quality: 88, effort: 6 })
  .toFile(path.join(assetsDir, "hero.webp"));

await sharp(heroSource)
  .rotate()
  .resize(48, null)
  .blur(4)
  .webp({ quality: 60 })
  .toFile(path.join(assetsDir, "hero-placeholder.webp"));

for (const [id, videoPath] of videoPosterSources) {
  if (!existsSync(videoPath)) {
    console.warn(`Skip video-${id} poster: missing ${videoPath}`);
    continue;
  }
  console.log(`Extracting poster for video ${id}...`);
  await extractVideoPoster(videoPath, path.join(postersDir, `video-${id}.webp`));
}

const MEMBER_TARGET_W = 960;
const MEMBER_TARGET_H = 1280;

/** @typedef {{ position?: string; maxUpscale?: number; sharpen?: boolean; despeckle?: boolean; cropZoom?: number; focusX?: number; focusY?: number; preExtractCentre?: boolean }} MemberOpts */

/**
 * Remove isolated white speckles on dark edges (common cutout / compression artifacts).
 * @param {import("sharp").Sharp} sharpImage
 */
async function despeckleWhiteDots(sharpImage) {
  const { data, info } = await sharpImage
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const out = Buffer.from(data);
  const lumAt = (idx) =>
    0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  const isSpeckle = (idx) =>
    data[idx] > 175 &&
    data[idx + 1] > 175 &&
    data[idx + 2] > 175 &&
    Math.max(data[idx], data[idx + 1], data[idx + 2]) -
      Math.min(data[idx], data[idx + 1], data[idx + 2]) <
      45;

  for (let pass = 0; pass < 2; pass++) {
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * ch;
      if (!isSpeckle(idx)) continue;

      let darkNeighbors = 0;
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let n = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const j = ((y + dy) * w + (x + dx)) * ch;
          if (lumAt(j) < 130) darkNeighbors++;
          if (!isSpeckle(j)) {
            rSum += data[j];
            gSum += data[j + 1];
            bSum += data[j + 2];
            n++;
          }
        }
      }

      if (darkNeighbors >= 3 && n > 0) {
        out[idx] = Math.round(rSum / n);
        out[idx + 1] = Math.round(gSum / n);
        out[idx + 2] = Math.round(bSum / n);
      }
    }
  }
  for (let i = 0; i < data.length; i++) data[i] = out[i];
  }

  return sharp(out, { raw: { width: w, height: h, channels: ch } });
}

/** Blend with median pass to suppress remaining bright speckles on dark areas. */
async function suppressBrightSpeckles(sharpImage, medianSize = 3) {
  const buf = await sharpImage.ensureAlpha().png().toBuffer();
  const med = await sharp(buf).median(medianSize).toBuffer();
  return sharp(buf).composite([{ input: med, blend: "darken" }]);
}

/**
 * Export member portrait WebP: smart crop, optional despeckle, light sharpen only on small sources.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {MemberOpts} [opts]
 */
async function processMemberPhoto(inputPath, outputPath, opts = {}) {
  const position = opts.position ?? "attention";
  const despeckle = opts.despeckle === true;

  const meta = await sharp(inputPath).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  const maxDim = Math.max(srcW, srcH);

  const aspect = 3 / 4;
  let cropW = srcW;
  let cropH = srcH;
  if (srcW / srcH > aspect) {
    cropH = srcH;
    cropW = Math.round(srcH * aspect);
  } else {
    cropW = srcW;
    cropH = Math.round(srcW / aspect);
  }

  let maxUpscale = opts.maxUpscale;
  if (maxUpscale == null) {
    if (maxDim >= 1000) maxUpscale = 8;
    else if (maxDim >= 700) maxUpscale = 1.6;
    else if (maxDim >= 480) maxUpscale = 1.45;
    else maxUpscale = 2;
  }

  const scale = Math.min(
    MEMBER_TARGET_W / cropW,
    MEMBER_TARGET_H / cropH,
    maxUpscale
  );
  const outW = Math.max(1, Math.round(Math.min(MEMBER_TARGET_W, cropW * scale)));
  const outH = Math.max(1, Math.round(Math.min(MEMBER_TARGET_H, cropH * scale)));

  if (maxDim < 480) {
    console.warn(
      `[media] ${path.basename(inputPath)} is only ${srcW}×${srcH}px — replace with ≥800px-wide original for best clarity`
    );
  } else if (scale >= maxUpscale - 0.01) {
    console.warn(
      `[media] ${path.basename(inputPath)} (${srcW}×${srcH}) capped at ${outW}×${outH} — send a higher-resolution photo if possible`
    );
  }

  let pipeline = sharp(inputPath).rotate();

  if (opts.preExtractCentre && srcW / srcH > aspect) {
    const eh = srcH;
    const ew = Math.round(srcH * aspect);
    const left = Math.round((srcW - ew) / 2);
    pipeline = pipeline.extract({ left, top: 0, width: ew, height: eh });
  }

  if (despeckle) {
    const rotated = await pipeline.toBuffer();
    pipeline = await despeckleWhiteDots(sharp(rotated));
  }

  pipeline = pipeline.resize(outW, outH, {
    fit: "cover",
    position,
    kernel: sharp.kernel.lanczos3,
  });

  if (despeckle) {
    pipeline = await suppressBrightSpeckles(pipeline);
  }

  const cropZoom = opts.cropZoom ?? 1;
  if (cropZoom > 1) {
    const focusX = opts.focusX ?? 0.5;
    const focusY = opts.focusY ?? 0.5;
    const buf = await pipeline.toBuffer();
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? outW;
    const h = meta.height ?? outH;
    const nw = Math.max(1, Math.round(w / cropZoom));
    const nh = Math.max(1, Math.round(h / cropZoom));
    const centerX = focusX * w;
    const centerY = focusY * h;
    pipeline = sharp(buf)
      .extract({
        left: Math.round(Math.max(0, Math.min(w - nw, centerX - nw / 2))),
        top: Math.round(Math.max(0, Math.min(h - nh, centerY - nh / 2))),
        width: nw,
        height: nh,
      })
      .resize(outW, outH, {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      });
  }

  const applySharpen =
    opts.sharpen === true || (opts.sharpen !== false && maxDim < 800);
  if (applySharpen) {
    pipeline = pipeline.sharpen({ sigma: maxDim < 480 ? 0.8 : 0.5, m1: 0.85, m2: 0.25 });
  }

  await pipeline
    .webp({
      quality: maxDim < 480 ? 96 : 94,
      effort: 6,
      smartSubsample: false,
    })
    .toFile(outputPath);

  console.log(`[media] ${path.basename(outputPath)} ← ${srcW}×${srcH} → ${outW}×${outH}`);
}

const memberSources = [
  ["gong-laoshi.png", "gong-laoshi.webp", { position: "centre", sharpen: false, cropZoom: 1.06 }],
  ["richard.png", "richard.webp", {}],
  ["ellis.png", "ellis.webp", {}],
  [
    "bai-qianhe.png",
    "bai-qianhe.webp",
    {
      position: "centre",
      maxUpscale: 2.2,
      sharpen: false,
      focusX: 0.52,
      focusY: 0.54,
      cropZoom: 1.45,
    },
  ],
  ],
  ["huang-ziyi.png", "huang-ziyi.webp", { position: "centre", maxUpscale: 2.2, cropZoom: 1.08 }],
  ["liu-yiyang.png", "liu-yiyang.webp", { position: "centre", maxUpscale: 2.2 }],
  ["hu-yuqin.png", "hu-yuqin.webp", { position: "centre", maxUpscale: 2, cropZoom: 1.04 }],
];

for (const [input, output, opts] of memberSources) {
  const inputPath = path.join(memberSourcesDir, input);
  if (!existsSync(inputPath)) {
    console.warn(`Skip ${output}: place source at scripts/member-sources/${input}`);
    continue;
  }
  await processMemberPhoto(
    inputPath,
    path.join(assetsDir, "members", output),
    opts
  );
}

console.log("Generated hero, video frame posters, and member webp assets");
