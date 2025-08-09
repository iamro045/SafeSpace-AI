import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  reputationScore: real("reputation_score").default(5.0),
  role: text("role").default("user"), // user, moderator, admin
  isActive: boolean("is_active").default(true),
  isBanned: boolean("is_banned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Content posts
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  contentType: text("content_type").notNull(), // text, image, video
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  language: text("language").default("en"),
  isModerated: boolean("is_moderated").default(false),
  moderationStatus: text("moderation_status").default("pending"), // pending, approved, rejected, flagged
  moderationReason: text("moderation_reason"),
  aiConfidence: real("ai_confidence"),
  aiFlags: json("ai_flags"), // Array of detected issues
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Comments on posts
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  language: text("language").default("en"),
  isModerated: boolean("is_moderated").default(false),
  moderationStatus: text("moderation_status").default("pending"),
  moderationReason: text("moderation_reason"),
  aiConfidence: real("ai_confidence"),
  aiFlags: json("ai_flags"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Moderation actions log
export const moderationActions = pgTable("moderation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentId: varchar("content_id").notNull(),
  contentType: text("content_type").notNull(), // post, comment
  moderatorId: varchar("moderator_id").references(() => users.id),
  action: text("action").notNull(), // approve, reject, flag, ban_user
  reason: text("reason"),
  isAutomatic: boolean("is_automatic").default(false),
  aiModel: text("ai_model"),
  confidence: real("confidence"),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User reputation history
export const reputationHistory = pgTable("reputation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  previousScore: real("previous_score").notNull(),
  newScore: real("new_score").notNull(),
  change: real("change").notNull(),
  reason: text("reason").notNull(),
  contentId: varchar("content_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI model status
export const aiModelStatus = pgTable("ai_model_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelName: text("model_name").notNull().unique(),
  modelType: text("model_type").notNull(), // text, image, video
  status: text("status").notNull(), // active, loading, error, disabled
  version: text("version"),
  lastHealthCheck: timestamp("last_health_check").defaultNow(),
  errorMessage: text("error_message"),
  configuration: json("configuration"),
});

// Content flagging reports
export const contentReports = pgTable("content_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id),
  contentId: varchar("content_id").notNull(),
  contentType: text("content_type").notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  status: text("status").default("pending"), // pending, reviewed, dismissed
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertModerationActionSchema = createInsertSchema(moderationActions).omit({
  id: true,
  createdAt: true,
});

export const insertReputationHistorySchema = createInsertSchema(reputationHistory).omit({
  id: true,
  createdAt: true,
});

export const insertContentReportSchema = createInsertSchema(contentReports).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type ModerationAction = typeof moderationActions.$inferSelect;
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;
export type ReputationHistory = typeof reputationHistory.$inferSelect;
export type InsertReputationHistory = z.infer<typeof insertReputationHistorySchema>;
export type AIModelStatus = typeof aiModelStatus.$inferSelect;
export type ContentReport = typeof contentReports.$inferSelect;
export type InsertContentReport = z.infer<typeof insertContentReportSchema>;

// Content moderation types
export type ModerationStatus = "pending" | "approved" | "rejected" | "flagged";
export type ContentType = "text" | "image" | "video";
export type ActionType = "approve" | "reject" | "flag" | "ban_user";
