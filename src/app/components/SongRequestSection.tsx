import { useState, useRef, useEffect } from "react";
import { Music, ChevronUp, Clock, Flame, Send, Play, Pause, Square, Loader2, Trash2, Reply, Heart } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { MusicSearchInput, TrackResult } from "./MusicSearchInput";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { supabase } from "../supabaseClient";
import { VOTE_NOTE, VOTE_REQUESTER, VOTE_ADD_TITLE, VOTE_CANCEL_TITLE } from "../copy/voteCopy";
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
  REPLY_TIME_NOW,
} from "../copy/replyCopy";
import { LIKE_BTN, LIKE_TITLE, UNLIKE_TITLE } from "../copy/likeCopy";

const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-2914ec93`;

const getAuthHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (publicAnonKey) {
    headers["Authorization"] = `Bearer ${publicAnonKey}`;
    headers["apikey"] = publicAnonKey;
  }
  return headers;
};

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

interface Reply {
  replyId: string;
  note: string;
  requester: string;
  time: string;
  ownerId: string;
  likedBy?: string[];
}

interface Comment {
  commentId: string;
  note: string;
  requester: string;
  time: string;
  ownerId: string;
  isVote?: boolean;
  replies?: Reply[];
  likedBy?: string[];
}

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

function isVoteComment(c: Comment) {
  return (
    c.isVote === true ||
    (c.note === VOTE_NOTE && c.requester === VOTE_REQUESTER)
  );
}

function collectVotedIds(list: SongRequest[], clientId: string) {
  const voted = new Set<number>();
  for (const r of list) {
    if (r.comments?.some((c) => c.ownerId === clientId && isVoteComment(c))) {
      voted.add(r.id);
    }
  }
  return voted;
}

interface SongRequest {
  id: number;
  song: string;
  artist?: string;
  artwork?: string;
  previewUrl?: string;
  votes: number;
  comments: Comment[];
  createdAt: number;
  hasVoted?: boolean;
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
    setLocalVotedIds(collectVotedIds(requests, clientId));
  }, [requests, clientId]);

  useEffect(() => {
    localStorage.setItem("void_echo_voted_ids", JSON.stringify(Array.from(localVotedIds)));
  }, [localVotedIds]);

  useEffect(() => {
    const fetchData = () => {
      fetch(`${serverUrl}/requests`, {
        headers: getAuthHeaders(),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.success) {
            setRequests(data.data);
          } else {
            console.error("Server returned error fetching requests:", data.error);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Network or parsing error fetching requests:", err);
          setLoading(false);
        });
    };

    // Fetch initial data
    fetchData();

    // Set up 5s polling interval as requested
    const interval = setInterval(fetchData, 5000);

    // Realtime subscription
    const channel = supabase
      .channel("kv-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kv_store_2914ec93" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const key = payload.new.key as string;
            if (!key.startsWith("req:")) return;
            
            let newReq = payload.new.value;
            // Handle migration format just in case it comes through raw
            if (newReq && !newReq.comments) {
              newReq = {
                ...newReq,
                comments: newReq.note || newReq.requester ? [{
                  commentId: newReq.id.toString(),
                  note: newReq.note || "",
                  requester: newReq.requester || "匿名",
                  time: newReq.time || "刚刚",
                  ownerId: newReq.ownerId || ""
                }] : [],
                createdAt: newReq.createdAt || newReq.id
              };
            }

            if (newReq) {
              setRequests((prev) => {
                const exists = prev.find((r) => r.id === newReq.id);
                if (exists) {
                  return prev.map((r) => (r.id === newReq.id ? newReq : r));
                }
                return [newReq, ...prev];
              });
            }
          } else if (payload.eventType === "DELETE") {
            const key = payload.old.key as string;
            if (key && key.startsWith("req:")) {
              const id = parseInt(key.replace("req:", ""));
              setRequests((prev) => prev.filter((r) => r.id !== id));
              // 同步释放投票限制：如果实时监听到删除，立即允许该设备重新对该 ID 投票
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const sorted = [...requests].sort((a, b) =>
    sortMode === "hot" ? b.votes - a.votes : b.createdAt - a.createdAt
  );
  const maxVotes = sorted[0]?.votes ?? 1;

  const refetchRequests = async () => {
    try {
      const res = await fetch(`${serverUrl}/requests`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setRequests(data.data);
    } catch {
      /* ignore */
    }
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
    const res = await fetch(`${serverUrl}/requests/${trackId}/comments/${commentId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
      body: JSON.stringify({ ownerId: clientId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || "delete failed");
    }
  };

  const handleDeleteComment = async (trackId: number, commentId: string) => {
    const req = requests.find((r) => r.id === trackId);
    const target = req?.comments.find((c) => c.commentId === commentId);
    if (!target) return;
    if (!window.confirm("确定要删除你的这条留言吗？")) return;

    applyCommentRemoval(trackId, commentId);
    try {
      await removeCommentOnServer(trackId, commentId);
    } catch (err) {
      console.error("Error deleting comment:", err);
    }
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

    const newReply: Reply = {
      replyId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      note: trimmed,
      requester: requester.trim() || REPLY_DEFAULT_NAME,
      time: REPLY_TIME_NOW,
      ownerId: clientId,
      likedBy: [],
    };

    setSubmittingReplyKey(replyKey);
    applyReplyUpdate(trackId, commentId, (replies) => [...replies, newReply]);
    setReplyingKey(null);

    try {
      const res = await fetch(
        `${serverUrl}/requests/${trackId}/comments/${commentId}/replies`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ reply: newReply }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "reply failed");
      }
      if (data.data) {
        setRequests((prev) => prev.map((r) => (r.id === trackId ? data.data : r)));
      }
    } catch (err) {
      console.error("Error adding reply:", err);
      await refetchRequests();
    } finally {
      setSubmittingReplyKey(null);
    }
  };

  const mergeTrackFromServer = (trackId: number, data: SongRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === trackId ? data : r)));
  };

  const handleToggleCommentLike = async (trackId: number, commentId: string) => {
    const likeKey = `c:${trackId}:${commentId}`;
    if (likingKeys.has(likeKey)) return;

    setLikingKeys((prev) => new Set(prev).add(likeKey));
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== trackId) return r;
        return {
          ...r,
          comments: r.comments.map((c) =>
            c.commentId === commentId
              ? { ...c, likedBy: toggleLikedByList(c.likedBy, clientId) }
              : c
          ),
        };
      })
    );

    try {
      const res = await fetch(
        `${serverUrl}/requests/${trackId}/comments/${commentId}/like`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ ownerId: clientId }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "like failed");
      if (data.data) mergeTrackFromServer(trackId, data.data);
    } catch (err) {
      console.error("Error toggling comment like:", err);
      await refetchRequests();
    } finally {
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

    setLikingKeys((prev) => new Set(prev).add(likeKey));
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== trackId) return r;
        return {
          ...r,
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

    try {
      const res = await fetch(
        `${serverUrl}/requests/${trackId}/comments/${commentId}/replies/${replyId}/like`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ ownerId: clientId }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "like failed");
      if (data.data) mergeTrackFromServer(trackId, data.data);
    } catch (err) {
      console.error("Error toggling reply like:", err);
      await refetchRequests();
    } finally {
      setLikingKeys((prev) => {
        const next = new Set(prev);
        next.delete(likeKey);
        return next;
      });
    }
  };

  const handleDeleteReply = async (trackId: number, commentId: string, replyId: string) => {
    if (!window.confirm(REPLY_DELETE_CONFIRM)) return;

    applyReplyUpdate(trackId, commentId, (replies) =>
      replies.filter((r) => r.replyId !== replyId)
    );

    try {
      const res = await fetch(
        `${serverUrl}/requests/${trackId}/comments/${commentId}/replies/${replyId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
          body: JSON.stringify({ ownerId: clientId }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "delete reply failed");
      }
      if (data.data) {
        setRequests((prev) => prev.map((r) => (r.id === trackId ? data.data : r)));
      }
    } catch (err) {
      console.error("Error deleting reply:", err);
      await refetchRequests();
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

    const myVote = existingReq.comments.find(
      (c) => c.ownerId === clientId && isVoteComment(c)
    );
    const hasVoted = localVotedIds.has(id) || !!myVote;

    setVotingIds((prev) => new Set(prev).add(id));

    try {
      if (hasVoted && myVote) {
        applyCommentRemoval(id, myVote.commentId);
        await removeCommentOnServer(id, myVote.commentId);
        return;
      }

      if (hasVoted) return;

      const newComment: Comment = {
        commentId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        note: VOTE_NOTE,
        requester: VOTE_REQUESTER,
        time: "\u521a\u521a",
        ownerId: clientId,
        isVote: true,
        replies: [],
        likedBy: [],
      };

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                votes: r.comments.length + 1,
                comments: [newComment, ...r.comments],
              }
            : r
        )
      );
      const res = await fetch(`${serverUrl}/requests`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id,
          song: existingReq.song,
          artist: existingReq.artist,
          artwork: existingReq.artwork,
          previewUrl: existingReq.previewUrl,
          comments: [newComment],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || "vote failed");
      }
      if (data.data) {
        setRequests((prev) => prev.map((r) => (r.id === id ? data.data : r)));
      }
    } catch (err) {
      console.error("Error voting:", err);
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("\u7559\u8a00")) alert(msg);
      await refetchRequests();
    } finally {
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

    const newComment: Comment = {
      commentId: Date.now().toString() + Math.random().toString(36).substring(2),
      note: noteInput.trim() || VOTE_NOTE,
      requester: nameInput.trim() || VOTE_REQUESTER,
      time: "刚刚",
      ownerId: clientId,
      replies: [],
      likedBy: [],
    };

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
          votes: 1,
        }, ...prev];
      }
    });

    setLocalVotedIds((prev) => new Set(prev).add(trackId));
    
    setSearchValue("");
    setSelectedTrack(null);
    setNoteInput("");
    setNameInput("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);

    try {
      const res = await fetch(`${serverUrl}/requests`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
         // 如果后端返回明确的错误信息，则显示，否则静默处理（因为UI已经乐观更新了）
         console.warn("Server submission error:", data.error);
         if (data.error && data.error.includes("反复")) {
           alert(data.error);
         }
      }
    } catch (err) {
      console.error("Error submitting request:", err);
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
                    request={{ ...req, hasVoted: localVotedIds.has(req.id) }}
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      const promise = audioRef.current.play();
      if (promise !== undefined) {
        promise.then(() => setPlaying(true)).catch(() => {});
      }
    }
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
  voteBusy?: boolean;
}) {
  const pct = Math.round((request.votes / maxVotes) * 100);

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
          disabled={voteBusy}
          className="flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 transition-all duration-150 hover:opacity-80 disabled:opacity-40"
          style={{
            border: request.hasVoted ? "1px solid rgba(255,159,212,0.5)" : "1px solid rgba(255,255,255,0.08)",
            background: request.hasVoted ? "rgba(255,159,212,0.08)" : "transparent",
            minWidth: 44,
            cursor: voteBusy ? "wait" : "pointer",
          }}
          title={request.hasVoted ? VOTE_CANCEL_TITLE : VOTE_ADD_TITLE}
        >
          <ChevronUp
            size={13}
            style={{ color: request.hasVoted ? "#FF9FD4" : "#6B6B8A" }}
          />
          <span
            className="text-xs tabular-nums"
            style={{
              color: request.hasVoted ? "#FF9FD4" : "#6B6B8A",
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
}) {
  const [replyText, setReplyText] = useState("");
  const [replyName, setReplyName] = useState("");
  const replies = comment.replies || [];
  const commentLiked = isLikedBy(comment.likedBy, clientId);
  const commentLikeCount = (comment.likedBy || []).length;

  const submitReply = (e: React.FormEvent) => {
    e.preventDefault();
    onAddReply(replyText, replyName);
    setReplyText("");
    setReplyName("");
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
      <div className="flex justify-between items-start gap-2">
        <span className="text-foreground text-xs font-medium opacity-90">{comment.requester}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[10px] opacity-50">{comment.time}</span>
          {comment.ownerId === clientId && (
            <button
              type="button"
              onClick={onDeleteComment}
              className="text-red-400/70 hover:text-red-400 flex items-center transition-colors"
              title="删除我的留言"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>
      {comment.note && (
        <p className="text-muted-foreground text-xs mt-1 leading-relaxed opacity-80 break-words">
          {comment.note}
        </p>
      )}

      <LikeButton
        count={commentLikeCount}
        liked={commentLiked}
        busy={commentLikeBusy}
        onToggle={onToggleCommentLike}
      />

      {replies.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 pl-2 border-l border-white/5">
          {replies.map((reply) => {
            const replyLiked = isLikedBy(reply.likedBy, clientId);
            const replyLikeCount = (reply.likedBy || []).length;
            return (
              <div key={reply.replyId} className="flex flex-col gap-0.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-foreground text-[11px] font-medium opacity-80">
                    {reply.requester}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[10px] opacity-40">{reply.time}</span>
                    {reply.ownerId === clientId && (
                      <button
                        type="button"
                        onClick={() => onDeleteReply(reply.replyId)}
                        className="text-red-400/60 hover:text-red-400 flex items-center transition-colors"
                        title={REPLY_DELETE_TITLE}
                      >
                        <Trash2 size={9} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed opacity-75 break-words">
                  {reply.note}
                </p>
                <LikeButton
                  count={replyLikeCount}
                  liked={replyLiked}
                  busy={replyLikeBusy(reply.replyId)}
                  onToggle={() => onToggleReplyLike(reply.replyId)}
                  compact
                />
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
          <Reply size={10} />
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
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      title={liked ? UNLIKE_TITLE : LIKE_TITLE}
      className={`inline-flex items-center gap-1 transition-opacity hover:opacity-100 disabled:opacity-40 ${
        compact ? "mt-0.5" : "mt-1"
      } ${liked ? "opacity-90" : "opacity-50"}`}
      style={{ color: liked ? "#FF9FD4" : "#6B6B8A" }}
    >
      <Heart
        size={compact ? 9 : 10}
        fill={liked ? "#FF9FD4" : "transparent"}
        stroke={liked ? "#FF9FD4" : "currentColor"}
      />
      <span className="tabular-nums text-[10px]">
        {count > 0 ? count : LIKE_BTN}
      </span>
    </button>
  );
}
