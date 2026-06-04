import { resolveCommentCreatedAt, resolveReplyCreatedAt } from "./commentTime";
import { normalizeRequest } from "./requestsStore";
import { dedupeOwnerComments } from "./voteParticipation";
import type { Comment, Reply, SongRequest } from "../types/songRequest";

function trackTimestamp(req: SongRequest) {
  return req.updatedAt ?? req.createdAt ?? 0;
}

function commentRevision(c: Comment) {
  return c.updatedAt ?? resolveCommentCreatedAt(c);
}

function replyRevision(r: Reply) {
  return r.updatedAt ?? resolveReplyCreatedAt(r);
}

function mergeReplies(local: Reply[], remote: Reply[]): Reply[] {
  const ids = new Set([
    ...local.map((r) => r.replyId),
    ...remote.map((r) => r.replyId),
  ]);
  const merged: Reply[] = [];

  for (const id of ids) {
    const l = local.find((r) => r.replyId === id);
    const r = remote.find((reply) => reply.replyId === id);
    if (!l) merged.push(r!);
    else if (!r) merged.push(l);
    else merged.push(replyRevision(l) >= replyRevision(r) ? { ...l } : { ...r });
  }

  return merged.sort((a, b) => replyRevision(b) - replyRevision(a));
}

function mergeComments(local: Comment[], remote: Comment[]): Comment[] {
  const ids = new Set([
    ...local.map((c) => c.commentId),
    ...remote.map((c) => c.commentId),
  ]);
  const merged: Comment[] = [];

  for (const id of ids) {
    const l = local.find((c) => c.commentId === id);
    const r = remote.find((c) => c.commentId === id);
    if (!l) merged.push(r!);
    else if (!r) merged.push(l);
    else {
      const useLocal = commentRevision(l) >= commentRevision(r);
      const primary = useLocal ? { ...l } : { ...r };
      primary.replies = mergeReplies(l.replies || [], r.replies || []);
      merged.push(primary);
    }
  }

  return dedupeOwnerComments(
    merged.sort((a, b) => commentRevision(b) - commentRevision(a))
  );
}

/** Merge local optimistic state with remote KV/realtime payload without losing fresh edits. */
export function mergeTrack(local: SongRequest, remote: SongRequest): SongRequest {
  const localNorm = normalizeRequest(local);
  const remoteNorm = normalizeRequest(remote);
  const remoteNewer = trackTimestamp(remoteNorm) >= trackTimestamp(localNorm);
  const base = remoteNewer ? remoteNorm : localNorm;
  const comments = mergeComments(localNorm.comments, remoteNorm.comments);

  return normalizeRequest({
    ...base,
    comments,
    updatedAt: Math.max(trackTimestamp(localNorm), trackTimestamp(remoteNorm)),
  });
}

export function mergeRequestsList(prev: SongRequest[], incoming: SongRequest[]) {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const incomingIds = new Set<number>();

  const merged = incoming.map((remote) => {
    const normalized = normalizeRequest(remote);
    incomingIds.add(normalized.id);
    const local = prevById.get(normalized.id);
    if (!local) return normalized;
    return mergeTrack(local, normalized);
  });

  const localOnly = prev.filter((r) => !incomingIds.has(r.id));
  return [...localOnly, ...merged];
}

export function applyTrackFromRemote(prev: SongRequest[], remote: SongRequest) {
  const normalized = normalizeRequest(remote);
  const idx = prev.findIndex((r) => r.id === normalized.id);
  if (idx < 0) {
    if (!normalized.comments?.length) return prev;
    return [normalized, ...prev];
  }
  if (!normalized.comments?.length) {
    return prev.filter((r) => r.id !== normalized.id);
  }
  const next = [...prev];
  next[idx] = mergeTrack(prev[idx], normalized);
  return next;
}
