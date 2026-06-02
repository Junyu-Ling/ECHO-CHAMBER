import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import type { Comment, SongRequest } from "../types/songRequest";
import {
  addReplyToDb,
  deleteCommentFromDb,
  deleteReplyFromDb,
  listRequestsFromDb,
  toggleCommentLike,
  toggleReplyLike,
  updateCommentInDb,
  upsertTrackComment,
} from "./requestsStore";

export const SUPABASE_REQUESTS = `https://${projectId}.supabase.co/functions/v1/make-server-2914ec93/requests`;

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (publicAnonKey) {
    headers.Authorization = `Bearer ${publicAnonKey}`;
    headers.apikey = publicAnonKey;
  }
  return headers;
}

const SETUP_HINT =
  "请二选一：① Supabase SQL Editor 执行 pnpm db:kv-policies 里的 SQL；② 终端执行 supabase login 后 pnpm deploy:edge";

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

async function listViaEdge(): Promise<SongRequest[]> {
  const res = await fetch(SUPABASE_REQUESTS, { headers: getAuthHeaders() });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  const list = (data.data as SongRequest[]) || [];
  return list.filter((r) => r?.song && Array.isArray(r.comments) && r.comments.length > 0);
}

export async function fetchAllRequests(): Promise<SongRequest[]> {
  try {
    const fromDb = await listRequestsFromDb();
    if (fromDb.length > 0) return fromDb;
  } catch (err) {
    console.warn("Direct DB list failed:", err);
  }
  return listViaEdge();
}

/** 统一：先写 Supabase 数据库（与 Realtime 同源） */
async function persistToDatabase(body: Record<string, unknown>) {
  const action = body.action as string | undefined;

  if (!action) {
    const data = await upsertTrackComment(
      body as Parameters<typeof upsertTrackComment>[0]
    );
    return { success: true, data };
  }

  if (action === "toggleCommentLike") {
    const data = await toggleCommentLike(
      body.id as number,
      body.commentId as string,
      body.ownerId as string
    );
    return { success: true, data };
  }
  if (action === "toggleReplyLike") {
    const data = await toggleReplyLike(
      body.id as number,
      body.commentId as string,
      body.replyId as string,
      body.ownerId as string
    );
    return { success: true, data };
  }
  if (action === "addReply") {
    const data = await addReplyToDb(
      body.id as number,
      body.commentId as string,
      body.reply as Comment
    );
    return { success: true, data };
  }
  if (action === "deleteReply") {
    const result = await deleteReplyFromDb(
      body.id as number,
      body.commentId as string,
      body.replyId as string,
      body.ownerId as string
    );
    if (result.deleted) return { success: true, deleted: true };
    return { success: true, data: result.data };
  }
  if (action === "deleteComment") {
    const result = await deleteCommentFromDb(
      body.id as number,
      body.commentId as string,
      body.ownerId as string
    );
    if (result.deleted) return { success: true, deleted: true };
    return { success: true, data: result.data };
  }
  if (action === "editComment") {
    const data = await updateCommentInDb(
      body.id as number,
      body.commentId as string,
      body.ownerId as string,
      {
        note: body.note as string,
        requester: body.requester as string,
      }
    );
    return { success: true, data };
  }

  throw new Error("Unknown action");
}

/** 备用：旧版 Edge API（未执行 SQL 时，仅投票/留言可走这条） */
async function persistViaEdge(body: Record<string, unknown>) {
  const action = body.action as string | undefined;

  if (!action) {
    const res = await fetch(SUPABASE_REQUESTS, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  const id = body.id;
  const commentId = body.commentId;
  const ownerId = body.ownerId;

  let url = SUPABASE_REQUESTS;
  let method = "POST";
  let payload: Record<string, unknown> = { ownerId };

  if (action === "addReply") {
    url = `${SUPABASE_REQUESTS}/${id}/comments/${commentId}/replies`;
    payload = { reply: body.reply };
  } else if (action === "toggleCommentLike") {
    url = `${SUPABASE_REQUESTS}/${id}/comments/${commentId}/like`;
  } else if (action === "toggleReplyLike") {
    url = `${SUPABASE_REQUESTS}/${id}/comments/${commentId}/replies/${body.replyId}/like`;
  } else if (action === "deleteReply") {
    method = "DELETE";
    url = `${SUPABASE_REQUESTS}/${id}/comments/${commentId}/replies/${body.replyId}`;
  } else if (action === "deleteComment") {
    method = "DELETE";
    url = `${SUPABASE_REQUESTS}/${id}/comments/${commentId}`;
  } else if (action === "editComment") {
    payload = {
      action: "editComment",
      id,
      commentId,
      ownerId,
      note: body.note,
      requester: body.requester,
    };
  } else {
    throw new Error("Unknown action");
  }

  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Edge ${action} failed (${res.status})`);
  }
  return data;
}

/**
 * 投票 / 点赞 / 回复 / 删除 —— 同一套逻辑：
 * 1. 优先写入 kv_store（需 SQL 策略，执行一次即可）
 * 2. 失败则回退 Edge（点赞回复需 deploy:edge 更新函数后才可用）
 */
export async function postRequestsBody(body: Record<string, unknown>) {
  try {
    return await persistToDatabase(body);
  } catch (dbErr) {
    const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    try {
      return await persistViaEdge(body);
    } catch {
      if (dbMsg.includes("row-level security") || dbMsg.includes("数据库未开放")) {
        throw new Error(`${dbMsg}。${SETUP_HINT}`);
      }
      if (body.action) {
        throw new Error(
          `点赞/回复需要更新 Edge 或执行 SQL。${SETUP_HINT}。原始错误：${dbMsg}`
        );
      }
      throw new Error(dbMsg);
    }
  }
}

export async function deleteCommentViaApi(
  trackId: number,
  commentId: string,
  ownerId: string
) {
  return postRequestsBody({
    action: "deleteComment",
    id: trackId,
    commentId,
    ownerId,
  });
}

export async function editCommentViaApi(
  trackId: number,
  commentId: string,
  ownerId: string,
  patch: { note: string; requester: string }
) {
  return postRequestsBody({
    action: "editComment",
    id: trackId,
    commentId,
    ownerId,
    note: patch.note,
    requester: patch.requester,
  });
}
