import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const videosDir = path.join(root, "dist/videos");
const MIN_BYTES = 1_000_000;

for (const id of [1, 2, 3]) {
  const file = path.join(videosDir, `${id}.mp4`);
  if (!existsSync(file)) {
    console.error(`[verify-videos] missing ${file}`);
    process.exit(1);
  }
  const size = statSync(file).size;
  if (size < MIN_BYTES) {
    console.error(
      `[verify-videos] ${file} is only ${size} bytes — likely a Git LFS pointer, not a real video`
    );
    process.exit(1);
  }
  console.log(`[verify-videos] ${id}.mp4 OK (${(size / 1024 / 1024).toFixed(1)} MB)`);
}
