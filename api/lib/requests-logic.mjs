import * as kv from "./requests-store.mjs";

function normalizeReply(reply) {
  return {
    ...reply,
    likedBy: Array.isArray(reply.likedBy) ? reply.likedBy : [],
  };
}

function toggleLikedBy(likedBy, ownerId) {
  const list = [...(likedBy || [])];
  const idx = list.indexOf(ownerId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(ownerId);
  return list;
}

function normalizeComment(cmt) {
  return {
    ...cmt,
    likedBy: Array.isArray(cmt.likedBy) ? cmt.likedBy : [],
    replies: Array.isArray(cmt.replies) ? cmt.replies.map(normalizeReply) : [],
  };
}

function stamp(req) {
  req.updatedAt = Date.now();
  return req;
}

function commentSortKey(c) {
  const m = /^(\d{10,13})/.exec(c.commentId || "");
  const fromId = m ? Number(m[1]) : 0;
  return c.createdAt > 0 ? c.createdAt : fromId < 1e12 ? fromId * 1000 : fromId;
}

function dedupeOwnerComments(comments) {
  const withoutOwner = comments.filter((c) => !c.ownerId);
  const byOwner = new Map();
  for (const c of comments) {
    if (!c.ownerId) continue;
    const list = byOwner.get(c.ownerId) || [];
    list.push(c);
    byOwner.set(c.ownerId, list);
  }
  const kept = [...withoutOwner];
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

export function normalizeRequest(req) {
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

export async function listRequests() {
  const raw = await kv.kvGetByPrefix("req:");
  const migrated = (raw || [])
    .filter((item) => item !== null)
    .map((req) => normalizeRequest(req))
    .filter((req) => req.comments?.length > 0);
  return { success: true, data: migrated };
}

async function loadTrack(id) {
  const key = `req:${id}`;
  const reqData = await kv.kvGet(key);
  if (!reqData?.comments) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }
  return { key, reqData };
}

export async function toggleCommentLike(trackId, commentId, ownerId) {
  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw Object.assign(new Error("Comment not found"), { status: 404 });
  const comment = normalizeComment(reqData.comments[idx]);
  comment.likedBy = toggleLikedBy(comment.likedBy, ownerId);
  reqData.comments[idx] = comment;
  await kv.kvSet(key, stamp(reqData));
  return { success: true, data: normalizeRequest(reqData) };
}

export async function toggleReplyLike(trackId, commentId, replyId, ownerId) {
  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw Object.assign(new Error("Comment not found"), { status: 404 });
  const comment = normalizeComment(reqData.comments[idx]);
  const rIdx = (comment.replies || []).findIndex((r) => r.replyId === replyId);
  if (rIdx < 0) throw Object.assign(new Error("Reply not found"), { status: 404 });
  const reply = normalizeReply(comment.replies[rIdx]);
  reply.likedBy = toggleLikedBy(reply.likedBy, ownerId);
  comment.replies[rIdx] = reply;
  reqData.comments[idx] = comment;
  await kv.kvSet(key, stamp(reqData));
  return { success: true, data: normalizeRequest(reqData) };
}

export async function addReply(trackId, commentId, reply) {
  if (!reply?.ownerId) throw Object.assign(new Error("Missing ownerId"), { status: 400 });
  const note = (reply.note || "").trim();
  if (!note) throw Object.assign(new Error("回复内容不能为空"), { status: 400 });
  if (note.length > 500) throw Object.assign(new Error("回复过长"), { status: 400 });

  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw Object.assign(new Error("Comment not found"), { status: 404 });

  const comment = normalizeComment(reqData.comments[idx]);
  comment.replies = [
    ...(comment.replies || []),
    normalizeReply({
      replyId: reply.replyId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      note,
      requester: (reply.requester || "匿名").trim() || "匿名",
      time: reply.time || "刚刚",
      ownerId: reply.ownerId,
      likedBy: [],
    }),
  ];
  reqData.comments[idx] = comment;
  await kv.kvSet(key, stamp(reqData));
  return { success: true, data: normalizeRequest(reqData) };
}

export async function deleteReply(trackId, commentId, replyId, ownerId) {
  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw Object.assign(new Error("Comment not found"), { status: 404 });

  const comment = normalizeComment(reqData.comments[idx]);
  const before = (comment.replies || []).length;
  comment.replies = (comment.replies || []).filter(
    (r) => !(r.replyId === replyId && r.ownerId === ownerId),
  );
  if (comment.replies.length === before) {
    throw Object.assign(new Error("Unauthorized or reply not found"), { status: 403 });
  }
  reqData.comments[idx] = comment;
  await kv.kvSet(key, stamp(reqData));
  return { success: true, data: normalizeRequest(reqData) };
}

export async function deleteComment(trackId, commentId, ownerId) {
  const key = `req:${trackId}`;
  const reqData = await kv.kvGet(key);
  if (!reqData?.comments) throw Object.assign(new Error("Not found"), { status: 404 });

  const originalLen = reqData.comments.length;
  reqData.comments = reqData.comments.filter(
    (c) => !(c.commentId === commentId && c.ownerId === ownerId),
  );
  if (reqData.comments.length === originalLen) {
    throw Object.assign(new Error("Unauthorized or comment not found"), { status: 403 });
  }
  reqData.votes = reqData.comments.length;
  if (reqData.votes === 0) {
    await kv.kvDel(key);
    return { success: true, deleted: true };
  }
  await kv.kvSet(key, stamp(reqData));
  return { success: true, data: normalizeRequest(reqData) };
}

export async function editComment(trackId, commentId, ownerId, patch) {
  const note = (patch.note || "").trim();
  const requester = (patch.requester || "").trim() || "匿名";
  if (!note) throw Object.assign(new Error("留言内容不能为空"), { status: 400 });
  if (note.length > 500) throw Object.assign(new Error("留言过长"), { status: 400 });

  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw Object.assign(new Error("Comment not found"), { status: 404 });

  const comment = normalizeComment(reqData.comments[idx]);
  if (comment.ownerId !== ownerId) {
    throw Object.assign(new Error("Unauthorized or comment not found"), { status: 403 });
  }
  const wasVote =
    comment.isVote === true ||
    (comment.note === "推荐了这首金曲" && comment.requester === "匿名");
  comment.note = note;
  comment.requester = requester;
  comment.isVote = wasVote ? note === "推荐了这首金曲" : false;
  reqData.comments[idx] = comment;
  await kv.kvSet(key, stamp(reqData));
  return { success: true, data: normalizeRequest(reqData) };
}

export async function postRequest(body) {
  const knownActions = new Set([
    "toggleCommentLike",
    "toggleReplyLike",
    "addReply",
    "deleteReply",
    "deleteComment",
    "editComment",
  ]);
  if (body.action && !knownActions.has(body.action)) {
    return { status: 400, body: { success: false, error: "Unknown action" } };
  }

  if (body.action === "toggleCommentLike") {
    if (!body.id || !body.commentId || !body.ownerId) {
      return { status: 400, body: { success: false, error: "Missing fields" } };
    }
    return { status: 200, body: await toggleCommentLike(body.id, body.commentId, body.ownerId) };
  }

  if (body.action === "toggleReplyLike") {
    if (!body.id || !body.commentId || !body.replyId || !body.ownerId) {
      return { status: 400, body: { success: false, error: "Missing fields" } };
    }
    return {
      status: 200,
      body: await toggleReplyLike(body.id, body.commentId, body.replyId, body.ownerId),
    };
  }

  if (body.action === "addReply") {
    if (!body.id || !body.commentId || !body.reply) {
      return { status: 400, body: { success: false, error: "Missing fields" } };
    }
    return { status: 200, body: await addReply(body.id, body.commentId, body.reply) };
  }

  if (body.action === "deleteReply") {
    if (!body.id || !body.commentId || !body.replyId || !body.ownerId) {
      return { status: 400, body: { success: false, error: "Missing fields" } };
    }
    return {
      status: 200,
      body: await deleteReply(body.id, body.commentId, body.replyId, body.ownerId),
    };
  }

  if (body.action === "deleteComment") {
    if (!body.id || !body.commentId || !body.ownerId) {
      return { status: 400, body: { success: false, error: "Missing fields" } };
    }
    return {
      status: 200,
      body: await deleteComment(body.id, body.commentId, body.ownerId),
    };
  }

  if (body.action === "editComment") {
    if (!body.id || !body.commentId || !body.ownerId) {
      return { status: 400, body: { success: false, error: "Missing fields" } };
    }
    return {
      status: 200,
      body: await editComment(body.id, body.commentId, body.ownerId, {
        note: body.note,
        requester: body.requester,
      }),
    };
  }

  if (body.action) {
    return { status: 400, body: { success: false, error: "Invalid action" } };
  }

  const id = body.id;
  if (!id) {
    return { status: 400, body: { success: false, error: "Missing track ID" } };
  }

  const key = `req:${id}`;
  let existing = await kv.kvGet(key);

  if (existing) {
    existing.comments = existing.comments || [];
    if (body.comments?.length > 0) {
      const incoming = body.comments[0];
      const ownerId = incoming.ownerId;
      if (ownerId) {
        const sameOwner = existing.comments.filter((c) => c.ownerId === ownerId);
        if (sameOwner.length > 0) {
          if (incoming.isVote) {
            return {
              status: 400,
              body: { success: false, error: "你已推荐或留言过这首歌，不能再投票" },
            };
          }
          return {
            status: 400,
            body: { success: false, error: "一个设备不能反复给一首歌评论或投票" },
          };
        }
      }
      existing.comments = [...body.comments, ...existing.comments];
    }
    existing.comments = existing.comments.map(normalizeComment);
    existing.votes = existing.comments.length;
    await kv.kvSet(key, stamp(existing));
    return { status: 200, body: { success: true, data: normalizeRequest(existing) } };
  }

  const reqData = normalizeRequest({ ...body });
  if (!reqData.comments) reqData.comments = [];
  reqData.createdAt = Date.now();
  reqData.votes = reqData.comments.length;
  await kv.kvSet(key, stamp(reqData));
  return { status: 200, body: { success: true, data: reqData } };
}
