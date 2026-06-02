import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import type { Comment, SongRequest } from "../types/songRequest";
import {
  addReplyToDb,
  deleteCommentFromDb,
  deleteReplyFromDb,
  listRequestsFromDb,
  toggleCommentLike,
  toggleReplyLike,
  upsertTrackComment,
} from "./requestsStore";

export const SUPABASE_REQUESTS = `https://${projectId}.supabase.co/functions/v1/make-server-2914ec93/requests`;

/** Prefer direct Supabase DB (realtime + reliable writes). Falls back to Edge Function if RLS blocks. */
export const requestsApiBase = SUPABASE_REQUESTS;

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

async function listViaEdge(): Promise<SongRequest[]> {
  const res = await fetch(SUPABASE_REQUESTS, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({}));
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

async function postViaEdge(body: Record<string, unknown>) {
  const res = await fetch(SUPABASE_REQUESTS, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function deleteCommentViaApi(
  trackId: number,
  commentId: string,
  ownerId: string
) {
  try {
    const result = await deleteCommentFromDb(trackId, commentId, ownerId);
    if (result.deleted) return { success: true, deleted: true };
    return { success: true, data: result.data };
  } catch {
    const res = await fetch(`${SUPABASE_REQUESTS}/${trackId}/comments/${commentId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
      body: JSON.stringify({ ownerId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || "delete failed");
    }
    return data;
  }
}

export async function postRequestsBody(body: Record<string, unknown>) {
  const action = body.action as string | undefined;

  if (!action) {
    return postViaEdge(body);
  }

  try {
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
      const data = await deleteReplyFromDb(
        body.id as number,
        body.commentId as string,
        body.replyId as string,
        body.ownerId as string
      );
      return { success: true, data };
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
    throw new Error("Unknown action");
  } catch (directErr) {
    const msg = directErr instanceof Error ? directErr.message : String(directErr);
    if (msg.includes("row-level security") || msg.includes("数据库未开放")) {
      throw new Error(
        `${msg} — 请在 Supabase SQL Editor 执行 supabase/migrations/20260602120000_kv_store_anon_policies.sql 后刷新页面`
      );
    }
    throw new Error(msg);
  }
}
