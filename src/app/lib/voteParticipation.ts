import { VOTE_NOTE, VOTE_REQUESTER } from "../copy/voteCopy";
import { inferTimestampFromId } from "./commentTime";
import type { Comment } from "../types/songRequest";

/** 是否为「纯投票」留言（可单独取消投票） */
export function isVoteComment(c: Comment): boolean {
  if (c.isVote === true) return true;
  if (c.isVote === false) return false;
  return c.note === VOTE_NOTE && c.requester === VOTE_REQUESTER;
}

export function getMyCommentsOnTrack(
  comments: Comment[] | undefined,
  ownerId: string
): Comment[] {
  return (comments || []).filter((c) => c.ownerId === ownerId);
}

/** 点歌 / 留言 / 投票 任一即视为已参与，不可再投第二票 */
export function hasParticipatedOnTrack(
  comments: Comment[] | undefined,
  ownerId: string
): boolean {
  return getMyCommentsOnTrack(comments, ownerId).length > 0;
}

export function findMyVoteComment(
  comments: Comment[] | undefined,
  ownerId: string
): Comment | undefined {
  return getMyCommentsOnTrack(comments, ownerId).find(isVoteComment);
}

function commentSortKey(c: Comment): number {
  if (typeof c.createdAt === "number" && c.createdAt > 0) return c.createdAt;
  return inferTimestampFromId(c.commentId) ?? 0;
}

/**
 * 同一设备对一首歌只能保留一条参与记录。
 * 优先保留非投票留言；若均为投票则保留最早一条。
 */
export function dedupeOwnerComments(comments: Comment[]): Comment[] {
  const withoutOwner = comments.filter((c) => !c.ownerId);
  const byOwner = new Map<string, Comment[]>();

  for (const c of comments) {
    if (!c.ownerId) continue;
    const list = byOwner.get(c.ownerId) || [];
    list.push(c);
    byOwner.set(c.ownerId, list);
  }

  const kept: Comment[] = [...withoutOwner];

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
