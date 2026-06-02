import { useState, useRef, useEffect } from "react";
import { Music, ChevronUp, Clock, Flame, Send, Play, Pause, Square, Loader2, Trash2, Reply as ReplyIcon, Heart, Pencil } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { MusicSearchInput, TrackResult } from "./MusicSearchInput";
import { supabase } from "../supabaseClient";
import { deleteCommentViaApi, editCommentViaApi, fetchAllRequests, postRequestsBody } from "../lib/requestsApi";
import { normalizeRequest } from "../lib/requestsStore";
import type { Comment, Reply, SongRequest } from "../types/songRequest";
import {
  VOTE_NOTE,
  VOTE_REQUESTER,
  VOTE_ADD_TITLE,
  VOTE_ALREADY_PARTICIPATED,
  VOTE_CANCEL_TITLE,
  VOTE_PARTICIPATED_TITLE,
} from "../copy/voteCopy";
import {
  findMyVoteComment,
  hasParticipatedOnTrack,
  isVoteComment,
} from "../lib/voteParticipation";
import {
  REPLY_BTN,
  REPLY_CANCEL,
  REPLY_DEFAULT_NAME,
  REPLY_DELETE_CONFIRM,
  REPLY_DELETE_TITLE,
  REPLY_EMPTY_ALERT,
  REPLY_NAME_PLACEHOLDER,
  REPLY_PLACEHOLDER,
  REPLY_SUBMIT,
} from "../copy/replyCopy";
import { LIKE_BTN, LIKE_TITLE, UNLIKE_TITLE } from "../copy/likeCopy";
import {
  formatCommentTime,
  formatReplyTime,
  resolveCommentCreatedAt,
  resolveReplyCreatedAt,
  stampCommentFields,
  stampReplyFields,
} from "../lib/commentTime";
import { stopPreviewIf, subscribePreview, togglePreview } from "../lib/previewAudio";
import {
  COMMENT_EDIT_BTN,
  COMMENT_EDIT_CANCEL,
  COMMENT_EDIT_EMPTY_NOTE,
  COMMENT_EDIT_NAME_PLACEHOLDER,
  COMMENT_EDIT_NOTE_PLACEHOLDER,
  COMMENT_EDIT_SAVE,
  COMMENT_EDIT_TOO_LONG,
} from "../copy/commentEditCopy";

// requestsApiBase + getAuthHeaders from ../lib/requestsApi

// 获取唯一的设备ID用于判断"自己的"点歌
const getClientId = () => {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("void_echo_client_id");
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("void_echo_client_id", id);
  }
  return id;
};

function toggleLikedByList(likedBy: string[] | undefined, ownerId: string) {
  const list = [...(likedBy || [])];
  const idx = list.indexOf(ownerId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(ownerId);
  return list;
}

function isLikedBy(likedBy: string[] | undefined, ownerId: string) {
  return (likedBy || []).includes(ownerId);
}

function normalizeRequestsList(list: SongRequest[]) {
  return list.map(normalizeRequest);
}

function getTrackTimestamp(req: SongRequest) {
  return req.updatedAt ?? req.createdAt ?? 0;
}

/** Prefer newer server data; keep optimistic new tracks until server list includes them. */
function mergeRequestsList(prev: SongRequest[], incoming: SongRequest[]) {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const incomingIds = new Set<number>();

  const merged = incoming.map((remote) => {
    const normalized = normalizeRequest(remote);
    incomingIds.add(normalized.id);
    const local = prevById.get(normalized.id);
    if (!local) return normalized;
    return getTrackTimestamp(normalized) >= getTrackTimestamp(local)
      ? normalized
      : local;
  });

  const localOnly = prev.filter((r) => !incomingIds.has(r.id));
  return [...localOnly, ...merged];
}

function applyTrackFromRemote(prev: SongRequest[], remote: SongRequest) {
  const normalized = normalizeRequest(remote);
  const idx = prev.findIndex((r) => r.id === normalized.id);
  if (idx < 0) {
    if (!normalized.comments?.length) return prev;
    return [normalized, ...prev];
  }
  if (getTrackTimestamp(normalized) < getTrackTimestamp(prev[idx])) {
    return prev;
  }
  if (!normalized.comments?.length) {
    return prev.filter((r) => r.id !== normalized.id);
  }
  const next = [...prev];
  next[idx] = normalized;
  return next;
}

function collectParticipatedIds(list: SongRequest[], clientId: string) {
  const ids = new Set<number>();
  for (const r of list) {
    if (hasParticipatedOnTrack(r.comments, clientId)) ids.add(r.id);
  }
  return ids;
}

type SortMode = "hot" | "new";

export function SongRequestSection() {
  const [clientId] = useState(getClientId);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [searchValue, setSearchValue] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<TrackResult | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [localVotedIds, setLocalVotedIds] = useState<Set<number>>(new Set());
  const [votingIds, setVotingIds] = useState<Set<number>>(new Set());
  const [replyingKey, setReplyingKey] = useState<string | null>(null);
  const [submittingReplyKey, setSubmittingReplyKey] = useState<string | null>(null);
  const [likingKeys, setLikingKeys] = useState<Set<string>>(new Set());
  const [editingCommentKey, setEditingCommentKey] = useState<string | null>(null);
  const [savingCommentKey, setSavingCommentKey] = useState<string | null>(null);

  const fetchGenerationRef = useRef(0);
  const mutatingCountRef = useRef(0);

  const beginMutation = () => {
    mutatingCountRef.current += 1;
  };
  const endMutation = () => {
    mutatingCountRef.current = Math.max(0, mutatingCountRef.current - 1);
  };

  // 初始化从localStorage读取已投票记录
  useEffect(() => {
    try {
      const stored = localStorage.getItem("void_echo_voted_ids");
      if (stored) {
        setLocalVotedIds(new Set(JSON.parse(stored)));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!clientId) return;
    setLocalVotedIds(collectParticipatedIds(requests, clientId));
  }, [requests, clientId]);

  useEffect(() => {
    localStorage.setItem("void_echo_voted_ids", JSON.stringify(Array.from(localVotedIds)));
  }, [localVotedIds]);

  useEffect(() => {
    let cancelled = false;

    const fetchInitial = async () => {
      const gen = ++fetchGenerationRef.current;
      try {
        const list = await fetchAllRequests();
        if (cancelled || gen !== fetchGenerationRef.current) return;
        setRequests((prev) => mergeRequestsList(prev, normalizeRequestsList(list)));
      } catch (err) {
        console.error("Network or parsing error fetching requests:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchInitial();

    const channel = supabase
      .channel("kv-changes-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kv_store_2914ec93" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const key = payload.new.key as string;
            if (!key?.startsWith("req:")) return;

            let newReq = payload.new.value;
            if (newReq && !newReq.comments) {
              newReq = {
                ...newReq,
                comments:
                  newReq.note || newReq.requester
                    ? [
                        {
                          commentId: newReq.id?.toString() || Date.now().toString(),
                          note: newReq.note || "",
                          requester: newReq.requester || "匿名",
                          time: newReq.time || "刚刚",
                          ownerId: newReq.ownerId || "",
                        },
                      ]
                    : [],
                createdAt: newReq.createdAt || newReq.id,
              };
            }

            if (newReq) {
              setRequests((prev) =>
                applyTrackFromRemote(prev, newReq as SongRequest)
              );
            }
          } else if (payload.eventType === "DELETE") {
            const key = payload.old?.key as string;
            if (key?.startsWith("req:")) {
              const id = parseInt(key.replace("req:", ""), 10);
              if (!Number.isNaN(id)) {
                setRequests((prev) => prev.filter((r) => r.id !== id));
              }
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Realtime subscription error on kv_store_2914ec93");
        }
      });

    return () => {
      cancelled = true;
      fetchGenerationRef.current += 1;
      supabase.removeChannel(channel);
    };
  }, []);

  const sorted = [...requests].sort((a, b) =>
    sortMode === "hot" ? b.votes - a.votes : b.createdAt - a.createdAt
  );
  const maxVotes = sorted[0]?.votes ?? 1;

  const refetchRequests = async () => {
    const gen = ++fetchGenerationRef.current;
    try {
      const list = await fetchAllRequests();
      if (gen !== fetchGenerationRef.current) return;
      setRequests((prev) => mergeRequestsList(prev, normalizeRequestsList(list)));
    } catch {
      /* ignore */
    }
  };

  const postLikeAction = async (payload: {
    action: "toggleCommentLike" | "toggleReplyLike";
    id: number;
    commentId: string;
    replyId?: string;
  }) => {
    const data = await postRequestsBody({ ...payload, ownerId: clientId });
    return data.data as SongRequest;
  };

  const applyCommentRemoval = (trackId: number, commentId: string) => {
    setRequests((prev) =>
      prev
        .map((r) => {
          if (r.id !== trackId) return r;
          const newComments = r.comments.filter((c) => c.commentId !== commentId);
          return { ...r, comments: newComments, votes: newComments.length };
        })
        .filter((r) => r.votes > 0)
    );
  };

  const removeCommentOnServer = async (trackId: number, commentId: string) => {
    await deleteCommentViaApi(trackId, commentId, clientId);
  };

  const applyCommentTextUpdate = (
    trackId: number,
    commentId: string,
    patch: { note: string; requester: string }
  ) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== trackId) return r;
        return {
          ...r,
          updatedAt: Date.now(),
          comments: r.comments.map((c) =>
            c.commentId === commentId ? { ...c, ...patch } : c
          ),
        };
      })
    );
  };

  const handleEditComment = async (
    trackId: number,
    commentId: string,
    note: string,
    requester: string
  ) => {
    const trimmed = note.trim();
    const name = requester.trim() || REPLY_DEFAULT_NAME;
    if (!trimmed) {
      alert(COMMENT_EDIT_EMPTY_NOTE);
      return;
    }
    if (trimmed.length > 500) {
      alert(COMMENT_EDIT_TOO_LONG);
      return;
    }

    const saveKey = `${trackId}:${commentId}`;
    if (savingCommentKey === saveKey) return;

    const snapshot = requests;
    applyCommentTextUpdate(trackId, commentId, { note: trimmed, requester: name });
    setEditingCommentKey(null);
    setSavingCommentKey(saveKey);
    beginMutation();
    try {
      const data = await editCommentViaApi(trackId, commentId, clientId, {
        note: trimmed,
        requester: name,
      });
      if (data.data) mergeTrackFromServer(trackId, data.data as SongRequest);
    } catch (err) {
      console.error("Error editing comment:", err);
      setRequests(snapshot);
      const msg = err instanceof Error ? err.message : "";
      alert(msg || "保存失败，请稍后重试");
    } finally {
      setSavingCommentKey(null);
      endMutation();
    }
  };

  const handleDeleteComment = async (trackId: number, commentId: string) => {
    const req = requests.find((r) => r.id === trackId);
    const target = req?.comments.find((c) => c.commentId === commentId);
    if (!target) return;
    if (!window.confirm("确定要删除你的这条留言吗？")) return;

    const snapshot = requests;
    applyCommentRemoval(trackId, commentId);
    beginMutation();
    try {
      await removeCommentOnServer(trackId, commentId);
    } catch (err) {
      console.error("Error deleting comment:", err);
      setRequests(snapshot);
    } finally {
      endMutation();
    }
  };

  const mergeTrackFromServer = (trackId: number, data: SongRequest) => {
    const normalized = normalizeRequest(data);
    setRequests((prev) => prev.map((r) => (r.id === trackId ? normalized : r)));
  };

  const applyReplyUpdate = (trackId: number, commentId: string, updater: (replies: Reply[]) => Reply[]) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== trackId) return r;
        return {
          ...r,
          comments: r.comments.map((c) =>
            c.commentId === commentId
              ? { ...c, replies: updater(c.replies || []) }
              : c
          ),
        };
      })
    );
  };

  const handleAddReply = async (
    trackId: number,
    commentId: string,
    note: string,
    requester: string
  ) => {
    const trimmed = note.trim();
    if (!trimmed) {
      alert(REPLY_EMPTY_ALERT);
      return;
    }

    const replyKey = `${trackId}:${commentId}`;
    if (submittingReplyKey === replyKey) return;

    const newReply: Reply = stampReplyFields({
      replyId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      note: trimmed,
      requester: requester.trim() || REPLY_DEFAULT_NAME,
      ownerId: clientId,
      likedBy: [],
    });

    setSubmittingReplyKey(replyKey);
    applyReplyUpdate(trackId, commentId, (replies) => [...replies, newReply]);
    setReplyingKey(null);

    beginMutation();
    try {
      const data = await postRequestsBody({
        action: "addReply",
        id: trackId,
        commentId,
        reply: newReply,
      });
      if (data.data) {
        mergeTrackFromServer(trackId, data.data);
      }
    } catch (err) {
      console.error("Error adding reply:", err);
      applyReplyUpdate(trackId, commentId, (replies) =>
        replies.filter((r) => r.replyId !== newReply.replyId)
      );
    } finally {
      endMutation();
      setSubmittingReplyKey(null);
    }
  };

  const handleToggleCommentLike = async (trackId: number, commentId: string) => {
    const likeKey = `c:${trackId}:${commentId}`;
    if (likingKeys.has(likeKey)) return;

    const snapshot = requests;
    setLikingKeys((prev) => new Set(prev).add(likeKey));
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== trackId) return r;
        return {
          ...r,
          updatedAt: Date.now(),
          comments: r.comments.map((c) =>
            c.commentId === commentId
              ? { ...c, likedBy: toggleLikedByList(c.likedBy, clientId) }
              : c
          ),
        };
      })
    );

    beginMutation();
    try {
      const data = await postLikeAction({
        action: "toggleCommentLike",
        id: trackId,
        commentId,
      });
      mergeTrackFromServer(trackId, data);
    } catch (err) {
      console.error("Error toggling comment like:", err);
      setRequests(snapshot);
    } finally {
      endMutation();
      setLikingKeys((prev) => {
        const next = new Set(prev);
        next.delete(likeKey);
        return next;
      });
    }
  };

  const handleToggleReplyLike = async (
    trackId: number,
    commentId: string,
    replyId: string
  ) => {
    const likeKey = `r:${trackId}:${commentId}:${replyId}`;
    if (likingKeys.has(likeKey)) return;

    const snapshot = requests;
    setLikingKeys((prev) => new Set(prev).add(likeKey));
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== trackId) return r;
        return {
          ...r,
          updatedAt: Date.now(),
          comments: r.comments.map((c) => {
            if (c.commentId !== commentId) return c;
            return {
              ...c,
              replies: (c.replies || []).map((reply) =>
                reply.replyId === replyId
                  ? { ...reply, likedBy: toggleLikedByList(reply.likedBy, clientId) }
                  : reply
              ),
            };
          }),
        };
      })
    );

    beginMutation();
    try {
      const data = await postLikeAction({
        action: "toggleReplyLike",
        id: trackId,
        commentId,
        replyId,
      });
      mergeTrackFromServer(trackId, data);
    } catch (err) {
      console.error("Error toggling reply like:", err);
      setRequests(snapshot);
    } finally {
      endMutation();
      setLikingKeys((prev) => {
        const next = new Set(prev);
        next.delete(likeKey);
        return next;
      });
    }
  };

  const handleDeleteReply = async (trackId: number, commentId: string, replyId: string) => {
    if (!window.confirm(REPLY_DELETE_CONFIRM)) return;

    const req = requests.find((r) => r.id === trackId);
    const comment = req?.comments.find((c) => c.commentId === commentId);
    const removed = comment?.replies?.find((r) => r.replyId === replyId);
    if (!removed) return;

    applyReplyUpdate(trackId, commentId, (replies) =>
      replies.filter((r) => r.replyId !== replyId)
    );

    beginMutation();
    try {
      const data = await postRequestsBody({
        action: "deleteReply",
        id: trackId,
        commentId,
        replyId,
        ownerId: clientId,
      });
      if (data.data) {
        mergeTrackFromServer(trackId, data.data);
      }
    } catch (err) {
      console.error("Error deleting reply:", err);
      applyReplyUpdate(trackId, commentId, (replies) => [...replies, removed]);
    } finally {
      endMutation();
    }
  };

  const handleSelect = (track: TrackResult) => {
    setSelectedTrack(track);
    setSearchValue(`${track.trackName} — ${track.artistName}`);
  };

  const handleVote = async (id: number) => {
    if (votingIds.has(id)) return;
    const existingReq = requests.find((r) => r.id === id);
    if (!existingReq) return;

    const myVote = findMyVoteComment(existingReq.comments, clientId);
    const hasParticipated =
      localVotedIds.has(id) ||
      hasParticipatedOnTrack(existingReq.comments, clientId);

    setVotingIds((prev) => new Set(prev).add(id));
    beginMutation();

    try {
      if (hasParticipated && myVote) {
        const voteSnapshot = requests;
        applyCommentRemoval(id, myVote.commentId);
        try {
          await removeCommentOnServer(id, myVote.commentId);
        } catch (err) {
          console.error("Error canceling vote:", err);
          setRequests(voteSnapshot);
        }
        return;
      }

      if (hasParticipated) {
        alert(VOTE_ALREADY_PARTICIPATED);
        return;
      }

      const newComment: Comment = stampCommentFields({
        commentId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        note: VOTE_NOTE,
        requester: VOTE_REQUESTER,
        ownerId: clientId,
        isVote: true,
        replies: [],
        likedBy: [],
      });

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                updatedAt: Date.now(),
                votes: r.comments.length + 1,
                comments: [newComment, ...r.comments],
              }
            : r
        )
      );
      const data = await postRequestsBody({
        id,
        song: existingReq.song,
        artist: existingReq.artist,
        artwork: existingReq.artwork,
        previewUrl: existingReq.previewUrl,
        comments: [newComment],
      });
      if (data.data) {
        mergeTrackFromServer(id, data.data);
      }
    } catch (err) {
      console.error("Error voting:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("\u7559\u8a00")) alert(msg);
      await refetchRequests();
    } finally {
      endMutation();
      setVotingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrack) return;

    const trackId = selectedTrack.trackId;
    const existing = requests.find((r) => r.id === trackId);
    if (existing?.comments.some((c) => c.ownerId === clientId)) {
      alert("\u4f60\u5df2\u7ecf\u7559\u8a00\u8fc7\u8fd9\u9996\u6b4c\u4e86");
      return;
    }

    const noteTrim = noteInput.trim();
    const newComment: Comment = stampCommentFields({
      commentId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      note: noteTrim || VOTE_NOTE,
      requester: nameInput.trim() || VOTE_REQUESTER,
      ownerId: clientId,
      /** 仅点歌、无自定义留言文案时视为「推荐投票」 */
      isVote: !noteTrim,
      replies: [],
      likedBy: [],
    });

    const commentsToSubmit = [newComment];

    const payload = {
      id: trackId,
      song: selectedTrack.trackName,
      artist: selectedTrack.artistName,
      artwork: selectedTrack.artworkUrl100,
      previewUrl: selectedTrack.previewUrl,
      comments: commentsToSubmit,
    };

    // Optimistic UI
    setRequests((prev) => {
      const existing = prev.find((r) => r.id === trackId);
      if (existing) {
        return prev.map((r) => {
          if (r.id === trackId) {
            return {
              ...r,
              updatedAt: Date.now(),
              votes: r.votes + 1,
              comments: [...commentsToSubmit, ...r.comments],
            };
          }
          return r;
        });
      } else {
        return [{
          ...payload,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          votes: 1,
        }, ...prev];
      }
    });

    setSearchValue("");
    setSelectedTrack(null);
    setNoteInput("");
    setNameInput("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);

    const submitSnapshot = requests;
    beginMutation();
    try {
      const data = await postRequestsBody(payload);
      if (data.data) {
        mergeTrackFromServer(trackId, data.data);
      }
    } catch (err) {
      console.error("Error submitting request:", err);
      const msg = err instanceof Error ? err.message : "";
      alert(msg || "提交失败，请稍后重试");
      setSubmitted(false);
      setRequests(submitSnapshot);
    } finally {
      endMutation();
    }
  };

  return (
    <section id="requests" className="py-24 px-6" style={{ background: "#07070C" }}>
      <div className="max-w-5xl mx-auto">
        <SectionHeader label="点歌留言" title="SONG REQUEST" />

        <div className="mt-14 grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left: Form */}
          <div className="lg:col-span-2">
            <div
              className="p-6"
              style={{ background: "#0E0E1C", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-2 mb-5">
                <Music size={15} style={{ color: "#FF9FD4" }} />
                <span
                  className="text-sm uppercase tracking-widest"
                  style={{ color: "#FF9FD4", fontFamily: "'Anton', sans-serif", letterSpacing: "0.15em" }}
                >
                  为我们点一首歌
                </span>
              </div>

              {submitted && (
                <div
                  className="mb-4 px-4 py-3 text-sm"
                  style={{
                    background: "rgba(255,159,212,0.08)",
                    border: "1px solid rgba(255,159,212,0.3)",
                    color: "#FF9FD4",
                  }}
                >
                  点歌留言成功！感谢支持 ✦
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    搜索歌曲 * <span className="lowercase text-[10px] opacity-70 ml-1">(须从列表中选择)</span>
                  </label>
                  <MusicSearchInput
                    value={searchValue}
                    selectedTrackId={selectedTrack?.trackId ?? null}
                    onChange={(v) => {
                      setSearchValue(v);
                      setSelectedTrack(null);
                    }}
                    onSelect={handleSelect}
                  />
                  {selectedTrack && (
                    <div
                      className="flex items-center gap-3 mt-2 px-3 py-2"
                      style={{ background: "rgba(255,159,212,0.06)", border: "1px solid rgba(255,159,212,0.2)" }}
                    >
                      <img
                        src={selectedTrack.artworkUrl60}
                        alt={selectedTrack.trackName}
                        className="w-8 h-8 object-cover flex-shrink-0"
                        style={{ borderRadius: 2 }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">{selectedTrack.trackName}</p>
                        <p className="text-xs text-muted-foreground truncate">{selectedTrack.artistName}</p>
                      </div>
                      {selectedTrack.previewUrl && (
                        <PreviewButton previewUrl={selectedTrack.previewUrl} />
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    你的名字（选填）
                  </label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="留空则显示为匿名"
                    className="w-full px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all duration-200"
                    style={{
                      background: "#141422",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,159,212,0.4)")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    留言（选填）
                  </label>
                  <textarea
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="写下你想说的话..."
                    rows={3}
                    className="w-full px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all duration-200 resize-none"
                    style={{
                      background: "#141422",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "rgba(255,159,212,0.4)")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!selectedTrack}
                  className="flex items-center justify-center gap-2 py-3 text-sm uppercase tracking-widest transition-all duration-200 hover:opacity-85 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "#FF9FD4",
                    color: "#07070C",
                    fontFamily: "'Anton', sans-serif",
                    letterSpacing: "0.15em",
                  }}
                >
                  <Send size={14} />
                  提交点歌 / 留言
                </button>
              </form>
            </div>
          </div>

          {/* Right: List */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <p className="text-muted-foreground text-sm">
                  共 <span className="text-foreground">{requests.length}</span> 首金曲
                </p>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF9FD4] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#FF9FD4]"></span>
                  </span>
                  <span className="text-[10px] uppercase tracking-tighter text-[#FF9FD4] font-bold">Live</span>
                </div>
              </div>
              <div className="flex gap-px" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <SortButton
                  active={sortMode === "hot"}
                  onClick={() => setSortMode("hot")}
                  icon={<Flame size={12} />}
                  label="最热"
                />
                <SortButton
                  active={sortMode === "new"}
                  onClick={() => setSortMode("new")}
                  icon={<Clock size={12} />}
                  label="最新"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="py-10 flex justify-center">
                  <Loader2 className="animate-spin text-muted-foreground" size={24} />
                </div>
              ) : sorted.filter(r => r.comments && r.comments.length > 0).length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  暂无点歌留言，快来成为第一个吧！
                </div>
              ) : (
                sorted
                  .filter(r => r.comments && r.comments.length > 0)
                  .map((req, index) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    rank={sortMode === "hot" ? index + 1 : undefined}
                    maxVotes={maxVotes}
                    onVote={() => handleVote(req.id)}
                    voteBusy={votingIds.has(req.id)}
                    onDeleteComment={(commentId) => handleDeleteComment(req.id, commentId)}
                    onAddReply={(commentId, note, requester) =>
                      handleAddReply(req.id, commentId, note, requester)
                    }
                    onDeleteReply={(commentId, replyId) =>
                      handleDeleteReply(req.id, commentId, replyId)
                    }
                    replyingKey={replyingKey}
                    onToggleReply={(commentId) => {
                      const key = `${req.id}:${commentId}`;
                      setReplyingKey((prev) => (prev === key ? null : key));
                    }}
                    submittingReplyKey={submittingReplyKey}
                    onToggleCommentLike={(commentId) =>
                      handleToggleCommentLike(req.id, commentId)
                    }
                    onToggleReplyLike={(commentId, replyId) =>
                      handleToggleReplyLike(req.id, commentId, replyId)
                    }
                    likingKeys={likingKeys}
                    trackId={req.id}
                    clientId={clientId}
                    editingCommentKey={editingCommentKey}
                    savingCommentKey={savingCommentKey}
                    onStartEditComment={(commentId) =>
                      setEditingCommentKey(`${req.id}:${commentId}`)
                    }
                    onCancelEditComment={() => setEditingCommentKey(null)}
                    onSaveEditComment={(commentId, note, requester) =>
                      handleEditComment(req.id, commentId, note, requester)
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewButton({ previewUrl }: { previewUrl: string }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return subscribePreview((active) => setPlaying(active === previewUrl));
  }, [previewUrl]);

  useEffect(() => () => stopPreviewIf(previewUrl), [previewUrl]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePreview(previewUrl);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center transition-all duration-150 z-10 relative"
      style={{ background: playing ? "#FF9FD4" : "rgba(255,159,212,0.15)", borderRadius: "50%" }}
      title={playing ? "停止预览" : "30秒预览"}
    >
      {playing ? (
        <Square size={10} fill={playing ? "#07070C" : "#FF9FD4"} style={{ color: "#07070C" }} />
      ) : (
        <Play size={10} fill="#FF9FD4" style={{ color: "#FF9FD4", marginLeft: 1 }} />
      )}
    </button>
  );
}

function SortButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest transition-all duration-150"
      style={{
        background: active ? "#FF9FD4" : "transparent",
        color: active ? "#07070C" : "#6B6B8A",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function RequestCard({
  request,
  rank,
  maxVotes,
  onVote,
  onDeleteComment,
  onAddReply,
  onDeleteReply,
  replyingKey,
  onToggleReply,
  submittingReplyKey,
  onToggleCommentLike,
  onToggleReplyLike,
  likingKeys,
  trackId,
  clientId,
  editingCommentKey,
  savingCommentKey,
  onStartEditComment,
  onCancelEditComment,
  onSaveEditComment,
  voteBusy,
}: {
  request: SongRequest;
  rank?: number;
  maxVotes: number;
  onVote: () => void;
  onDeleteComment: (commentId: string) => void;
  onAddReply: (commentId: string, note: string, requester: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
  replyingKey: string | null;
  onToggleReply: (commentId: string) => void;
  submittingReplyKey: string | null;
  onToggleCommentLike: (commentId: string) => void;
  onToggleReplyLike: (commentId: string, replyId: string) => void;
  likingKeys: Set<string>;
  trackId: number;
  clientId: string;
  editingCommentKey: string | null;
  savingCommentKey: string | null;
  onStartEditComment: (commentId: string) => void;
  onCancelEditComment: () => void;
  onSaveEditComment: (commentId: string, note: string, requester: string) => void;
  voteBusy?: boolean;
}) {
  const pct = Math.round((request.votes / maxVotes) * 100);
  const hasParticipated = hasParticipatedOnTrack(request.comments, clientId);
  const myVote = findMyVoteComment(request.comments, clientId);
  const voteHighlight = hasParticipated;
  const voteTitle = myVote
    ? VOTE_CANCEL_TITLE
    : hasParticipated
      ? VOTE_PARTICIPATED_TITLE
      : VOTE_ADD_TITLE;

  return (
    <div
      className="relative overflow-hidden transition-all duration-200 group flex flex-col"
      style={{
        background: "#0E0E1C",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Popularity bar */}
      <div
        className="absolute left-0 top-0 bottom-0 transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: "rgba(255,159,212,0.04)",
          pointerEvents: "none",
        }}
      />

      <div className="relative flex items-center gap-3 px-4 py-3.5 z-10">
        {rank !== undefined && (
          <div
            className="flex-shrink-0 w-6 text-center text-xs"
            style={{
              color: rank <= 3 ? "#FF9FD4" : "#2E2E44",
              fontFamily: "'Anton', sans-serif",
              fontSize: rank <= 3 ? "0.85rem" : "0.75rem",
            }}
          >
            {rank <= 3 ? `#${rank}` : rank}
          </div>
        )}

        {request.artwork ? (
          <img
            src={request.artwork}
            alt={request.song}
            className="flex-shrink-0 w-10 h-10 object-cover"
            style={{ borderRadius: 2 }}
          />
        ) : (
          <div
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center"
            style={{ background: "#141422", borderRadius: 2 }}
          >
            <Music size={14} style={{ color: "#3A3A55" }} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <p
                className="text-foreground truncate"
                style={{ fontFamily: "'Anton', sans-serif", letterSpacing: "0.04em", fontSize: "0.95rem" }}
              >
                {request.song}
              </p>
              {request.previewUrl && <PreviewButton previewUrl={request.previewUrl} />}
            </div>
          </div>
          {request.artist && (
            <p className="text-muted-foreground text-xs truncate mt-0.5">{request.artist}</p>
          )}
        </div>

        <button
          type="button"
          onClick={onVote}
          disabled={voteBusy || (hasParticipated && !myVote)}
          className="flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 transition-all duration-150 hover:opacity-80 disabled:opacity-40"
          style={{
            border: voteHighlight ? "1px solid rgba(255,159,212,0.5)" : "1px solid rgba(255,255,255,0.08)",
            background: voteHighlight ? "rgba(255,159,212,0.08)" : "transparent",
            minWidth: 44,
            cursor: voteBusy || (hasParticipated && !myVote) ? "not-allowed" : "pointer",
          }}
          title={voteTitle}
        >
          <ChevronUp
            size={13}
            style={{ color: voteHighlight ? "#FF9FD4" : "#6B6B8A" }}
          />
          <span
            className="text-xs tabular-nums"
            style={{
              color: voteHighlight ? "#FF9FD4" : "#6B6B8A",
              fontFamily: "'Anton', sans-serif",
              letterSpacing: "0.05em",
            }}
          >
            {request.votes}
          </span>
        </button>
      </div>

      {/* Comments section attached below the song */}
      {request.comments && request.comments.length > 0 && (
        <div className="relative px-4 pb-4 pt-1 ml-[4.5rem] lg:ml-12 z-10 flex flex-col gap-2">
          {request.comments.map((cmt) => (
            <CommentItem
              key={cmt.commentId}
              comment={cmt}
              clientId={clientId}
              onDeleteComment={() => onDeleteComment(cmt.commentId)}
              onAddReply={(note, requester) => onAddReply(cmt.commentId, note, requester)}
              onDeleteReply={(replyId) => onDeleteReply(cmt.commentId, replyId)}
              isReplying={replyingKey === `${request.id}:${cmt.commentId}`}
              onToggleReply={() => onToggleReply(cmt.commentId)}
              replyBusy={submittingReplyKey === `${request.id}:${cmt.commentId}`}
              onToggleCommentLike={() => onToggleCommentLike(cmt.commentId)}
              onToggleReplyLike={(replyId) => onToggleReplyLike(cmt.commentId, replyId)}
              commentLikeBusy={likingKeys.has(`c:${trackId}:${cmt.commentId}`)}
              replyLikeBusy={(replyId) =>
                likingKeys.has(`r:${trackId}:${cmt.commentId}:${replyId}`)
              }
              isEditing={editingCommentKey === `${trackId}:${cmt.commentId}`}
              editBusy={savingCommentKey === `${trackId}:${cmt.commentId}`}
              onStartEdit={() => onStartEditComment(cmt.commentId)}
              onCancelEdit={onCancelEditComment}
              onSaveEdit={(note, requester) =>
                onSaveEditComment(cmt.commentId, note, requester)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  clientId,
  onDeleteComment,
  onAddReply,
  onDeleteReply,
  isReplying,
  onToggleReply,
  replyBusy,
  onToggleCommentLike,
  onToggleReplyLike,
  commentLikeBusy,
  replyLikeBusy,
  isEditing,
  editBusy,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: {
  comment: Comment;
  clientId: string;
  onDeleteComment: () => void;
  onAddReply: (note: string, requester: string) => void;
  onDeleteReply: (replyId: string) => void;
  isReplying: boolean;
  onToggleReply: () => void;
  replyBusy: boolean;
  onToggleCommentLike: () => void;
  onToggleReplyLike: (replyId: string) => void;
  commentLikeBusy: boolean;
  replyLikeBusy: (replyId: string) => boolean;
  isEditing: boolean;
  editBusy: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (note: string, requester: string) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [replyName, setReplyName] = useState("");
  const [editName, setEditName] = useState(comment.requester);
  const [editNote, setEditNote] = useState(comment.note);
  const replies = comment.replies || [];
  const commentLiked = isLikedBy(comment.likedBy, clientId);
  const commentLikeCount = (comment.likedBy || []).length;
  const isOwn = comment.ownerId === clientId;
  /** 仅投票记录不可编辑；勿用「匿名」等昵称误判普通留言 */
  const canEdit = isOwn;

  useEffect(() => {
    if (isEditing) {
      setEditName(comment.requester);
      setEditNote(comment.note);
    }
  }, [isEditing, comment.requester, comment.note]);

  const submitReply = (e: React.FormEvent) => {
    e.preventDefault();
    onAddReply(replyText, replyName);
    setReplyText("");
    setReplyName("");
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveEdit(editNote, editName);
  };

  return (
    <div
      className="flex flex-col gap-1"
      style={{
        background: "rgba(0,0,0,0.2)",
        padding: "8px 12px",
        borderRadius: "4px",
        borderLeft: "2px solid rgba(255,159,212,0.2)",
      }}
    >
      {isEditing ? (
        <form onSubmit={submitEdit} className="flex flex-col gap-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder={COMMENT_EDIT_NAME_PLACEHOLDER}
            maxLength={20}
            className="w-full px-2 py-1 text-xs bg-black/30 border border-white/10 text-foreground rounded-sm outline-none focus:border-[#FF9FD4]/40"
          />
          <textarea
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder={COMMENT_EDIT_NOTE_PLACEHOLDER}
            maxLength={500}
            rows={3}
            className="w-full px-2 py-1 text-xs bg-black/30 border border-white/10 text-foreground rounded-sm outline-none focus:border-[#FF9FD4]/40 resize-y min-h-[60px]"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={editBusy}
              className="text-xs px-2 py-1 disabled:opacity-50"
              style={{ background: "#FF9FD4", color: "#07070C" }}
            >
              {editBusy ? "保存中…" : COMMENT_EDIT_SAVE}
            </button>
            <button
              type="button"
              disabled={editBusy}
              onClick={onCancelEdit}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {COMMENT_EDIT_CANCEL}
            </button>
          </div>
        </form>
      ) : (
        <>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-foreground text-xs font-medium opacity-90">{comment.requester}</span>
        <time
          dateTime={
            resolveCommentCreatedAt(comment) > 0
              ? new Date(resolveCommentCreatedAt(comment)).toISOString()
              : undefined
          }
          className="text-muted-foreground text-[10px] opacity-50 tabular-nums"
        >
          {formatCommentTime(comment)}
        </time>
      </div>

      <div className="flex items-start gap-2">
        {comment.note ? (
          <p className="flex-1 min-w-0 text-muted-foreground text-xs leading-relaxed opacity-80 break-words">
            {comment.note}
          </p>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <LikeButton
            count={commentLikeCount}
            liked={commentLiked}
            busy={commentLikeBusy}
            onToggle={onToggleCommentLike}
          />
          {isOwn && (
            <>
              {canEdit && (
                <button
                  type="button"
                  onClick={onStartEdit}
                  className="text-[#FF9FD4]/85 hover:text-[#FF9FD4] flex items-center transition-colors p-1"
                  title={COMMENT_EDIT_BTN}
                  aria-label={COMMENT_EDIT_BTN}
                >
                  <Pencil size={11} />
                </button>
              )}
              <button
                type="button"
                onClick={onDeleteComment}
                className="text-red-400/70 hover:text-red-400 flex items-center transition-colors p-1"
                title="删除我的留言"
                aria-label="删除我的留言"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 pl-2 border-l border-white/5">
          {replies.map((reply) => {
            const replyLiked = isLikedBy(reply.likedBy, clientId);
            const replyLikeCount = (reply.likedBy || []).length;
            return (
              <div key={reply.replyId} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-foreground text-[11px] font-medium opacity-80">
                    {reply.requester}
                  </span>
                  <time
                    dateTime={
                      resolveReplyCreatedAt(reply) > 0
                        ? new Date(resolveReplyCreatedAt(reply)).toISOString()
                        : undefined
                    }
                    className="text-muted-foreground text-[10px] opacity-40 tabular-nums"
                  >
                    {formatReplyTime(reply)}
                  </time>
                </div>
                <div className="flex items-start gap-2">
                  <p className="flex-1 min-w-0 text-muted-foreground text-[11px] leading-relaxed opacity-75 break-words">
                    {reply.note}
                  </p>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <LikeButton
                      count={replyLikeCount}
                      liked={replyLiked}
                      busy={replyLikeBusy(reply.replyId)}
                      onToggle={() => onToggleReplyLike(reply.replyId)}
                      compact
                    />
                    {reply.ownerId === clientId && (
                      <button
                        type="button"
                        onClick={() => onDeleteReply(reply.replyId)}
                        className="text-red-400/60 hover:text-red-400 flex items-center transition-colors p-0.5"
                        title={REPLY_DELETE_TITLE}
                      >
                        <Trash2 size={9} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-1.5 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onToggleReply}
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider transition-colors hover:opacity-100 opacity-60"
          style={{ color: "#FF9FD4" }}
        >
          <ReplyIcon size={10} />
          {REPLY_BTN}
          {replies.length > 0 && (
            <span className="opacity-70">({replies.length})</span>
          )}
        </button>
      </div>

      {isReplying && (
        <form onSubmit={submitReply} className="mt-2 flex flex-col gap-2">
          <input
            type="text"
            value={replyName}
            onChange={(e) => setReplyName(e.target.value)}
            placeholder={REPLY_NAME_PLACEHOLDER}
            maxLength={20}
            className="w-full bg-black/30 border border-white/10 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#FF9FD4]/40"
          />
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={REPLY_PLACEHOLDER}
            maxLength={500}
            rows={2}
            className="w-full bg-black/30 border border-white/10 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-[#FF9FD4]/40 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={replyBusy || !replyText.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider transition-opacity disabled:opacity-40"
              style={{ background: "#FF9FD4", color: "#07070C" }}
            >
              {replyBusy ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
              {REPLY_SUBMIT}
            </button>
            <button
              type="button"
              onClick={onToggleReply}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {REPLY_CANCEL}
            </button>
          </div>
        </form>
      )}
        </>
      )}
    </div>
  );
}

function LikeButton({
  count,
  liked,
  busy,
  onToggle,
  compact,
}: {
  count: number;
  liked: boolean;
  busy: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const iconSize = compact ? 11 : 13;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      title={liked ? UNLIKE_TITLE : LIKE_TITLE}
      className="inline-flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
      style={{
        minWidth: compact ? 36 : 42,
        padding: compact ? "4px 6px" : "6px 8px",
        borderRadius: 6,
        border: liked
          ? "1px solid rgba(255,159,212,0.55)"
          : "1px solid rgba(255,255,255,0.14)",
        background: liked ? "rgba(255,159,212,0.14)" : "rgba(255,255,255,0.04)",
        color: liked ? "#FF9FD4" : "#9A9AB0",
      }}
    >
      <Heart
        size={iconSize}
        fill={liked ? "#FF9FD4" : "transparent"}
        stroke={liked ? "#FF9FD4" : "currentColor"}
        strokeWidth={liked ? 0 : 2}
      />
      <span
        className="tabular-nums leading-none font-medium"
        style={{ fontSize: compact ? "9px" : "10px" }}
      >
        {count > 0 ? count : LIKE_BTN}
      </span>
    </button>
  );
}
