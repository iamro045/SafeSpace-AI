import {
  users,
  posts,
  comments,
  moderationActions,
  reputationHistory,
  aiModelStatus,
  contentReports,
  type User,
  type InsertUser,
  type Post,
  type InsertPost,
  type Comment,
  type InsertComment,
  type ModerationAction,
  type InsertModerationAction,
  type ReputationHistory,
  type InsertReputationHistory,
  type AIModelStatus,
  type ContentReport,
  type InsertContentReport,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  updateUserReputation(id: string, newScore: number): Promise<void>;
  getAllUsers(): Promise<User[]>;
  getUsersWithLowReputation(threshold?: number): Promise<User[]>;

  // Post operations
  createPost(post: InsertPost): Promise<Post>;
  getPost(id: string): Promise<Post | undefined>;
  getPostsByUser(userId: string): Promise<Post[]>;
  getAllPosts(): Promise<Post[]>;
  getPostsForModeration(status?: string): Promise<Post[]>;
  updatePostModerationStatus(id: string, status: string, reason?: string, aiConfidence?: number, aiFlags?: any): Promise<void>;

  // Comment operations
  createComment(comment: InsertComment): Promise<Comment>;
  getComment(id: string): Promise<Comment | undefined>;
  getCommentsByPost(postId: string): Promise<Comment[]>;
  getCommentsForModeration(status?: string): Promise<Comment[]>;
  updateCommentModerationStatus(id: string, status: string, reason?: string, aiConfidence?: number, aiFlags?: any): Promise<void>;

  // Moderation operations
  createModerationAction(action: InsertModerationAction): Promise<ModerationAction>;
  getModerationActions(limit?: number): Promise<ModerationAction[]>;
  getModerationActionsByModerator(moderatorId: string): Promise<ModerationAction[]>;

  // Reputation operations
  createReputationHistory(history: InsertReputationHistory): Promise<ReputationHistory>;
  getReputationHistoryByUser(userId: string): Promise<ReputationHistory[]>;

  // AI Model operations
  getAIModelStatus(): Promise<AIModelStatus[]>;
  updateAIModelStatus(modelName: string, status: string, errorMessage?: string): Promise<void>;

  // Content reports
  createContentReport(report: InsertContentReport): Promise<ContentReport>;
  getContentReports(status?: string): Promise<ContentReport[]>;
  updateContentReport(id: string, status: string, reviewedBy?: string): Promise<void>;

  // Analytics
  getContentStats(): Promise<{
    totalProcessed: number;
    totalFlagged: number;
    totalBlocked: number;
    activeUsers: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private posts: Map<string, Post> = new Map();
  private comments: Map<string, Comment> = new Map();
  private moderationActions: Map<string, ModerationAction> = new Map();
  private reputationHistory: Map<string, ReputationHistory> = new Map();
  private aiModelStatuses: Map<string, AIModelStatus> = new Map();
  private contentReports: Map<string, ContentReport> = new Map();

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData(): void {
    // Initialize AI model statuses
    const textModel: AIModelStatus = {
      id: randomUUID(),
      modelName: "Text Analysis",
      modelType: "text",
      status: "active",
      version: "1.0",
      lastHealthCheck: new Date(),
      errorMessage: null,
      configuration: { language: ["en", "hi"], threshold: 0.7 }
    };
    
    const imageModel: AIModelStatus = {
      id: randomUUID(),
      modelName: "Image Detection",
      modelType: "image",
      status: "active",
      version: "1.0",
      lastHealthCheck: new Date(),
      errorMessage: null,
      configuration: { nsfw_threshold: 0.8, face_detection: true }
    };

    const videoModel: AIModelStatus = {
      id: randomUUID(),
      modelName: "Video Analysis",
      modelType: "video",
      status: "loading",
      version: "1.0",
      lastHealthCheck: new Date(),
      errorMessage: null,
      configuration: { frame_analysis: true, audio_detection: false }
    };

    this.aiModelStatuses.set(textModel.modelName, textModel);
    this.aiModelStatuses.set(imageModel.modelName, imageModel);
    this.aiModelStatuses.set(videoModel.modelName, videoModel);

    // Create admin user
    const adminUser: User = {
      id: randomUUID(),
      username: "admin",
      email: "admin@projectclean.com",
      password: "$2b$10$hashedpassword", // In real app, this would be properly hashed
      firstName: "Sarah",
      lastName: "Johnson",
      profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=32&h=32",
      reputationScore: 5.0,
      role: "admin",
      isActive: true,
      isBanned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      reputationScore: insertUser.reputationScore || 5.0,
      role: insertUser.role || "user",
      isActive: insertUser.isActive !== undefined ? insertUser.isActive : true,
      isBanned: insertUser.isBanned !== undefined ? insertUser.isBanned : false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserReputation(id: string, newScore: number): Promise<void> {
    const user = this.users.get(id);
    if (!user) return;

    const previousScore = user.reputationScore || 5.0;
    const change = newScore - previousScore;
    
    // Update user reputation
    await this.updateUser(id, { reputationScore: newScore });
    
    // Create reputation history entry
    await this.createReputationHistory({
      userId: id,
      previousScore,
      newScore,
      change,
      reason: "Content moderation action",
    });
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersWithLowReputation(threshold: number = 2.0): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.reputationScore! < threshold);
  }

  // Post operations
  async createPost(insertPost: InsertPost): Promise<Post> {
    const id = randomUUID();
    const post: Post = {
      ...insertPost,
      id,
      imageUrl: insertPost.imageUrl || null,
      videoUrl: insertPost.videoUrl || null,
      language: insertPost.language || "en",
      isModerated: insertPost.isModerated || false,
      moderationStatus: insertPost.moderationStatus || "pending",
      moderationReason: insertPost.moderationReason || null,
      aiConfidence: insertPost.aiConfidence || null,
      aiFlags: insertPost.aiFlags || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.posts.set(id, post);
    return post;
  }

  async getPost(id: string): Promise<Post | undefined> {
    return this.posts.get(id);
  }

  async getPostsByUser(userId: string): Promise<Post[]> {
    return Array.from(this.posts.values()).filter(post => post.userId === userId);
  }

  async getAllPosts(): Promise<Post[]> {
    return Array.from(this.posts.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getPostsForModeration(status: string = "pending"): Promise<Post[]> {
    return Array.from(this.posts.values())
      .filter(post => post.moderationStatus === status)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async updatePostModerationStatus(
    id: string, 
    status: string, 
    reason?: string, 
    aiConfidence?: number, 
    aiFlags?: any
  ): Promise<void> {
    const post = this.posts.get(id);
    if (!post) return;

    const updatedPost = {
      ...post,
      moderationStatus: status,
      moderationReason: reason || null,
      aiConfidence: aiConfidence || null,
      aiFlags: aiFlags || null,
      isModerated: true,
      updatedAt: new Date(),
    };
    this.posts.set(id, updatedPost);
  }

  // Comment operations
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = {
      ...insertComment,
      id,
      language: insertComment.language || "en",
      isModerated: insertComment.isModerated || false,
      moderationStatus: insertComment.moderationStatus || "pending",
      moderationReason: insertComment.moderationReason || null,
      aiConfidence: insertComment.aiConfidence || null,
      aiFlags: insertComment.aiFlags || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.comments.set(id, comment);
    return comment;
  }

  async getComment(id: string): Promise<Comment | undefined> {
    return this.comments.get(id);
  }

  async getCommentsByPost(postId: string): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.postId === postId)
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  }

  async getCommentsForModeration(status: string = "pending"): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.moderationStatus === status)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async updateCommentModerationStatus(
    id: string, 
    status: string, 
    reason?: string, 
    aiConfidence?: number, 
    aiFlags?: any
  ): Promise<void> {
    const comment = this.comments.get(id);
    if (!comment) return;

    const updatedComment = {
      ...comment,
      moderationStatus: status,
      moderationReason: reason || null,
      aiConfidence: aiConfidence || null,
      aiFlags: aiFlags || null,
      isModerated: true,
      updatedAt: new Date(),
    };
    this.comments.set(id, updatedComment);
  }

  // Moderation operations
  async createModerationAction(insertAction: InsertModerationAction): Promise<ModerationAction> {
    const id = randomUUID();
    const action: ModerationAction = {
      ...insertAction,
      id,
      moderatorId: insertAction.moderatorId || null,
      reason: insertAction.reason || null,
      isAutomatic: insertAction.isAutomatic || null,
      aiModel: insertAction.aiModel || null,
      confidence: insertAction.confidence || null,
      details: insertAction.details || null,
      createdAt: new Date(),
    };
    this.moderationActions.set(id, action);
    return action;
  }

  async getModerationActions(limit: number = 50): Promise<ModerationAction[]> {
    return Array.from(this.moderationActions.values())
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, limit);
  }

  async getModerationActionsByModerator(moderatorId: string): Promise<ModerationAction[]> {
    return Array.from(this.moderationActions.values())
      .filter(action => action.moderatorId === moderatorId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  // Reputation operations
  async createReputationHistory(insertHistory: InsertReputationHistory): Promise<ReputationHistory> {
    const id = randomUUID();
    const history: ReputationHistory = {
      ...insertHistory,
      id,
      contentId: insertHistory.contentId || null,
      createdAt: new Date(),
    };
    this.reputationHistory.set(id, history);
    return history;
  }

  async getReputationHistoryByUser(userId: string): Promise<ReputationHistory[]> {
    return Array.from(this.reputationHistory.values())
      .filter(history => history.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  // AI Model operations
  async getAIModelStatus(): Promise<AIModelStatus[]> {
    return Array.from(this.aiModelStatuses.values());
  }

  async updateAIModelStatus(modelName: string, status: string, errorMessage?: string): Promise<void> {
    const model = this.aiModelStatuses.get(modelName);
    if (!model) return;

    const updatedModel = {
      ...model,
      status,
      errorMessage: errorMessage || null,
      lastHealthCheck: new Date(),
    };
    this.aiModelStatuses.set(modelName, updatedModel);
  }

  // Content reports
  async createContentReport(insertReport: InsertContentReport): Promise<ContentReport> {
    const id = randomUUID();
    const report: ContentReport = {
      ...insertReport,
      id,
      description: insertReport.description || null,
      status: "pending",
      reviewedBy: null,
      createdAt: new Date(),
      reviewedAt: null,
    };
    this.contentReports.set(id, report);
    return report;
  }

  async getContentReports(status?: string): Promise<ContentReport[]> {
    const reports = Array.from(this.contentReports.values());
    if (status) {
      return reports.filter(report => report.status === status);
    }
    return reports.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async updateContentReport(id: string, status: string, reviewedBy?: string): Promise<void> {
    const report = this.contentReports.get(id);
    if (!report) return;

    const updatedReport = {
      ...report,
      status,
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
    };
    this.contentReports.set(id, updatedReport);
  }

  // Analytics
  async getContentStats(): Promise<{
    totalProcessed: number;
    totalFlagged: number;
    totalBlocked: number;
    activeUsers: number;
  }> {
    const allPosts = Array.from(this.posts.values());
    const allComments = Array.from(this.comments.values());
    const allUsers = Array.from(this.users.values());

    const totalProcessed = allPosts.length + allComments.length;
    const totalFlagged = [...allPosts, ...allComments].filter(
      content => content.moderationStatus === "flagged"
    ).length;
    const totalBlocked = [...allPosts, ...allComments].filter(
      content => content.moderationStatus === "rejected"
    ).length;
    const activeUsers = allUsers.filter(user => user.isActive && !user.isBanned).length;

    return {
      totalProcessed,
      totalFlagged,
      totalBlocked,
      activeUsers,
    };
  }
}

export const storage = new MemStorage();
