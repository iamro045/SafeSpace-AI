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
  comments?: Comment[];
  aiDetails?: {
    actionId: string;
    isAutomatic: boolean;
    aiModel?: string | null;
    confidence?: number | null;
    reason?: string | null;
    createdAt?: string;
    classificationLabel?: string;
    severityScore?: number;
    detectedLanguage?: string;
    contributingTerms?: string[];
    violationType?: string[];
  } | null;
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
  aiDetails?: Post["aiDetails"];
}

export interface AbuseLexicon {
  blockTerms: string[];
  reviewTerms: string[];
  updatedAt: string;
}

export interface TextModelVersionInfo {
  version: string;
  fileName: string;
  trainedAt?: string;
  vocabularySize?: number;
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

export interface AppConfigResponse {
  content: {
    textCharLimit: number;
    commentCharLimit: number;
  };
  uploads: {
    maxImageBytes: number;
    allowedImageMimeTypes: string[];
  };
  moderation: Record<string, any>;
  reputation: Record<string, any>;
}

export interface DatasetMetadata {
  id: string;
  name: string;
  uploadedAt: string;
  rowCount: number;
  labelCounts: Record<string, number>;
  languages: string[];
  originalFilename: string;
}

export interface TrainTextModelResult {
  modelVersion: string;
  trainedAt: string;
  rowCount: number;
  labelCounts: Record<string, number>;
  vocabularySize: number;
  holdoutAccuracy: number;
  dataset: DatasetMetadata;
}
