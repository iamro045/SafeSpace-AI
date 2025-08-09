export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  reputationScore: number;
  role: 'user' | 'moderator' | 'admin';
  isActive: boolean;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  userId: string;
  content: string;
  contentType: 'text' | 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  language: string;
  isModerated: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationReason?: string;
  aiConfidence?: number;
  aiFlags?: string[];
  createdAt: string;
  updatedAt: string;
  user?: User;
  commentCount?: number;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  language: string;
  isModerated: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationReason?: string;
  aiConfidence?: number;
  aiFlags?: string[];
  createdAt: string;
  updatedAt: string;
  user?: User;
  post?: Post;
}

export interface ModerationAction {
  id: string;
  contentId: string;
  contentType: 'post' | 'comment';
  moderatorId?: string;
  action: 'approve' | 'reject' | 'flag' | 'ban_user';
  reason?: string;
  isAutomatic: boolean;
  aiModel?: string;
  confidence?: number;
  details?: any;
  createdAt: string;
  content?: Post | Comment;
  user?: User;
}

export interface AIModelStatus {
  id: string;
  modelName: string;
  modelType: 'text' | 'image' | 'video';
  status: 'active' | 'loading' | 'error' | 'disabled';
  version?: string;
  lastHealthCheck: string;
  errorMessage?: string;
  configuration?: any;
}

export interface ContentStats {
  totalProcessed: number;
  totalFlagged: number;
  totalBlocked: number;
  activeUsers: number;
}

export interface ReputationInsights {
  distribution: Array<{
    range: string;
    label: string;
    count: number;
  }>;
  lowReputationUsers: Array<User & { recentViolations: number }>;
  averageScore: number;
}

export interface PendingContent {
  posts: Post[];
  comments: Comment[];
}

export interface DashboardAnalytics {
  stats: ContentStats;
  recentActions: ModerationAction[];
  aiModels: AIModelStatus[];
  reputationInsights: ReputationInsights;
  languageDistribution: Record<string, number>;
  contentTypeDistribution: Record<string, number>;
  detectionInsights: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}
