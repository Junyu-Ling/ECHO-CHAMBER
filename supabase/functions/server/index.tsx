import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes
app.use(
  "/make-server-2914ec93/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check
app.get("/make-server-2914ec93/health", (c) => c.json({ status: "ok" }));

function inferTimestampFromId(id: string): number | undefined {
  const m = /^(\d{10,13})/.exec(id);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 1e12 ? n * 1000 : n;
}

function normalizeReply(reply: any) {
  const createdAt =
    typeof reply.createdAt === "number" && reply.createdAt > 0
      ? reply.createdAt
      : inferTimestampFromId(reply.replyId);
  return {
    ...reply,
    ...(createdAt ? { createdAt } : {}),
    likedBy: Array.isArray(reply.likedBy) ? reply.likedBy : [],
  };
}

function toggleLikedBy(likedBy: string[], ownerId: string) {
  const list = [...(likedBy || [])];
  const idx = list.indexOf(ownerId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(ownerId);
  return list;
}

function normalizeComment(cmt: any) {
  const createdAt =
    typeof cmt.createdAt === "number" && cmt.createdAt > 0
      ? cmt.createdAt
      : inferTimestampFromId(cmt.commentId);
  return {
    ...cmt,
    ...(createdAt ? { createdAt } : {}),
    likedBy: Array.isArray(cmt.likedBy) ? cmt.likedBy : [],
    replies: Array.isArray(cmt.replies) ? cmt.replies.map(normalizeReply) : [],
  };
}

function stampReq(req: any) {
  req.updatedAt = Date.now();
  return req;
}

function commentSortKey(c: any) {
  if (typeof c.createdAt === "number" && c.createdAt > 0) return c.createdAt;
  return inferTimestampFromId(c.commentId) ?? 0;
}

/** 同一 ownerId 仅保留一条：优先留言，否则最早投票 */
function dedupeOwnerComments(comments: any[]) {
  const withoutOwner = comments.filter((c) => !c.ownerId);
  const byOwner = new Map<string, any[]>();
  for (const c of comments) {
    if (!c.ownerId) continue;
    const list = byOwner.get(c.ownerId) || [];
    list.push(c);
    byOwner.set(c.ownerId, list);
  }
  const kept: any[] = [...withoutOwner];
  for (const list of byOwner.values()) {
    if (list.length === 1) {
      kept.push(list[0]);
      continue;
    }
    const messages = list.filter((c) => c.isVote !== true);
    if (messages.length > 0) {
      messages.sort((a, b) => commentSortKey(a) - commentSortKey(b));
      kept.push(messages[0]);
      continue;
    }
    const votes = [...list].sort((a, b) => commentSortKey(a) - commentSortKey(b));
    kept.push(votes[0]);
  }
  return kept.sort((a, b) => commentSortKey(b) - commentSortKey(a));
}

function normalizeRequest(req: any) {
  if (!req) return req;
  if (req.comments !== undefined) {
    const comments = dedupeOwnerComments((req.comments || []).map(normalizeComment));
    return {
      ...req,
      updatedAt: req.updatedAt || req.createdAt || Date.now(),
      comments,
      votes: comments.length,
    };
  }
  return {
    ...req,
    comments: req.note || req.requester
      ? [
          normalizeComment({
            commentId: req.id?.toString() || Date.now().toString(),
            note: req.note || "",
            requester: req.requester || "匿名",
            time: req.time || "刚刚",
            ownerId: req.ownerId || "",
          }),
        ]
      : [],
    createdAt: req.createdAt || req.id || Date.now(),
  };
}

async function toggleCommentLikeInStore(
  trackId: string | number,
  commentId: string,
  ownerId: string,
) {
  const key = `req:${trackId}`;
  const reqData = await kv.get(key);
  if (!reqData?.comments) {
    throw new Error("Not found");
  }
  const idx = reqData.comments.findIndex((cmt: any) => cmt.commentId === commentId);
  if (idx < 0) {
    throw new Error("Comment not found");
  }
  const comment = normalizeComment(reqData.comments[idx]);
  comment.likedBy = toggleLikedBy(comment.likedBy, ownerId);
  reqData.comments[idx] = comment;
  await kv.set(key, stampReq(reqData));
  return normalizeRequest(reqData);
}

async function toggleReplyLikeInStore(
  trackId: string | number,
  commentId: string,
  replyId: string,
  ownerId: string,
) {
  const key = `req:${trackId}`;
  const reqData = await kv.get(key);
  if (!reqData?.comments) {
    throw new Error("Not found");
  }
  const idx = reqData.comments.findIndex((cmt: any) => cmt.commentId === commentId);
  if (idx < 0) {
    throw new Error("Comment not found");
  }
  const comment = normalizeComment(reqData.comments[idx]);
  const rIdx = (comment.replies || []).findIndex((r: any) => r.replyId === replyId);
  if (rIdx < 0) {
    throw new Error("Reply not found");
  }
  const reply = normalizeReply(comment.replies[rIdx]);
  reply.likedBy = toggleLikedBy(reply.likedBy, ownerId);
  comment.replies[rIdx] = reply;
  reqData.comments[idx] = comment;
  await kv.set(key, stampReq(reqData));
  return normalizeRequest(reqData);
}

async function addReplyInStore(
  trackId: string | number,
  commentId: string,
  reply: any,
) {
  if (!reply?.ownerId) throw new Error("Missing ownerId");
  const note = (reply.note || "").trim();
  if (!note) throw new Error("回复内容不能为空");
  if (note.length > 500) throw new Error("回复过长");

  const key = `req:${trackId}`;
  const reqData = await kv.get(key);
  if (!reqData?.comments) throw new Error("Not found");

  const idx = reqData.comments.findIndex((cmt: any) => cmt.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");

  const comment = normalizeComment(reqData.comments[idx]);
  const replyCreatedAt = Date.now();
  comment.replies = [
    ...(comment.replies || []),
    normalizeReply({
      replyId: reply.replyId || `${replyCreatedAt}-${Math.random().toString(36).slice(2)}`,
      note,
      requester: (reply.requester || "匿名").trim() || "匿名",
      createdAt: reply.createdAt || replyCreatedAt,
      time: reply.time || new Date(replyCreatedAt).toISOString().slice(0, 16).replace("T", " "),
      ownerId: reply.ownerId,
      likedBy: [],
    }),
  ];
  reqData.comments[idx] = comment;
  await kv.set(key, stampReq(reqData));
  return normalizeRequest(reqData);
}

async function deleteReplyInStore(
  trackId: string | number,
  commentId: string,
  replyId: string,
  ownerId: string,
) {
  const key = `req:${trackId}`;
  const reqData = await kv.get(key);
  if (!reqData?.comments) throw new Error("Not found");

  const idx = reqData.comments.findIndex((cmt: any) => cmt.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");

  const comment = normalizeComment(reqData.comments[idx]);
  const before = (comment.replies || []).length;
  comment.replies = (comment.replies || []).filter(
    (r: any) => !(r.replyId === replyId && r.ownerId === ownerId),
  );
  if (comment.replies.length === before) {
    throw new Error("Unauthorized or reply not found");
  }
  reqData.comments[idx] = comment;
  await kv.set(key, stampReq(reqData));
  return normalizeRequest(reqData);
}

async function deleteCommentInStore(
  trackId: string | number,
  commentId: string,
  ownerId: string,
) {
  const key = `req:${trackId}`;
  const reqData = await kv.get(key);
  if (!reqData?.comments) throw new Error("Not found");

  const originalLen = reqData.comments.length;
  reqData.comments = reqData.comments.filter(
    (cmt: any) => !(cmt.commentId === commentId && cmt.ownerId === ownerId),
  );
  if (reqData.comments.length === originalLen) {
    throw new Error("Unauthorized or comment not found");
  }
  reqData.votes = reqData.comments.length;
  if (reqData.votes === 0) {
    await kv.del(key);
    return { deleted: true };
  }
  await kv.set(key, stampReq(reqData));
  return { data: normalizeRequest(reqData) };
}

async function editCommentInStore(
  trackId: string | number,
  commentId: string,
  ownerId: string,
  patch: { note?: string; requester?: string },
) {
  const note = (patch.note || "").trim();
  const requester = (patch.requester || "").trim() || "匿名";
  if (!note) throw new Error("留言内容不能为空");
  if (note.length > 500) throw new Error("留言过长");

  const key = `req:${trackId}`;
  const reqData = await kv.get(key);
  if (!reqData?.comments) throw new Error("Not found");

  const idx = reqData.comments.findIndex((cmt: any) => cmt.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");

  const comment = normalizeComment(reqData.comments[idx]);
  if (comment.ownerId !== ownerId) {
    throw new Error("Unauthorized or comment not found");
  }
  const wasVote =
    comment.isVote === true ||
    (comment.note === "推荐了这首金曲" && comment.requester === "匿名");
  comment.note = note;
  comment.requester = requester;
  comment.isVote = wasVote ? note === "推荐了这首金曲" : false;
  reqData.comments[idx] = comment;
  await kv.set(key, stampReq(reqData));
  return normalizeRequest(reqData);
}

// Get all requests
app.get("/make-server-2914ec93/requests", async (c) => {
  try {
    const rawData = await kv.getByPrefix("req:");
    if (!rawData || !Array.isArray(rawData)) {
      return c.json({ success: true, data: [] });
    }

    const migrated = rawData
      .filter((item) => item !== null)
      .map((req: any) => normalizeRequest(req))
      .filter((req: any) => req.comments && req.comments.length > 0);

    return c.json({ success: true, data: migrated });
  } catch (error: any) {
    console.error("Error getting requests:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add a request or comment
app.post("/make-server-2914ec93/requests", async (c) => {
  try {
    const body = await c.req.json();

    const action = body.action;
    if (action) {
      const known = new Set([
        "toggleCommentLike",
        "toggleReplyLike",
        "addReply",
        "deleteReply",
        "deleteComment",
        "editComment",
      ]);
      if (!known.has(action)) {
        return c.json({ success: false, error: "Unknown action" }, 400);
      }
    }

    if (body.action === "toggleCommentLike") {
      if (!body.id || !body.commentId || !body.ownerId) {
        return c.json({ success: false, error: "Missing fields" }, 400);
      }
      try {
        const data = await toggleCommentLikeInStore(body.id, body.commentId, body.ownerId);
        return c.json({ success: true, data });
      } catch (error: any) {
        console.error("Error toggling comment like (action):", error);
        const status = error.message?.includes("not found") ? 404 : 500;
        return c.json({ success: false, error: error.message }, status);
      }
    }

    if (body.action === "toggleReplyLike") {
      if (!body.id || !body.commentId || !body.replyId || !body.ownerId) {
        return c.json({ success: false, error: "Missing fields" }, 400);
      }
      try {
        const data = await toggleReplyLikeInStore(
          body.id,
          body.commentId,
          body.replyId,
          body.ownerId,
        );
        return c.json({ success: true, data });
      } catch (error: any) {
        console.error("Error toggling reply like (action):", error);
        const status = error.message?.includes("not found") ? 404 : 500;
        return c.json({ success: false, error: error.message }, status);
      }
    }

    if (body.action === "addReply") {
      if (!body.id || !body.commentId || !body.reply) {
        return c.json({ success: false, error: "Missing fields" }, 400);
      }
      try {
        const data = await addReplyInStore(body.id, body.commentId, body.reply);
        return c.json({ success: true, data });
      } catch (error: any) {
        console.error("Error adding reply (action):", error);
        const status = error.message?.includes("not found") ? 404 : 400;
        return c.json({ success: false, error: error.message }, status);
      }
    }

    if (body.action === "deleteReply") {
      if (!body.id || !body.commentId || !body.replyId || !body.ownerId) {
        return c.json({ success: false, error: "Missing fields" }, 400);
      }
      try {
        const data = await deleteReplyInStore(
          body.id,
          body.commentId,
          body.replyId,
          body.ownerId,
        );
        return c.json({ success: true, data });
      } catch (error: any) {
        console.error("Error deleting reply (action):", error);
        const status = error.message?.includes("not found") ? 404 : 403;
        return c.json({ success: false, error: error.message }, status);
      }
    }

    if (body.action === "deleteComment") {
      if (!body.id || !body.commentId || !body.ownerId) {
        return c.json({ success: false, error: "Missing fields" }, 400);
      }
      try {
        const result = await deleteCommentInStore(body.id, body.commentId, body.ownerId);
        if (result.deleted) return c.json({ success: true, deleted: true });
        return c.json({ success: true, data: result.data });
      } catch (error: any) {
        console.error("Error deleting comment (action):", error);
        const status = error.message?.includes("not found") ? 404 : 403;
        return c.json({ success: false, error: error.message }, status);
      }
    }

    if (body.action === "editComment") {
      if (!body.id || !body.commentId || !body.ownerId) {
        return c.json({ success: false, error: "Missing fields" }, 400);
      }
      try {
        const data = await editCommentInStore(
          body.id,
          body.commentId,
          body.ownerId,
          { note: body.note, requester: body.requester },
        );
        return c.json({ success: true, data });
      } catch (error: any) {
        console.error("Error editing comment (action):", error);
        const status = error.message?.includes("not found") ? 404 : 400;
        return c.json({ success: false, error: error.message }, status);
      }
    }

    if (body.action) {
      return c.json({ success: false, error: "Invalid action" }, 400);
    }

    const id = body.id;
    if (!id) return c.json({ success: false, error: "Missing track ID" }, 400);

    const key = `req:${id}`;
    let existing = await kv.get(key);

    if (existing) {
      existing.comments = existing.comments || [];
      if (body.comments && body.comments.length > 0) {
        const incoming = body.comments[0];
        const ownerId = incoming.ownerId;
        if (ownerId) {
          const sameOwner = existing.comments.filter((cmt: any) => cmt.ownerId === ownerId);
          if (sameOwner.length > 0) {
            if (incoming.isVote) {
              return c.json({ success: false, error: "你已推荐或留言过这首歌，不能再投票" }, 400);
            }
            return c.json({ success: false, error: "一个设备不能反复给一首歌评论或投票" }, 400);
          }
        }
        existing.comments = [...body.comments, ...existing.comments];
      }
      existing.comments = existing.comments.map(normalizeComment);
      existing.votes = existing.comments.length;
      await kv.set(key, stampReq(existing));
      return c.json({ success: true, data: normalizeRequest(existing) });
    } else {
      const reqData = normalizeRequest({ ...body });
      if (!reqData.comments) reqData.comments = [];
      reqData.createdAt = Date.now();
      reqData.votes = reqData.comments.length;
      await kv.set(key, stampReq(reqData));
      return c.json({ success: true, data: reqData });
    }
  } catch (error: any) {
    console.error("Error adding request:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete a comment
app.delete("/make-server-2914ec93/requests/:id/comments/:commentId", async (c) => {
  try {
    const id = c.req.param("id");
    const commentId = c.req.param("commentId");
    const body = await c.req.json();
    const ownerId = body.ownerId;
    const key = `req:${id}`;

    const reqData = await kv.get(key);
    if (!reqData) return c.json({ success: false, error: "Not found" }, 404);

    if (reqData.comments) {
      const originalLen = reqData.comments.length;
      reqData.comments = reqData.comments.filter((cmt: any) => !(cmt.commentId === commentId && cmt.ownerId === ownerId));
      if (reqData.comments.length === originalLen) {
        return c.json({ success: false, error: "Unauthorized or comment not found" }, 403);
      }
      reqData.votes = reqData.comments.length;
      if (reqData.votes === 0) {
        await kv.del(key);
        return c.json({ success: true, deleted: true });
      }
      await kv.set(key, stampReq(reqData));
      return c.json({ success: true, data: normalizeRequest(reqData) });
    }
    return c.json({ success: false, error: "No comments" }, 404);
  } catch (error: any) {
    console.error("Error deleting comment:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Add a reply under a comment
app.post("/make-server-2914ec93/requests/:id/comments/:commentId/replies", async (c) => {
  try {
    const id = c.req.param("id");
    const commentId = c.req.param("commentId");
    const body = await c.req.json();
    const reply = body.reply;
    if (!reply?.ownerId) {
      return c.json({ success: false, error: "Missing ownerId" }, 400);
    }
    const note = (reply.note || "").trim();
    if (!note) {
      return c.json({ success: false, error: "回复内容不能为空" }, 400);
    }
    if (note.length > 500) {
      return c.json({ success: false, error: "回复过长" }, 400);
    }

    const key = `req:${id}`;
    const reqData = await kv.get(key);
    if (!reqData?.comments) {
      return c.json({ success: false, error: "Not found" }, 404);
    }

    const idx = reqData.comments.findIndex((cmt: any) => cmt.commentId === commentId);
    if (idx < 0) {
      return c.json({ success: false, error: "Comment not found" }, 404);
    }

    const comment = normalizeComment(reqData.comments[idx]);
    const replyCreatedAt = Date.now();
    comment.replies = [...(comment.replies || []), normalizeReply({
      replyId: reply.replyId || `${replyCreatedAt}-${Math.random().toString(36).slice(2)}`,
      note,
      requester: (reply.requester || "匿名").trim() || "匿名",
      createdAt: reply.createdAt || replyCreatedAt,
      time: reply.time || new Date(replyCreatedAt).toISOString().slice(0, 16).replace("T", " "),
      ownerId: reply.ownerId,
      likedBy: [],
    })];
    reqData.comments[idx] = comment;
    await kv.set(key, stampReq(reqData));
    return c.json({ success: true, data: normalizeRequest(reqData) });
  } catch (error: any) {
    console.error("Error adding reply:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete own reply
app.delete("/make-server-2914ec93/requests/:id/comments/:commentId/replies/:replyId", async (c) => {
  try {
    const id = c.req.param("id");
    const commentId = c.req.param("commentId");
    const replyId = c.req.param("replyId");
    const body = await c.req.json();
    const ownerId = body.ownerId;
    const key = `req:${id}`;

    const reqData = await kv.get(key);
    if (!reqData?.comments) {
      return c.json({ success: false, error: "Not found" }, 404);
    }

    const idx = reqData.comments.findIndex((cmt: any) => cmt.commentId === commentId);
    if (idx < 0) {
      return c.json({ success: false, error: "Comment not found" }, 404);
    }

    const comment = normalizeComment(reqData.comments[idx]);
    const before = (comment.replies || []).length;
    comment.replies = (comment.replies || []).filter(
      (r: any) => !(r.replyId === replyId && r.ownerId === ownerId),
    );
    if (comment.replies.length === before) {
      return c.json({ success: false, error: "Unauthorized or reply not found" }, 403);
    }
    reqData.comments[idx] = comment;
    await kv.set(key, stampReq(reqData));
    return c.json({ success: true, data: normalizeRequest(reqData) });
  } catch (error: any) {
    console.error("Error deleting reply:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Toggle like on a comment (does not change song vote count)
app.post("/make-server-2914ec93/requests/:id/comments/:commentId/like", async (c) => {
  try {
    const id = c.req.param("id");
    const commentId = c.req.param("commentId");
    const body = await c.req.json();
    const ownerId = body.ownerId;
    if (!ownerId) {
      return c.json({ success: false, error: "Missing ownerId" }, 400);
    }
    const data = await toggleCommentLikeInStore(id, commentId, ownerId);
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error("Error toggling comment like:", error);
    const status = error.message === "Not found" || error.message === "Comment not found" ? 404 : 500;
    return c.json({ success: false, error: error.message }, status);
  }
});

// Toggle like on a reply (does not change song vote count)
app.post("/make-server-2914ec93/requests/:id/comments/:commentId/replies/:replyId/like", async (c) => {
  try {
    const id = c.req.param("id");
    const commentId = c.req.param("commentId");
    const replyId = c.req.param("replyId");
    const body = await c.req.json();
    const ownerId = body.ownerId;
    if (!ownerId) {
      return c.json({ success: false, error: "Missing ownerId" }, 400);
    }
    const data = await toggleReplyLikeInStore(id, commentId, replyId, ownerId);
    return c.json({ success: true, data });
  } catch (error: any) {
    console.error("Error toggling reply like:", error);
    const status = error.message.includes("not found") ? 404 : 500;
    return c.json({ success: false, error: error.message }, status);
  }
});

Deno.serve(app.fetch);
