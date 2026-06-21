/** Proxy iTunes Search API — same results for mainland & Taiwan (direct Apple CDN is flaky in CN). */
export default async function handler(req, res) {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    res.status(400).json({ error: "Query too short" });
    return;
  }

  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", q);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", "CN");

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

  try {
    const appleRes = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "echo-chamber-site" },
    });
    const text = await appleRes.text();
    res.status(appleRes.status).setHeader("Content-Type", "application/json").send(text);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
}
