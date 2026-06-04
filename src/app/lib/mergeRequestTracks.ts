import { resolveReplyCreatedAt } from "./commentTime";
import { normalizeRequest } from "./requestsStore";
import { commentRevision, dedupeOwnerComments } from "./voteParticipation";
import type { Comment, Reply, SongRequest } from "../types/songRequest";

export type PendingCommentEdit = {
  note: string;
  requester: string;
  updatedAt: number;
};

export type PendingEditsMap = Map<string, PendingCommentEdit>;

function pendingKey(trackId: number, commentId: string) {
  return `${trackId}:${commentId}`;
}

function replyRevision(r: Reply) {
  return r.updatedAt ?? resolveReplyCreatedAt(r);
}

function trackTimestamp(req: SongRequest) {
  return req.updatedAt ?? req.createdAt ?? 0;
}

/** Force in-flight edits over merged remote rows until server confirms. */
export function applyPendingCommentEdits(
  track: SongRequest,
  pending?: PendingEditsMap
): SongRequest {
  if (!pending?.size) return track;
  let changed = false;
  const comments = track.comments.map((c) => {
    const p = pending.get(pendingKey(track.id, c.commentId));
    if (!p) return c;
    changed = true;
    return {
      ...c,
      note: p.note,
      requester: p.requester,
      updatedAt: Math.max(p.updatedAt, c.updatedAt ?? 0),
    };
  });
  return changed ? { ...track, comments } : track;
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

  return merged.sort((a, b) => commentRevision(b) - commentRevision(a));
}

/** Merge local optimistic state with remote KV/realtime payload without losing fresh edits. */
export function mergeTrack(
  local: SongRequest,
  remote: SongRequest,
  pending?: PendingEditsMap
): SongRequest {
  const localNorm = normalizeRequest(local);
  const remoteNorm = normalizeRequest(remote);
  const remoteNewer = trackTimestamp(remoteNorm) >= trackTimestamp(localNorm);
  const base = remoteNewer ? remoteNorm : localNorm;
  const comments = mergeComments(localNorm.comments, remoteNorm.comments);

  const merged = normalizeRequest({
    ...base,
    comments,
    updatedAt: Math.max(trackTimestamp(localNorm), trackTimestamp(remoteNorm)),
  });

  return applyPendingCommentEdits(merged, pending);
}

export function mergeRequestsList(
  prev: SongRequest[],
  incoming: SongRequest[],
  pending?: PendingEditsMap
) {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const incomingIds = new Set<number>();

  const merged = incoming.map((remote) => {
    const normalized = normalizeRequest(remote);
    incomingIds.add(normalized.id);
    const local = prevById.get(normalized.id);
    if (!local) return applyPendingCommentEdits(normalized, pending);
    return mergeTrack(local, normalized, pending);
  });

  const localOnly = prev
    .filter((r) => !incomingIds.has(r.id))
    .map((r) => applyPendingCommentEdits(r, pending));
  return [...localOnly, ...merged];
}

export function applyTrackFromRemote(
  prev: SongRequest[],
  remote: SongRequest,
  pending?: PendingEditsMap
) {
  const normalized = normalizeRequest(remote);
  const idx = prev.findIndex((r) => r.id === normalized.id);
  if (idx < 0) {
    if (!normalized.comments?.length) return prev;
    return [applyPendingCommentEdits(normalized, pending), ...prev];
  }
  if (!normalized.comments?.length) {
    return prev.filter((r) => r.id !== normalized.id);
  }
  const next = [...prev];
  next[idx] = mergeTrack(prev[idx], normalized, pending);
  return next;
}

export function serverCommentMatchesEdit(
  track: SongRequest,
  commentId: string,
  expected: { note: string; requester: string }
) {
  const c = track.comments.find((row) => row.commentId === commentId);
  if (!c) return false;
  return c.note === expected.note && c.requester === expected.requester;
}
