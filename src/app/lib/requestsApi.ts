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
  updateReplyInDb,
  upsertTrackComment,
} from "./requestsStore";

export const SUPABASE_REQUESTS = `https://${projectId}.supabase.co/functions/v1/make-server-2914ec93/requests`;

const WRITE_PATH_KEY = "void_echo_write_path";
type WritePath = "vercel" | "db" | "edge";

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

function vercelApiBase(): string | null {
  if (typeof window === "undefined") return null;
  return `${window.location.origin}/api/requests`;
}

function preferVercelApi(): boolean {
  return import.meta.env.PROD || import.meta.env.VITE_USE_VERCEL_API === "true";
}

function getCachedWritePath(): WritePath | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(WRITE_PATH_KEY);
  return v === "vercel" || v === "db" || v === "edge" ? v : null;
}

function cacheWritePath(path: WritePath) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(WRITE_PATH_KEY, path);
}

function writePathOrder(): WritePath[] {
  const cached = getCachedWritePath();
  const envPath = import.meta.env.VITE_WRITE_PATH as WritePath | undefined;
  const all: WritePath[] = preferVercelApi()
    ? ["vercel", "db", "edge"]
    : envPath && ["vercel", "db", "edge"].includes(envPath)
      ? [envPath, ...(["edge", "db"] as WritePath[]).filter((p) => p !== envPath)]
      : ["edge", "db"];
  if (!cached) return all;
  return [cached, ...all.filter((p) => p !== cached)];
}

const WRITE_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

async function listViaVercel(): Promise<SongRequest[]> {
  const base = vercelApiBase();
  if (!base) throw new Error("No Vercel API");
  const res = await fetch(base, { headers: getAuthHeaders() });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Vercel API ${res.status}`);
  }
  const list = (data.data as SongRequest[]) || [];
  return list.filter((r) => r?.song && Array.isArray(r.comments) && r.comments.length > 0);
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
  const order: Array<"vercel" | "db" | "edge"> = preferVercelApi()
    ? ["vercel", "db", "edge"]
    : ["db", "edge"];

  for (const path of order) {
    try {
      if (path === "vercel") return await listViaVercel();
      if (path === "db") {
        const fromDb = await listRequestsFromDb();
        if (fromDb.length > 0) return fromDb;
        continue;
      }
      return await listViaEdge();
    } catch (err) {
      console.warn(`fetchAllRequests via ${path} failed:`, err);
    }
  }
  return [];
}

async function persistViaVercel(body: Record<string, unknown>) {
  const base = vercelApiBase();
  if (!base) throw new Error("No Vercel API");

  const action = body.action as string | undefined;
  const id = body.id;
  const commentId = body.commentId;
  const ownerId = body.ownerId;

  let url = base;
  let method = "POST";
  let payload: Record<string, unknown> = body;

  if (action === "addReply") {
    url = `${base}/${id}/comments/${commentId}/replies`;
    payload = { reply: body.reply };
  } else if (action === "toggleCommentLike") {
    url = `${base}/${id}/comments/${commentId}/like`;
    payload = { ownerId };
  } else if (action === "toggleReplyLike") {
    url = `${base}/${id}/comments/${commentId}/replies/${body.replyId}/like`;
    payload = { ownerId };
  } else if (action === "deleteReply") {
    method = "DELETE";
    url = `${base}/${id}/comments/${commentId}/replies/${body.replyId}`;
    payload = { ownerId };
  } else if (action === "deleteComment") {
    method = "DELETE";
    url = `${base}/${id}/comments/${commentId}`;
    payload = { ownerId };
  }

  const res = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Vercel API failed (${res.status})`);
  }
  return data;
}

/** 浏览器直连 kv_store（需 SQL 策略） */
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
  if (action === "editReply") {
    const data = await updateReplyInDb(
      body.id as number,
      body.commentId as string,
      body.replyId as string,
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

/** Edge Function 备用 */
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

  const res = await fetch(SUPABASE_REQUESTS, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Edge ${action} failed (${res.status})`);
  }
  return data;
}

async function persistByPath(path: WritePath, body: Record<string, unknown>) {
  if (path === "vercel") return persistViaVercel(body);
  if (path === "db") return persistToDatabase(body);
  return persistViaEdge(body);
}

/**
 * 写入：记住上次成功的通道，避免每次先等失败的直连再回退 Edge。
 * 线上优先 Vercel /api（Service Role，最快）。
 */
export async function postRequestsBody(body: Record<string, unknown>) {
  const errors: string[] = [];

  for (const path of writePathOrder()) {
    try {
      const result = await withTimeout(persistByPath(path, body), WRITE_TIMEOUT_MS);
      cacheWritePath(path);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${path}: ${msg}`);
      if (
        path === "db" &&
        (msg.includes("row-level security") ||
          msg.includes("数据库未开放") ||
          msg.includes("permission denied") ||
          msg.includes("JWT"))
      ) {
        cacheWritePath("edge");
      }
    }
  }

  const combined = errors.join(" | ");
  if (combined.includes("row-level security") || combined.includes("数据库未开放")) {
    throw new Error(`${combined}。${SETUP_HINT}`);
  }
  if (body.action) {
    throw new Error(`操作失败。${SETUP_HINT}。${combined}`);
  }
  throw new Error(combined || "保存失败");
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

export async function editReplyViaApi(
  trackId: number,
  commentId: string,
  replyId: string,
  ownerId: string,
  patch: { note: string; requester: string }
) {
  return postRequestsBody({
    action: "editReply",
    id: trackId,
    commentId,
    replyId,
    ownerId,
    note: patch.note,
    requester: patch.requester,
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
