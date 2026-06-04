export interface Reply {
  replyId: string;
  note: string;
  requester: string;
  time: string;
  /** 留言时间（毫秒） */
  createdAt?: number;
  /** 最后编辑时间（毫秒） */
  updatedAt?: number;
  ownerId: string;
  likedBy?: string[];
}

export interface Comment {
  commentId: string;
  note: string;
  requester: string;
  time: string;
  /** 留言时间（毫秒） */
  createdAt?: number;
  /** 最后编辑时间（毫秒） */
  updatedAt?: number;
  ownerId: string;
  isVote?: boolean;
  replies?: Reply[];
  likedBy?: string[];
}

export interface SongRequest {
  id: number;
  song: string;
  artist?: string;
  artwork?: string;
  previewUrl?: string;
  votes: number;
  comments: Comment[];
  createdAt: number;
  updatedAt?: number;
  hasVoted?: boolean;
}
