import {
  listRequests,
  postRequest,
  deleteComment,
  addReply,
  deleteReply,
  toggleCommentLike,
  toggleReplyLike,
} from "../lib/requests-logic.mjs";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const slug = Array.isArray(req.query.slug) ? req.query.slug : req.query.slug ? [req.query.slug] : [];
  const body = parseBody(req);

  try {
    if (req.method === "GET" && slug.length === 0) {
      const result = await listRequests();
      res.status(200).json(result);
      return;
    }

    if (req.method === "POST" && slug.length === 0) {
      const { status, body: payload } = await postRequest(body);
      res.status(status).json(payload);
      return;
    }

    if (
      req.method === "POST" &&
      slug.length === 4 &&
      slug[1] === "comments" &&
      slug[3] === "replies"
    ) {
      const result = await addReply(slug[0], slug[2], body.reply);
      res.status(200).json(result);
      return;
    }

    if (
      req.method === "POST" &&
      slug.length === 6 &&
      slug[1] === "comments" &&
      slug[3] === "replies" &&
      slug[5] === "like"
    ) {
      const result = await toggleReplyLike(slug[0], slug[2], slug[4], body.ownerId);
      res.status(200).json(result);
      return;
    }

    if (
      req.method === "POST" &&
      slug.length === 4 &&
      slug[1] === "comments" &&
      slug[3] === "like"
    ) {
      const result = await toggleCommentLike(slug[0], slug[2], body.ownerId);
      res.status(200).json(result);
      return;
    }

    if (req.method === "DELETE" && slug.length === 3 && slug[1] === "comments") {
      const result = await deleteComment(slug[0], slug[2], body.ownerId);
      res.status(200).json(result);
      return;
    }

    if (req.method === "DELETE" && slug.length === 5 && slug[3] === "replies") {
      const result = await deleteReply(slug[0], slug[2], slug[4], body.ownerId);
      res.status(200).json(result);
      return;
    }

    res.status(404).json({ success: false, error: "Not found" });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || String(err);
    const hint =
      message.includes("SUPABASE") || message.includes("Missing")
        ? "请在 Vercel 环境变量中配置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY"
        : undefined;
    res.status(status).json({ success: false, error: message, hint });
  }
}
