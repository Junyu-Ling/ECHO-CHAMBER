/** Vercel serverless: resolve Git LFS video URL (returns JSON for <video> src) */
const REPO = "Miyeon-0131/ECHO-CHAMBER";
const BRANCHES = ["ECHO-CHAMBER", "main"];
const FILES = {
  1: "src/imports/__.mp4",
  2: "src/imports/_______1_-2.mp4",
  3: "src/imports/_________1_-1.mp4",
};

const MEDIA_CDN = "https://media.githubusercontent.com/media/Miyeon-0131/ECHO-CHAMBER";

async function fetchGitHubUrl(filePath, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "echo-chamber-site",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (const branch of BRANCHES) {
    const apiUrl = `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${branch}`;
    const ghRes = await fetch(apiUrl, { headers });
    if (!ghRes.ok) continue;

    const data = await ghRes.json();
    if (data.download_url) return data.download_url;
    if (typeof data.content === "string" && data.content.length < 500) {
      const decoded = Buffer.from(data.content, "base64").toString("utf8");
      if (decoded.startsWith("version https://git-lfs.github.com")) {
        continue;
      }
    }
  }
  return null;
}

function mediaCdnUrl(filePath, branch) {
  return `${MEDIA_CDN}/${branch}/${filePath}`;
}

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const filePath = FILES[id];
  if (!filePath) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");

  try {
    const token = process.env.GITHUB_TOKEN;
    let url = await fetchGitHubUrl(filePath, token);

    if (!url) {
      for (const branch of BRANCHES) {
        const cdn = mediaCdnUrl(filePath, branch);
        const probe = await fetch(cdn, { method: "HEAD" });
        if (probe.ok) {
          url = cdn;
          break;
        }
      }
    }

    if (!url) {
      res.status(404).json({
        error: "Video URL not found. Add GITHUB_TOKEN in Vercel env for private repo.",
      });
      return;
    }

    if (req.query.format === "json" || req.headers.accept?.includes("application/json")) {
      res.status(200).json({ url });
      return;
    }

    res.redirect(307, url);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
