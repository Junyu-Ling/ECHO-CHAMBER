/** Vercel serverless: redirect to site-hosted web video renditions */
const WEB_VIDEOS = {
  1: "/videos/1.mp4",
  2: "/videos/2.mp4",
  3: "/videos/3.mp4",
};

export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const path = WEB_VIDEOS[id];
  if (!path) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }

  const origin = req.headers["x-forwarded-host"]
    ? `https://${req.headers["x-forwarded-host"]}`
    : req.headers.origin || "https://echo-chamber.vercel.app";
  const url = `${origin}${path}`;

  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");

  if (req.query.format === "json" || req.headers.accept?.includes("application/json")) {
    res.status(200).json({ url });
    return;
  }

  res.redirect(307, url);
}
