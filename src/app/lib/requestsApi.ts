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
  return data.data as SongRequest[];
}

export async function fetchAllRequests(): Promise<SongRequest[]> {
  try {
    return await listRequestsFromDb();
  } catch (err) {
    console.warn("Direct DB list failed, falling back to edge:", err);
    return listViaEdge();
  }
}

export async function postRequestsBody(body: Record<string, unknown>) {
  const action = body.action as string | undefined;

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
    if (!action) {
      const data = await upsertTrackComment(body as Parameters<typeof upsertTrackComment>[0]);
      return { success: true, data };
    }
    throw new Error("Unknown action");
  } catch (directErr) {
    const msg = directErr instanceof Error ? directErr.message : String(directErr);
    throw new Error(msg);
  }
}
