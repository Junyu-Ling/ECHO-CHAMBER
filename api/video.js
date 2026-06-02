/** Vercel serverless: resolve Git LFS video URL for private GitHub repos */
const REPO = "Miyeon-0131/ECHO-CHAMBER";
const BRANCH = "ECHO-CHAMBER";
const FILES = {
  1: "src/imports/__.mp4",
  2: "src/imports/_______1_-2.mp4",
  3: "src/imports/_________1_-1.mp4",
};

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const filePath = FILES[id];
  if (!filePath) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "echo-chamber-site",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const apiUrl = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(filePath)}?ref=${BRANCH}`;
    const ghRes = await fetch(apiUrl, { headers });
    if (!ghRes.ok) {
      res.status(ghRes.status).json({ error: "GitHub API failed", status: ghRes.status });
      return;
    }
    const data = await ghRes.json();
    const target = data.download_url || data.url;
    if (!target) {
      res.status(502).json({ error: "No download URL from GitHub" });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.redirect(302, target);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
