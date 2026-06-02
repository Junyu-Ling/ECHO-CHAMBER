import { format } from "date-fns";
import type { Comment, Reply } from "../types/songRequest";

/** 从 commentId / replyId 前缀解析毫秒时间（旧数据兼容） */
export function inferTimestampFromId(id: string): number | undefined {
  const m = /^(\d{10,13})/.exec(id);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 1e12 ? n * 1000 : n;
}

export function formatCommentTimestamp(ms: number): string {
  return format(ms, "yyyy-MM-dd HH:mm");
}

export function resolveCommentCreatedAt(c: Pick<Comment, "createdAt" | "commentId">): number {
  if (typeof c.createdAt === "number" && c.createdAt > 0) return c.createdAt;
  return inferTimestampFromId(c.commentId) ?? 0;
}

export function resolveReplyCreatedAt(r: Pick<Reply, "createdAt" | "replyId">): number {
  if (typeof r.createdAt === "number" && r.createdAt > 0) return r.createdAt;
  return inferTimestampFromId(r.replyId) ?? 0;
}

export function formatCommentTime(c: Comment): string {
  const ms = resolveCommentCreatedAt(c);
  if (ms > 0) return formatCommentTimestamp(ms);
  return c.time || "";
}

export function formatReplyTime(r: Reply): string {
  const ms = resolveReplyCreatedAt(r);
  if (ms > 0) return formatCommentTimestamp(ms);
  return r.time || "";
}

export function stampCommentFields<T extends Partial<Comment>>(fields: T): T & { createdAt: number; time: string } {
  const createdAt = Date.now();
  return {
    ...fields,
    createdAt,
    time: formatCommentTimestamp(createdAt),
  };
}

export function stampReplyFields<T extends Partial<Reply>>(fields: T): T & { createdAt: number; time: string } {
  const createdAt = Date.now();
  return {
    ...fields,
    createdAt,
    time: formatCommentTimestamp(createdAt),
  };
}
