import { supabase } from "../supabaseClient";
import { VOTE_NOTE } from "../copy/voteCopy";
import {
  formatCommentTimestamp,
  inferTimestampFromId,
  stampCommentEdit,
  stampReplyEdit,
} from "./commentTime";
import { assertOwnerOrAssign } from "./ownerAuth";
import { dedupeOwnerComments, isVoteComment } from "./voteParticipation";
import type { Comment, Reply, SongRequest } from "../types/songRequest";

const TABLE = "kv_store_2914ec93";

export type { SongRequest };

function normalizeReply(reply: Reply): Reply {
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

function normalizeComment(cmt: Comment): Comment {
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

function stamp<T extends Record<string, unknown>>(req: T): T {
  return { ...req, updatedAt: Date.now() };
}

export function normalizeRequest(req: SongRequest): SongRequest {
  if (!req) return req;
  if (req.comments !== undefined) {
    const comments = dedupeOwnerComments(
      (req.comments || []).map(normalizeComment)
    );
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
    updatedAt: Date.now(),
  } as SongRequest;
}

async function kvGet(key: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}

async function kvSet(key: string, value: SongRequest) {
  const { error } = await supabase.from(TABLE).upsert({ key, value });
  if (error) {
    if (error.message.includes("row-level security")) {
      throw new Error(
        "数据库未开放写入权限，请在 Supabase SQL Editor 执行 supabase/migrations/20260602120000_kv_store_anon_policies.sql"
      );
    }
    throw new Error(error.message);
  }
}

async function kvDel(key: string) {
  const { error } = await supabase.from(TABLE).delete().eq("key", key);
  if (error) throw new Error(error.message);
}

async function kvGetByPrefix(prefix: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("value")
    .like("key", `${prefix}%`);
  if (error) throw new Error(error.message);
  return data?.map((d) => d.value) ?? [];
}

async function loadTrack(trackId: number | string) {
  const key = `req:${trackId}`;
  const reqData = (await kvGet(key)) as SongRequest | null;
  if (!reqData?.comments) {
    throw new Error("Not found");
  }
  return { key, reqData };
}

export async function listRequestsFromDb(): Promise<SongRequest[]> {
  const raw = await kvGetByPrefix("req:");
  return raw
    .filter((item) => item !== null)
    .map((req) => normalizeRequest(req as SongRequest))
    .filter((req) => req.comments?.length > 0);
}

export async function toggleCommentLike(
  trackId: number,
  commentId: string,
  ownerId: string
) {
  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");
  const comment = normalizeComment(reqData.comments[idx] as Comment);
  comment.likedBy = toggleLikedBy(comment.likedBy || [], ownerId);
  reqData.comments[idx] = comment as SongRequest["comments"][0];
  await kvSet(key, stamp(normalizeRequest(reqData)));
  return normalizeRequest(reqData);
}

export async function toggleReplyLike(
  trackId: number,
  commentId: string,
  replyId: string,
  ownerId: string
) {
  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");
  const comment = normalizeComment(reqData.comments[idx] as Comment);
  const rIdx = (comment.replies || []).findIndex((r) => r.replyId === replyId);
  if (rIdx < 0) throw new Error("Reply not found");
  const reply = normalizeReply(comment.replies![rIdx]);
  reply.likedBy = toggleLikedBy(reply.likedBy || [], ownerId);
  comment.replies![rIdx] = reply;
  reqData.comments[idx] = comment as SongRequest["comments"][0];
  await kvSet(key, stamp(normalizeRequest(reqData)));
  return normalizeRequest(reqData);
}

export async function addReplyToDb(
  trackId: number,
  commentId: string,
  reply: Reply
) {
  const note = (reply.note || "").trim();
  if (!note) throw new Error("回复内容不能为空");
  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");
  const comment = normalizeComment(reqData.comments[idx] as Comment);
  comment.replies = [
    ...(comment.replies || []),
    normalizeReply({
      ...reply,
      note,
      requester: (reply.requester || "匿名").trim() || "匿名",
      likedBy: [],
    }),
  ];
  reqData.comments[idx] = comment as SongRequest["comments"][0];
  await kvSet(key, stamp(normalizeRequest(reqData)));
  return normalizeRequest(reqData);
}

export async function updateReplyInDb(
  trackId: number,
  commentId: string,
  replyId: string,
  ownerId: string,
  patch: { note: string; requester: string }
) {
  const note = patch.note.trim();
  const requester = patch.requester.trim() || "匿名";
  if (!note) throw new Error("回复内容不能为空");
  if (note.length > 500) throw new Error("回复过长");

  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");
  const comment = normalizeComment(reqData.comments[idx] as Comment);
  const rIdx = (comment.replies || []).findIndex((r) => r.replyId === replyId);
  if (rIdx < 0) throw new Error("Reply not found");
  const reply = normalizeReply(comment.replies![rIdx]);
  try {
    assertOwnerOrAssign(reply, ownerId);
  } catch {
    throw new Error("Unauthorized or reply not found");
  }
  const createdAt = reply.createdAt || inferTimestampFromId(reply.replyId) || Date.now();
  comment.replies![rIdx] = normalizeReply(
    stampReplyEdit({
      ...reply,
      note,
      requester,
      createdAt,
      time: formatCommentTimestamp(createdAt),
    })
  );
  reqData.comments[idx] = comment as SongRequest["comments"][0];
  await kvSet(key, stamp(normalizeRequest(reqData)));
  return normalizeRequest(reqData);
}

export async function deleteReplyFromDb(
  trackId: number,
  commentId: string,
  replyId: string,
  ownerId: string
) {
  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");
  const comment = normalizeComment(reqData.comments[idx] as Comment);
  const before = (comment.replies || []).length;
  comment.replies = (comment.replies || []).filter(
    (r) => !(r.replyId === replyId && r.ownerId === ownerId)
  );
  if (comment.replies.length === before) {
    throw new Error("Unauthorized or reply not found");
  }
  reqData.comments[idx] = comment as SongRequest["comments"][0];
  await kvSet(key, stamp(normalizeRequest(reqData)));
  return normalizeRequest(reqData);
}

export async function updateCommentInDb(
  trackId: number,
  commentId: string,
  ownerId: string,
  patch: { note: string; requester: string }
) {
  const note = patch.note.trim();
  const requester = patch.requester.trim() || "匿名";
  if (!note) throw new Error("留言内容不能为空");
  if (note.length > 500) throw new Error("留言过长");

  const { key, reqData } = await loadTrack(trackId);
  const idx = reqData.comments.findIndex((c) => c.commentId === commentId);
  if (idx < 0) throw new Error("Comment not found");
  const comment = normalizeComment(reqData.comments[idx] as Comment);
  try {
    assertOwnerOrAssign(comment, ownerId);
  } catch {
    throw new Error("Unauthorized or comment not found");
  }
  const wasVote = comment.isVote === true || isVoteComment(comment);
  const edited = stampCommentEdit({
    ...comment,
    note,
    requester,
    isVote: wasVote ? note === VOTE_NOTE : false,
  });
  reqData.comments[idx] = edited as SongRequest["comments"][0];
  await kvSet(key, stamp(normalizeRequest(reqData)));
  return normalizeRequest(reqData);
}

export async function deleteCommentFromDb(
  trackId: number,
  commentId: string,
  ownerId: string
) {
  const key = `req:${trackId}`;
  const reqData = (await kvGet(key)) as SongRequest | null;
  if (!reqData?.comments) throw new Error("Not found");
  const originalLen = reqData.comments.length;
  reqData.comments = reqData.comments.filter(
    (c) => !(c.commentId === commentId && c.ownerId === ownerId)
  );
  if (reqData.comments.length === originalLen) {
    throw new Error("Unauthorized or comment not found");
  }
  reqData.votes = reqData.comments.length;
  if (reqData.votes === 0) {
    await kvDel(key);
    return { deleted: true as const };
  }
  await kvSet(key, stamp(normalizeRequest(reqData)));
  return { deleted: false as const, data: normalizeRequest(reqData) };
}

export async function upsertTrackComment(body: {
  id: number;
  song: string;
  artist?: string;
  artwork?: string;
  previewUrl?: string;
  comments: Comment[];
}) {
  const key = `req:${body.id}`;
  let existing = (await kvGet(key)) as SongRequest | null;

  if (existing) {
    existing.comments = existing.comments || [];
    if (body.comments.length > 0) {
      const incoming = body.comments[0];
      const ownerId = incoming.ownerId;
      if (ownerId) {
        const sameOwner = existing.comments.filter((c) => c.ownerId === ownerId);
        if (sameOwner.length > 0) {
          if (incoming.isVote) {
            throw new Error("你已推荐或留言过这首歌，不能再投票");
          }
          throw new Error("一个设备不能反复给一首歌评论或投票");
        }
      }
      existing.comments = [...body.comments, ...existing.comments];
    }
    existing.comments = existing.comments.map((c) => normalizeComment(c as Comment)) as SongRequest["comments"];
    existing.votes = existing.comments.length;
    await kvSet(key, stamp(normalizeRequest(existing)));
    return normalizeRequest(existing);
  }

  const reqData = normalizeRequest({
    ...body,
    createdAt: Date.now(),
    votes: body.comments.length,
  } as SongRequest);
  await kvSet(key, stamp(reqData));
  return reqData;
}
