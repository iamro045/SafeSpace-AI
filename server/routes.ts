import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { moderationService } from "./services/moderationService";
import { reputationService } from "./services/reputationService";
import { aiService } from "./services/aiService";
import { modelTrainingService } from "./services/modelTrainingService";
import { abuseLexiconService } from "./services/abuseLexiconService";
import { trainedModelService } from "./services/trainedModelService";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import multer from "multer";
import { appConfig } from "./config";
import { ok, fail } from "./http";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

const getTokenFromAuthHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2) return null;
  if (parts[0].toLowerCase() !== "bearer") return null;
  return parts[1] || null;
};

const tryDecodeUser = (authHeader: string | undefined): any | null => {
  const token = getTokenFromAuthHeader(authHeader);
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
};

const safeText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
};

// Very small in-memory login rate limiter (per IP+email)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

function checkLoginRateLimit(key: string): { ok: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const existing = loginAttempts.get(key);

  if (!existing || existing.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return { ok: true };
  }

  if (existing.count >= MAX_LOGIN_ATTEMPTS) {
    return { ok: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  loginAttempts.set(key, existing);
  return { ok: true };
}

// Middleware for JWT authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = getTokenFromAuthHeader(authHeader);

  if (!token) {
    return fail(res, 401, "Access token required");
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return fail(res, 403, "Invalid token");
    }
    req.user = user;
    next();
  });
};

// Admin/Moderator role check
const requireModeratorRole = (req: any, res: any, next: any) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
    return fail(res, 403, "Moderator access required");
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsRoot));

  // Multer setup for images
  const imageUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.resolve(uploadsRoot, "images");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = file.mimetype === "image/png" ? ".png" : ".jpg";
        const safeName = (file.originalname || "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const name = `${Date.now()}-${safeName}${ext}`;
        cb(null, name);
      },
    }),
    limits: { fileSize: appConfig.uploads.maxImageBytes },
    fileFilter: (req, file, cb) => {
      if (!(appConfig.uploads.allowedImageMimeTypes as readonly string[]).includes(file.mimetype)) {
        return cb(new Error("Unsupported image format. Only JPG and PNG are allowed."));
      }
      cb(null, true);
    },
  });

  // Multer setup for videos
  const videoUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.resolve(uploadsRoot, "videos");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const originalExt = path.extname(file.originalname || "").toLowerCase();
        const extByMime: Record<string, string> = {
          "video/mp4": ".mp4",
          "video/webm": ".webm",
          "video/quicktime": ".mov",
        };
        const ext = extByMime[file.mimetype] || (originalExt || ".mp4");
        const safeName = (file.originalname || "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const name = `${Date.now()}-${safeName}${ext}`;
        cb(null, name);
      },
    }),
    limits: { fileSize: appConfig.uploads.maxVideoBytes },
    fileFilter: (req, file, cb) => {
      if (!(appConfig.uploads.allowedVideoMimeTypes as readonly string[]).includes(file.mimetype)) {
        return cb(new Error("Unsupported video format. Please upload an MP4, WebM, or MOV file."));
      }
      cb(null, true);
    },
  });

  // Multer setup for CSV datasets
  const csvUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.resolve(process.cwd(), "datasets", "text", "uploads");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase() || ".csv";
        const safeExt = ext === ".csv" || ext === ".tsv" || ext === ".txt" ? ext : ".csv";
        const name = `dataset-${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`;
        cb(null, name);
      },
    }),
    limits: { fileSize: appConfig.uploads.maxDatasetBytes },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const okByMime = ["text/csv", "application/vnd.ms-excel", "text/plain", "text/tab-separated-values"].includes(
        file.mimetype
      );
      const okByExt = ext === ".csv" || ext === ".tsv" || ext === ".txt";
      if (!okByMime && !okByExt) {
        return cb(new Error("Unsupported dataset format. Please upload a .csv, .tsv, or .txt file."));
      }
      cb(null, true);
    },
  });

  // App config (for frontend)
  app.get("/api/config", (req, res) => {
    return ok(res, {
      content: appConfig.content,
      uploads: {
        maxImageBytes: appConfig.uploads.maxImageBytes,
        allowedImageMimeTypes: appConfig.uploads.allowedImageMimeTypes,
        maxVideoBytes: appConfig.uploads.maxVideoBytes,
        allowedVideoMimeTypes: appConfig.uploads.allowedVideoMimeTypes,
        maxDatasetBytes: appConfig.uploads.maxDatasetBytes,
      },
      moderation: appConfig.moderation,
      reputation: appConfig.reputation,
    });
  });

  // Image upload
  app.post("/api/uploads/images", authenticateToken, (req, res, next) => {
    imageUpload.single("image")(req as any, res as any, (err: any) => {
      if (err) {
        return fail(res, 400, err.message || "Image upload failed");
      }
      next();
    });
  }, async (req: any, res) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return fail(res, 400, "Image file is required");

    const publicUrl = `/uploads/images/${file.filename}`;

    // Moderate the image immediately (before it is used in a post)
    // We don't have a contentId yet, so we return the decision to the client.
    const ai = await aiService.analyzeImage(publicUrl);
    return ok(res, {
      url: publicUrl,
      moderation: {
        classificationLabel: ai.classificationLabel,
        confidence: ai.confidence,
        severityScore: ai.severityScore,
        violationType: ai.violationType,
        contributingTerms: ai.contributingTerms,
        explanation: ai.explanation,
      },
    }, "Image uploaded");
  });

  // Video upload
  app.post("/api/uploads/videos", authenticateToken, (req, res, next) => {
    videoUpload.single("video")(req as any, res as any, (err: any) => {
      if (err) {
        if (err?.code === "LIMIT_FILE_SIZE") {
          const maxMb = Math.round(appConfig.uploads.maxVideoBytes / 1024 / 1024);
          return fail(res, 400, `Video file too large. Max size is ${maxMb}MB.`);
        }
        return fail(res, 400, err.message || "Video upload failed");
      }
      next();
    });
  }, async (req: any, res) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return fail(res, 400, "Video file is required");

    const publicUrl = `/uploads/videos/${file.filename}`;

    // Moderate the video immediately (before it is used in a post)
    // We don't have a contentId yet, so we return the decision to the client.
    try {
      const ai = await aiService.analyzeVideo(publicUrl);
      return ok(res, {
        url: publicUrl,
        moderation: {
          classificationLabel: ai.classificationLabel,
          confidence: ai.confidence,
          severityScore: ai.severityScore,
          violationType: ai.violationType,
          contributingTerms: ai.contributingTerms,
          explanation: ai.explanation,
        },
      }, "Video uploaded");
    } catch (error: any) {
      const message = error?.message || "Video analysis failed";
      return ok(res, {
        url: publicUrl,
        moderation: {
          classificationLabel: "error",
          confidence: 0,
          severityScore: 0,
          violationType: [],
          contributingTerms: [],
          explanation: `Video uploaded but requires review: ${message}`,
        },
      }, "Video uploaded");
    }
  });
  
  // ============================================
  // AUTHENTICATION ROUTES
  // ============================================
  
  // Register user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const username = safeText(req.body?.username);
      const email = safeText(req.body?.email);
      const password = safeText(req.body?.password);
      const firstName = safeText(req.body?.firstName) || null;
      const lastName = safeText(req.body?.lastName) || null;
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return fail(res, 400, "User already exists");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        profileImageUrl: null,
      });

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ok(res, { token, user: { ...user, password: undefined } }, "Registration successful");
    } catch (error) {
      console.error('Registration error:', error);
      return fail(res, 500, "Registration failed");
    }
  });

  // Login user
  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = safeText(req.body?.email);
      const password = safeText(req.body?.password);

      const key = `${req.ip || "unknown"}:${email}`;
      const rate = checkLoginRateLimit(key);
      if (!rate.ok) {
        res.setHeader("Retry-After", String(rate.retryAfterSeconds ?? 60));
        return fail(res, 429, "Too many login attempts. Try again later.");
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return fail(res, 401, "Invalid credentials");
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return fail(res, 401, "Invalid credentials");
      }

      if (user.isBanned) {
        return fail(res, 403, "Account is banned");
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return ok(res, { token, user: { ...user, password: undefined } }, "Login successful");
    } catch (error) {
      console.error('Login error:', error);
      return fail(res, 500, "Login failed");
    }
  });

  // Get current user
  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return fail(res, 404, "User not found");
      }
      return ok(res, { ...user, password: undefined });
    } catch (error) {
      return fail(res, 500, "Failed to get user info");
    }
  });

  // ============================================
  // CONTENT MANAGEMENT ROUTES
  // ============================================

  // Create post
  app.post('/api/posts', authenticateToken, async (req: any, res) => {
    try {
      const urlLike = z.string().min(1).refine(
        (v) => /^https?:\/\//i.test(v) || v.startsWith("/"),
        { message: "Invalid url" }
      );

      const schema = z.object({
        content: z.string().min(1),
        contentType: z.enum(["text", "image", "video"]).default("text"),
        imageUrl: urlLike.optional().nullable(),
        videoUrl: urlLike.optional().nullable(),
        language: z.string().optional().nullable(),
      });

      const parsed = schema.parse({
        content: safeText(req.body?.content),
        contentType: req.body?.contentType ?? "text",
        imageUrl: req.body?.imageUrl ?? null,
        videoUrl: req.body?.videoUrl ?? null,
        language: req.body?.language ?? null,
      });

      if (parsed.content.length > appConfig.content.textCharLimit) {
        return fail(res, 400, `Post exceeds character limit (${appConfig.content.textCharLimit})`);
      }

      // Create as pending and moderate synchronously before returning.
      const post = await storage.createPost({
        userId: req.user.userId,
        content: parsed.content,
        contentType: parsed.contentType,
        imageUrl: parsed.imageUrl || null,
        videoUrl: parsed.videoUrl || null,
        language: parsed.language || "en",
      });

      const decisions: any[] = [];

      if (parsed.contentType === "text" || parsed.contentType === "video" || parsed.contentType === "image") {
        const textDecision = await moderationService.moderateTextContent(post.id, parsed.content, "post", req.user.userId, parsed.language || "en");
        decisions.push({ type: "text", ...textDecision });
      }

      if (parsed.imageUrl) {
        const imageDecision = await moderationService.moderateImageContent(post.id, parsed.imageUrl, "post", req.user.userId);
        decisions.push({ type: "image", ...imageDecision });
      }

      if (parsed.videoUrl) {
        const videoDecision = await moderationService.moderateVideoContent(post.id, parsed.videoUrl, "post", req.user.userId);
        decisions.push({ type: "video", ...videoDecision });
      }

      const updatedPost = await storage.getPost(post.id);
      return ok(res, { post: updatedPost, decisions }, "Post submitted");
    } catch (error) {
      console.error('Error creating post:', error);
      if (error instanceof z.ZodError) {
        return fail(res, 400, "Invalid request", error.flatten());
      }
      return fail(res, 500, "Failed to create post");
    }
  });

  // Get all posts
  app.get('/api/posts', async (req, res) => {
    try {
      const posts = await storage.getAllPosts();

      const user = tryDecodeUser(req.headers.authorization);
      const isModerator = user?.role === "admin" || user?.role === "moderator";
      const userId = user?.userId as string | undefined;

      // Public feed: only approved posts.
      // Authenticated users: see their own posts too.
      // Moderators: see everything.
      const filteredPosts = posts.filter((post) => {
        if (isModerator) return true;
        if (post.moderationStatus === "approved") return true;
        if (userId && post.userId === userId) return true;
        return false;
      });

      // Enrich with user data
      const postsWithUsers = await Promise.all(
        filteredPosts.map(async (post) => {
          const user = await storage.getUser(post.userId);
          const comments = await storage.getCommentsByPost(post.id);
          const visibleComments = isModerator
            ? comments
            : comments.filter((c) => c.moderationStatus === "approved" || (userId && c.userId === userId));

          return {
            ...post,
            user: user ? { ...user, password: undefined } : null,
            commentCount: visibleComments.length,
            comments: undefined,
          };
        })
      );

      // Reach limitation: deprioritize low-rep users in public feed
      const sorted = postsWithUsers.sort((a: any, b: any) => {
        const aScore = a.user?.reputationScore ?? 5;
        const bScore = b.user?.reputationScore ?? 5;
        const aLow = aScore < appConfig.reputation.deprioritizeBelow ? 1 : 0;
        const bLow = bScore < appConfig.reputation.deprioritizeBelow ? 1 : 0;
        if (aLow !== bLow) return aLow - bLow;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }).filter((p: any) => {
        if (isModerator) return true;
        const score = p.user?.reputationScore ?? 5;
        return score >= appConfig.reputation.hideBelow;
      });

      return ok(res, sorted);
    } catch (error) {
      console.error('Error getting posts:', error);
      return fail(res, 500, "Failed to get posts");
    }
  });

  // Get single post
  app.get('/api/posts/:id', async (req, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) {
        return fail(res, 404, "Post not found");
      }

      const user = await storage.getUser(post.userId);
      const comments = await storage.getCommentsByPost(post.id);

      const requester = tryDecodeUser(req.headers.authorization);
      const isModerator = requester?.role === "admin" || requester?.role === "moderator";
      const requesterId = requester?.userId as string | undefined;
      
      // Enrich comments with user data
      const commentsWithUsers = await Promise.all(
        comments
          .filter((comment) => {
            if (isModerator) return true;
            if (comment.moderationStatus === "approved") return true;
            if (requesterId && comment.userId === requesterId) return true;
            return false;
          })
          .map(async (comment) => {
          const commentUser = await storage.getUser(comment.userId);
          return { 
            ...comment, 
            user: commentUser ? { ...commentUser, password: undefined } : null
          };
        })
      );

      return ok(res, {
        ...post, 
        user: user ? { ...user, password: undefined } : null,
        comments: commentsWithUsers
      });
    } catch (error) {
      console.error('Error getting post:', error);
      return fail(res, 500, "Failed to get post");
    }
  });

  // Create comment
  app.post('/api/posts/:postId/comments', authenticateToken, async (req: any, res) => {
    try {
      const { postId } = req.params;

      const schema = z.object({
        content: z.string().min(1),
        language: z.string().optional().nullable(),
      });

      const parsed = schema.parse({
        content: safeText(req.body?.content),
        language: req.body?.language ?? null,
      });

      if (parsed.content.length > appConfig.content.commentCharLimit) {
        return fail(res, 400, `Comment exceeds character limit (${appConfig.content.commentCharLimit})`);
      }

      const comment = await storage.createComment({
        postId,
        userId: req.user.userId,
        content: parsed.content,
        language: parsed.language || 'en',
      });

      // Auto-moderate the comment
      const decision = await moderationService.moderateTextContent(comment.id, parsed.content, 'comment', req.user.userId, parsed.language || 'en');

      const user = await storage.getUser(req.user.userId);
      const updated = await storage.getComment(comment.id);
      return ok(res, {
        comment: { ...updated, user: user ? { ...user, password: undefined } : null },
        decision,
      }, "Comment submitted");
    } catch (error) {
      console.error('Error creating comment:', error);
      if (error instanceof z.ZodError) {
        return fail(res, 400, "Invalid request", error.flatten());
      }
      return fail(res, 500, "Failed to create comment");
    }
  });

  // ============================================
  // MODERATION ROUTES
  // ============================================

  // Get/update abuse lexicon (moderator only)
  app.get('/api/moderation/lexicon', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const lexicon = await abuseLexiconService.getLexicon();
      return ok(res, lexicon);
    } catch (error) {
      console.error('Error getting lexicon:', error);
      return fail(res, 500, 'Failed to get lexicon');
    }
  });

  app.put('/api/moderation/lexicon', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const blockTerms = Array.isArray(req.body?.blockTerms) ? req.body.blockTerms : [];
      const reviewTerms = Array.isArray(req.body?.reviewTerms) ? req.body.reviewTerms : [];

      const updated = await abuseLexiconService.updateLexicon({ blockTerms, reviewTerms });
      return ok(res, updated, 'Lexicon updated');
    } catch (error) {
      console.error('Error updating lexicon:', error);
      return fail(res, 500, 'Failed to update lexicon');
    }
  });

  // Get pending content for moderation
  app.get('/api/moderation/pending', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const pendingContent = await moderationService.getPendingContent();
      return ok(res, pendingContent);
    } catch (error) {
      console.error('Error getting pending content:', error);
      return fail(res, 500, "Failed to get pending content");
    }
  });

  // Manual moderation action
  app.post('/api/moderation/action', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const { contentId, contentType, action, reason } = req.body;
      
      await moderationService.manualModerationAction(
        contentId,
        contentType,
        action,
        req.user.userId,
        reason
      );

      return ok(res, { completed: true }, "Moderation action completed");
    } catch (error) {
      console.error('Error in moderation action:', error);
      return fail(res, 500, "Failed to complete moderation action");
    }
  });

  // Get moderation statistics
  app.get('/api/moderation/stats', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const stats = await moderationService.getModerationStats();
      return ok(res, stats);
    } catch (error) {
      console.error('Error getting moderation stats:', error);
      return fail(res, 500, "Failed to get moderation stats");
    }
  });

  // Get recent moderation actions
  app.get('/api/moderation/actions', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const actions = await storage.getModerationActions(50);
      
      // Enrich with content and user data
      const enrichedActions = await Promise.all(
        actions.map(async (action) => {
          let content = null;
          let user = null;

          if (action.contentType === "post") {
            content = await storage.getPost(action.contentId);
          } else {
            content = await storage.getComment(action.contentId);
          }

          if (content) {
            user = await storage.getUser(content.userId);
          }

          return { 
            ...action, 
            content, 
            user: user ? { ...user, password: undefined } : null
          };
        })
      );

      return ok(res, enrichedActions);
    } catch (error) {
      console.error('Error getting moderation actions:', error);
      return fail(res, 500, "Failed to get moderation actions");
    }
  });

  // Export moderation logs as CSV
  app.get('/api/moderation/actions/export', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const actions = await storage.getModerationActions(5000);
      const headers = [
        "timestamp",
        "contentId",
        "contentType",
        "moderatorId",
        "action",
        "confidence",
        "reason",
      ];

      const rows = actions.map((a) => [
        (a.createdAt ? new Date(a.createdAt).toISOString() : ""),
        a.contentId,
        a.contentType,
        a.moderatorId ?? "",
        a.action,
        a.confidence ?? "",
        (a.reason ?? "").replace(/\r?\n/g, " "),
      ]);

      const escapeCell = (v: any) => {
        const s = String(v ?? "");
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };

      const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=moderation-actions.csv");
      return res.status(200).send(csv);
    } catch (error) {
      console.error('Error exporting moderation actions:', error);
      return fail(res, 500, "Failed to export moderation actions");
    }
  });

  // Export manually reviewed text as a training dataset (CSV)
  app.get('/api/moderation/training/export-text', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const actions = await storage.getModerationActions(5000);
      const manual = actions.filter((a) => !a.isAutomatic && (a.action === 'approve' || a.action === 'reject'));

      const headers = ["text", "label", "language", "sourceActionId", "timestamp", "contentType", "contentId"];

      const rows: Array<string[]> = [];
      for (const a of manual) {
        const content = a.contentType === 'post' ? await storage.getPost(a.contentId) : await storage.getComment(a.contentId);
        if (!content) continue;

        const text = (content as any).content ?? "";
        const language = (content as any).language ?? "en";

        let label = "clean";
        if (a.action === 'reject') {
          const details = (a.details && typeof a.details === 'object') ? (a.details as any) : null;
          const vt = Array.isArray(details?.violationType) ? details.violationType : null;
          label = (vt && typeof vt[0] === 'string' && vt[0]) ? String(vt[0]) : "hate_speech";
        }

        rows.push([
          String(text).replace(/\r?\n/g, " "),
          label,
          String(language),
          String(a.id),
          a.createdAt ? new Date(a.createdAt).toISOString() : "",
          String(a.contentType),
          String(a.contentId),
        ]);
      }

      const escapeCell = (v: any) => {
        const s = String(v ?? "");
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };

      const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=manual-review-training-text.csv");
      return res.status(200).send(csv);
    } catch (error) {
      console.error('Error exporting training text:', error);
      return fail(res, 500, 'Failed to export training dataset');
    }
  });

  // ============================================
  // USER MANAGEMENT ROUTES
  // ============================================

  // Get all users (admin only)
  app.get('/api/users', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(user => ({ ...user, password: undefined }));
      return ok(res, usersWithoutPasswords);
    } catch (error) {
      console.error('Error getting users:', error);
      return fail(res, 500, "Failed to get users");
    }
  });

  // Update user (ban/unban)
  app.patch('/api/users/:userId', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      const updatedUser = await storage.updateUser(userId, updates);
      if (!updatedUser) {
        return fail(res, 404, "User not found");
      }

      return ok(res, { ...updatedUser, password: undefined }, "User updated");
    } catch (error) {
      console.error('Error updating user:', error);
      return fail(res, 500, "Failed to update user");
    }
  });

  // ============================================
  // REPUTATION ROUTES
  // ============================================

  // Get reputation insights
  app.get('/api/reputation/insights', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const insights = await reputationService.getReputationInsights();
      return ok(res, insights);
    } catch (error) {
      console.error('Error getting reputation insights:', error);
      return fail(res, 500, "Failed to get reputation insights");
    }
  });

  // Get reputation configuration
  app.get('/api/reputation/config', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const config = reputationService.getReputationConfig();
      return ok(res, config);
    } catch (error) {
      console.error('Error getting reputation config:', error);
      return fail(res, 500, "Failed to get reputation config");
    }
  });

  // ============================================
  // AI MODEL ROUTES
  // ============================================

  // List uploaded text datasets (manifest)
  app.get('/api/datasets/text', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const datasets = await modelTrainingService.listTextDatasets();
      return ok(res, datasets);
    } catch (error) {
      console.error('Error listing text datasets:', error);
      return fail(res, 500, 'Failed to list datasets');
    }
  });

  // Train text model from a CSV dataset upload
  app.post('/api/ai/train/text', authenticateToken, requireModeratorRole, (req, res, next) => {
    csvUpload.single('dataset')(req as any, res as any, (err: any) => {
      if (err) {
        return fail(res, 400, err.message || 'Dataset upload failed');
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return fail(res, 400, 'Dataset file is required');

      const datasetName = safeText(req.body?.datasetName) || file.originalname || 'Text dataset';

      const result = await modelTrainingService.trainTextModelFromCsvFile({
        filePath: file.path,
        datasetName,
        originalFilename: file.originalname,
      });

      await storage.updateAIModelInfo('Text Analysis', {
        status: 'active',
        errorMessage: null,
        version: result.modelVersion,
        configuration: {
          trainedAt: result.trainedAt,
          vocabularySize: result.vocabularySize,
          holdoutAccuracy: result.holdoutAccuracy,
          rowCount: result.rowCount,
          labelCounts: result.labelCounts,
          dataset: { id: result.dataset.id, name: result.dataset.name, uploadedAt: result.dataset.uploadedAt },
        },
      });

      return ok(res, result, 'Training complete');
    } catch (error: any) {
      console.error('Error training text model:', error);
      await storage.updateAIModelInfo('Text Analysis', {
        status: 'error',
        errorMessage: error?.message || 'Training failed',
      });
      return fail(res, 500, 'Training failed', error?.message);
    }
  });

  // List text model versions available on disk
  app.get('/api/ai/text-models', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const models = await modelTrainingService.listTextModels(25);
      return ok(res, models);
    } catch (error) {
      console.error('Error listing text models:', error);
      return fail(res, 500, 'Failed to list text models');
    }
  });

  // Activate a specific model version (rollback)
  app.post('/api/ai/text-models/activate', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const version = safeText(req.body?.modelVersion);
      if (!version) return fail(res, 400, 'modelVersion is required');

      await modelTrainingService.activateTextModelVersion(version);
      trainedModelService.clearCache();

      await storage.updateAIModelInfo('Text Analysis', {
        status: 'active',
        errorMessage: null,
        version,
      });

      return ok(res, { activated: true, modelVersion: version }, 'Text model activated');
    } catch (error: any) {
      console.error('Error activating text model:', error);
      return fail(res, 500, 'Failed to activate text model', error?.message);
    }
  });

  // Get AI model status
  app.get('/api/ai/models', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const models = await storage.getAIModelStatus();
      return ok(res, models);
    } catch (error) {
      console.error('Error getting AI models:', error);
      return fail(res, 500, "Failed to get AI models");
    }
  });

  // Check AI model health
  app.post('/api/ai/health-check', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const { modelName } = req.body;
      const health = await aiService.checkModelHealth(modelName);
      
      // Update model status in storage
      await storage.updateAIModelStatus(modelName, health.status, health.message);
      
      return ok(res, health, "Health check complete");
    } catch (error) {
      console.error('Error checking AI model health:', error);
      return fail(res, 500, "Failed to check AI model health");
    }
  });

  // ============================================
  // ANALYTICS ROUTES
  // ============================================

  // Get dashboard analytics
  app.get('/api/analytics/dashboard', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const stats = await storage.getContentStats();
      const recentActions = await storage.getModerationActions(10);
      const aiModels = await storage.getAIModelStatus();
      const reputationInsights = await reputationService.getReputationInsights();

      // Calculate language distribution (mock data for demo)
      const languageDistribution = {
        en: 68,
        hi: 24,
        ta: 5,
        other: 3,
      };

      // Calculate content type distribution
      const allPosts = await storage.getAllPosts();
      const contentTypeDistribution = {
        text: allPosts.filter(p => p.contentType === 'text').length,
        image: allPosts.filter(p => p.contentType === 'image').length,
        video: allPosts.filter(p => p.contentType === 'video').length,
      };

      // Calculate detection insights
      const flaggedPosts = await storage.getPostsForModeration('flagged');
      const rejectedPosts = await storage.getPostsForModeration('rejected');
      const flaggedComments = await storage.getCommentsForModeration('flagged');
      const rejectedComments = await storage.getCommentsForModeration('rejected');

      const allFlagged = [...flaggedPosts, ...rejectedPosts, ...flaggedComments, ...rejectedComments];
      
      // Analyze violation types
      const violationTypes = allFlagged.reduce((acc, content) => {
        if (content.aiFlags && Array.isArray(content.aiFlags)) {
          content.aiFlags.forEach((flag: string) => {
            acc[flag] = (acc[flag] || 0) + 1;
          });
        }
        return acc;
      }, {} as Record<string, number>);

      const totalContent = stats.totalProcessed || 1;
      const detectionInsights = Object.entries(violationTypes).map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / totalContent) * 100),
      }));

      return ok(res, {
        stats,
        recentActions,
        aiModels,
        reputationInsights,
        languageDistribution,
        contentTypeDistribution,
        detectionInsights,
      });
    } catch (error) {
      console.error('Error getting dashboard analytics:', error);
      return fail(res, 500, "Failed to get dashboard analytics");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
