import {
  users,
  posts,
  comments,
  moderationActions,
  reputationHistory,
  aiModelStatus as aiModelStatusTable,
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
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";
import bcrypt from "bcrypt";
import type { IStorage } from "./storage";

export class PgStorage implements IStorage {
  private initialized = false;

  constructor() {
    this.initialize().catch(console.error);
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if we need to initialize default data
      const existingUsers = await db.select().from(users);
      
      if (existingUsers.length === 0) {
        // Create default users
        const hashedAdminPassword = await bcrypt.hash("admin", 10);
        const hashedModPassword = await bcrypt.hash("moderator", 10);
        const hashedUserPassword = await bcrypt.hash("user", 10);

        await db.insert(users).values([
          {
            username: "admin",
            email: "admin@projectclean.com",
            password: hashedAdminPassword,
            firstName: "Sarah",
            lastName: "Johnson",
            profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=32&h=32",
            reputationScore: 5.0,
            role: "admin",
            isActive: true,
            isBanned: false,
          },
          {
            username: "moderator",
            email: "moderator@projectclean.com",
            password: hashedModPassword,
            firstName: "John",
            lastName: "Smith",
            profileImageUrl: null,
            reputationScore: 5.0,
            role: "moderator",
            isActive: true,
            isBanned: false,
          },
          {
            username: "demouser",
            email: "user@projectclean.com",
            password: hashedUserPassword,
            firstName: "Alex",
            lastName: "Chen",
            profileImageUrl: null,
            reputationScore: 4.5,
            role: "user",
            isActive: true,
            isBanned: false,
          },
        ]);

        // Create default AI model statuses
        await db.insert(aiModelStatusTable).values([
          {
            modelName: "Text Analysis",
            modelType: "text",
            status: "active",
            version: "1.0",
            lastHealthCheck: new Date(),
            errorMessage: null,
            configuration: { language: ["en", "hi"], threshold: 0.7 },
          },
          {
            modelName: "Image Detection",
            modelType: "image",
            status: "active",
            version: "1.0",
            lastHealthCheck: new Date(),
            errorMessage: null,
            configuration: { nsfw_threshold: 0.8, face_detection: true },
          },
          {
            modelName: "Video Analysis",
            modelType: "video",
            status: "loading",
            version: "1.0",
            lastHealthCheck: new Date(),
            errorMessage: null,
            configuration: { frame_analysis: true, audio_detection: false },
          },
        ]);
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      reputationScore: insertUser.reputationScore || 5.0,
      role: insertUser.role || "user",
      isActive: insertUser.isActive !== undefined ? insertUser.isActive : true,
      isBanned: insertUser.isBanned !== undefined ? insertUser.isBanned : false,
    }).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async updateUserReputation(id: string, newScore: number): Promise<void> {
    const user = await this.getUser(id);
    if (!user) return;

    const previousScore = user.reputationScore || 5.0;
    const change = newScore - previousScore;

    await this.updateUser(id, { reputationScore: newScore });
    await this.createReputationHistory({
      userId: id,
      previousScore,
      newScore,
      change,
      reason: "Content moderation action",
    });
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUsersWithLowReputation(threshold: number = 2.0): Promise<User[]> {
    return await db.select().from(users).where(sql`${users.reputationScore} < ${threshold}`);
  }

  // Post operations
  async createPost(insertPost: InsertPost): Promise<Post> {
    const result = await db.insert(posts).values({
      ...insertPost,
      imageUrl: insertPost.imageUrl || null,
      videoUrl: insertPost.videoUrl || null,
      language: insertPost.language || "en",
      isModerated: insertPost.isModerated || false,
      moderationStatus: insertPost.moderationStatus || "pending",
      moderationReason: insertPost.moderationReason || null,
      aiConfidence: insertPost.aiConfidence || null,
      aiFlags: insertPost.aiFlags || null,
    }).returning();
    return result[0];
  }

  async getPost(id: string): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id));
    return result[0];
  }

  async getPostsByUser(userId: string): Promise<Post[]> {
    return await db.select().from(posts).where(eq(posts.userId, userId)).orderBy(desc(posts.createdAt));
  }

  async getAllPosts(): Promise<Post[]> {
    return await db.select().from(posts).orderBy(desc(posts.createdAt));
  }

  async getPostsForModeration(status?: string): Promise<Post[]> {
    if (status) {
      return await db.select().from(posts).where(eq(posts.moderationStatus, status));
    }
    return await db.select().from(posts).where(eq(posts.isModerated, false));
  }

  async updatePostModerationStatus(
    id: string,
    status: string,
    reason?: string,
    aiConfidence?: number,
    aiFlags?: any
  ): Promise<void> {
    await db.update(posts)
      .set({
        moderationStatus: status,
        moderationReason: reason || null,
        aiConfidence: aiConfidence || null,
        aiFlags: aiFlags || null,
        isModerated: true,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }

  // Comment operations
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values({
      ...insertComment,
      isModerated: insertComment.isModerated || false,
      moderationStatus: insertComment.moderationStatus || "pending",
      moderationReason: insertComment.moderationReason || null,
      aiConfidence: insertComment.aiConfidence || null,
      aiFlags: insertComment.aiFlags || null,
    }).returning();
    return result[0];
  }

  async getComment(id: string): Promise<Comment | undefined> {
    const result = await db.select().from(comments).where(eq(comments.id, id));
    return result[0];
  }

  async getCommentsByPost(postId: string): Promise<Comment[]> {
    return await db.select().from(comments).where(eq(comments.postId, postId)).orderBy(desc(comments.createdAt));
  }

  async getCommentsForModeration(status?: string): Promise<Comment[]> {
    if (status) {
      return await db.select().from(comments).where(eq(comments.moderationStatus, status));
    }
    return await db.select().from(comments).where(eq(comments.isModerated, false));
  }

  async updateCommentModerationStatus(
    id: string,
    status: string,
    reason?: string,
    aiConfidence?: number,
    aiFlags?: any
  ): Promise<void> {
    await db.update(comments)
      .set({
        moderationStatus: status,
        moderationReason: reason || null,
        aiConfidence: aiConfidence || null,
        aiFlags: aiFlags || null,
        isModerated: true,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, id));
  }

  // Moderation operations
  async createModerationAction(insertAction: InsertModerationAction): Promise<ModerationAction> {
    const result = await db.insert(moderationActions).values({
      ...insertAction,
      moderatorId: insertAction.moderatorId || null,
      reason: insertAction.reason || null,
      isAutomatic: insertAction.isAutomatic || false,
      aiModel: insertAction.aiModel || null,
      confidence: insertAction.confidence || null,
      details: insertAction.details || null,
    }).returning();
    return result[0];
  }

  async getModerationActions(limit?: number): Promise<ModerationAction[]> {
    if (limit) {
      return await db.select().from(moderationActions).orderBy(desc(moderationActions.createdAt)).limit(limit);
    }
    return await db.select().from(moderationActions).orderBy(desc(moderationActions.createdAt));
  }

  async getLatestModerationActionForContent(
    contentId: string,
    contentType: "post" | "comment"
  ): Promise<ModerationAction | undefined> {
    const result = await db
      .select()
      .from(moderationActions)
      .where(and(eq(moderationActions.contentId, contentId), eq(moderationActions.contentType, contentType)))
      .orderBy(desc(moderationActions.createdAt))
      .limit(1);
    return result[0];
  }

  async getModerationActionsByModerator(moderatorId: string): Promise<ModerationAction[]> {
    return await db.select().from(moderationActions)
      .where(eq(moderationActions.moderatorId, moderatorId))
      .orderBy(desc(moderationActions.createdAt));
  }

  // Reputation operations
  async createReputationHistory(insertHistory: InsertReputationHistory): Promise<ReputationHistory> {
    const result = await db.insert(reputationHistory).values({
      ...insertHistory,
      contentId: insertHistory.contentId || null,
    }).returning();
    return result[0];
  }

  async getReputationHistoryByUser(userId: string): Promise<ReputationHistory[]> {
    return await db.select().from(reputationHistory)
      .where(eq(reputationHistory.userId, userId))
      .orderBy(desc(reputationHistory.createdAt));
  }

  // AI Model operations
  async getAIModelStatus(): Promise<AIModelStatus[]> {
    return await db.select().from(aiModelStatusTable);
  }

  async updateAIModelStatus(modelName: string, status: string, errorMessage?: string): Promise<void> {
    await db.update(aiModelStatusTable)
      .set({
        status,
        errorMessage: errorMessage || null,
        lastHealthCheck: new Date(),
      })
      .where(eq(aiModelStatusTable.modelName, modelName));
  }

  async updateAIModelInfo(modelName: string, updates: { status?: string; errorMessage?: string | null; version?: string | null; configuration?: any }): Promise<void> {
    await db.update(aiModelStatusTable)
      .set({
        status: updates.status,
        errorMessage: updates.errorMessage,
        version: updates.version,
        configuration: updates.configuration,
        lastHealthCheck: new Date(),
      })
      .where(eq(aiModelStatusTable.modelName, modelName));
  }

  // Content reports
  async createContentReport(insertReport: InsertContentReport): Promise<ContentReport> {
    const result = await db.insert(contentReports).values({
      ...insertReport,
      description: insertReport.description || null,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
    }).returning();
    return result[0];
  }

  async getContentReports(status?: string): Promise<ContentReport[]> {
    if (status) {
      return await db.select().from(contentReports)
        .where(eq(contentReports.status, status))
        .orderBy(desc(contentReports.createdAt));
    }
    return await db.select().from(contentReports).orderBy(desc(contentReports.createdAt));
  }

  async updateContentReport(id: string, status: string, reviewedBy?: string): Promise<void> {
    await db.update(contentReports)
      .set({
        status,
        reviewedBy: reviewedBy || null,
        reviewedAt: new Date(),
      })
      .where(eq(contentReports.id, id));
  }

  // Analytics
  async getContentStats(): Promise<{
    totalProcessed: number;
    totalFlagged: number;
    totalBlocked: number;
    activeUsers: number;
  }> {
    const [postsCount, commentsCount, flaggedPosts, flaggedComments, blockedPosts, blockedComments, activeUsersCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(posts),
      db.select({ count: sql<number>`count(*)::int` }).from(comments),
      db.select({ count: sql<number>`count(*)::int` }).from(posts).where(eq(posts.moderationStatus, "flagged")),
      db.select({ count: sql<number>`count(*)::int` }).from(comments).where(eq(comments.moderationStatus, "flagged")),
      db.select({ count: sql<number>`count(*)::int` }).from(posts).where(eq(posts.moderationStatus, "rejected")),
      db.select({ count: sql<number>`count(*)::int` }).from(comments).where(eq(comments.moderationStatus, "rejected")),
      db.select({ count: sql<number>`count(*)::int` }).from(users).where(and(eq(users.isActive, true), eq(users.isBanned, false))),
    ]);

    return {
      totalProcessed: (postsCount[0]?.count || 0) + (commentsCount[0]?.count || 0),
      totalFlagged: (flaggedPosts[0]?.count || 0) + (flaggedComments[0]?.count || 0),
      totalBlocked: (blockedPosts[0]?.count || 0) + (blockedComments[0]?.count || 0),
      activeUsers: activeUsersCount[0]?.count || 0,
    };
  }
}
