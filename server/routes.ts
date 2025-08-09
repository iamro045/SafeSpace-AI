import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { moderationService } from "./services/moderationService";
import { reputationService } from "./services/reputationService";
import { aiService } from "./services/aiService";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware for JWT authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin/Moderator role check
const requireModeratorRole = (req: any, res: any, next: any) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
    return res.status(403).json({ message: 'Moderator access required' });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ============================================
  // AUTHENTICATION ROUTES
  // ============================================
  
  // Register user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password, firstName, lastName } = req.body;
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
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

      res.json({ token, user: { ...user, password: undefined } });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  });

  // Login user
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (user.isBanned) {
        return res.status(403).json({ message: 'Account is banned' });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ token, user: { ...user, password: undefined } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  });

  // Get current user
  app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get user info' });
    }
  });

  // ============================================
  // CONTENT MANAGEMENT ROUTES
  // ============================================

  // Create post
  app.post('/api/posts', authenticateToken, async (req: any, res) => {
    try {
      const { content, contentType, imageUrl, videoUrl, language } = req.body;
      
      const post = await storage.createPost({
        userId: req.user.userId,
        content,
        contentType: contentType || 'text',
        imageUrl,
        videoUrl,
        language: language || 'en',
      });

      // Auto-moderate the post
      if (contentType === 'text' || !contentType) {
        await moderationService.moderateTextContent(post.id, content, 'post', req.user.userId, language);
      }
      
      if (imageUrl) {
        await moderationService.moderateImageContent(post.id, imageUrl, 'post', req.user.userId);
      }

      res.json(post);
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).json({ message: 'Failed to create post' });
    }
  });

  // Get all posts
  app.get('/api/posts', async (req, res) => {
    try {
      const posts = await storage.getAllPosts();
      
      // Only return approved posts for non-moderators
      const filteredPosts = posts.filter(post => 
        post.moderationStatus === 'approved' || 
        req.headers.authorization // If authenticated, might be moderator
      );

      // Enrich with user data
      const postsWithUsers = await Promise.all(
        filteredPosts.map(async (post) => {
          const user = await storage.getUser(post.userId);
          const comments = await storage.getCommentsByPost(post.id);
          return { 
            ...post, 
            user: user ? { ...user, password: undefined } : null,
            commentCount: comments.length
          };
        })
      );

      res.json(postsWithUsers);
    } catch (error) {
      console.error('Error getting posts:', error);
      res.status(500).json({ message: 'Failed to get posts' });
    }
  });

  // Get single post
  app.get('/api/posts/:id', async (req, res) => {
    try {
      const post = await storage.getPost(req.params.id);
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const user = await storage.getUser(post.userId);
      const comments = await storage.getCommentsByPost(post.id);
      
      // Enrich comments with user data
      const commentsWithUsers = await Promise.all(
        comments.map(async (comment) => {
          const commentUser = await storage.getUser(comment.userId);
          return { 
            ...comment, 
            user: commentUser ? { ...commentUser, password: undefined } : null
          };
        })
      );

      res.json({ 
        ...post, 
        user: user ? { ...user, password: undefined } : null,
        comments: commentsWithUsers
      });
    } catch (error) {
      console.error('Error getting post:', error);
      res.status(500).json({ message: 'Failed to get post' });
    }
  });

  // Create comment
  app.post('/api/posts/:postId/comments', authenticateToken, async (req: any, res) => {
    try {
      const { content, language } = req.body;
      const { postId } = req.params;

      const comment = await storage.createComment({
        postId,
        userId: req.user.userId,
        content,
        language: language || 'en',
      });

      // Auto-moderate the comment
      await moderationService.moderateTextContent(comment.id, content, 'comment', req.user.userId, language);

      const user = await storage.getUser(req.user.userId);
      res.json({ 
        ...comment, 
        user: user ? { ...user, password: undefined } : null
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ message: 'Failed to create comment' });
    }
  });

  // ============================================
  // MODERATION ROUTES
  // ============================================

  // Get pending content for moderation
  app.get('/api/moderation/pending', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const pendingContent = await moderationService.getPendingContent();
      res.json(pendingContent);
    } catch (error) {
      console.error('Error getting pending content:', error);
      res.status(500).json({ message: 'Failed to get pending content' });
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

      res.json({ message: 'Moderation action completed' });
    } catch (error) {
      console.error('Error in moderation action:', error);
      res.status(500).json({ message: 'Failed to complete moderation action' });
    }
  });

  // Get moderation statistics
  app.get('/api/moderation/stats', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const stats = await moderationService.getModerationStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting moderation stats:', error);
      res.status(500).json({ message: 'Failed to get moderation stats' });
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

      res.json(enrichedActions);
    } catch (error) {
      console.error('Error getting moderation actions:', error);
      res.status(500).json({ message: 'Failed to get moderation actions' });
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
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({ message: 'Failed to get users' });
    }
  });

  // Update user (ban/unban)
  app.patch('/api/users/:userId', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;
      
      const updatedUser = await storage.updateUser(userId, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ ...updatedUser, password: undefined });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  // ============================================
  // REPUTATION ROUTES
  // ============================================

  // Get reputation insights
  app.get('/api/reputation/insights', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const insights = await reputationService.getReputationInsights();
      res.json(insights);
    } catch (error) {
      console.error('Error getting reputation insights:', error);
      res.status(500).json({ message: 'Failed to get reputation insights' });
    }
  });

  // Get reputation configuration
  app.get('/api/reputation/config', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const config = reputationService.getReputationConfig();
      res.json(config);
    } catch (error) {
      console.error('Error getting reputation config:', error);
      res.status(500).json({ message: 'Failed to get reputation config' });
    }
  });

  // ============================================
  // AI MODEL ROUTES
  // ============================================

  // Get AI model status
  app.get('/api/ai/models', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const models = await storage.getAIModelStatus();
      res.json(models);
    } catch (error) {
      console.error('Error getting AI models:', error);
      res.status(500).json({ message: 'Failed to get AI models' });
    }
  });

  // Check AI model health
  app.post('/api/ai/health-check', authenticateToken, requireModeratorRole, async (req: any, res) => {
    try {
      const { modelName } = req.body;
      const health = await aiService.checkModelHealth(modelName);
      
      // Update model status in storage
      await storage.updateAIModelStatus(modelName, health.status, health.message);
      
      res.json(health);
    } catch (error) {
      console.error('Error checking AI model health:', error);
      res.status(500).json({ message: 'Failed to check AI model health' });
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

      const total = Object.values(violationTypes).reduce((sum, count) => sum + count, 0) || 1;
      const detectionInsights = Object.entries(violationTypes).map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 100),
      }));

      res.json({
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
      res.status(500).json({ message: 'Failed to get dashboard analytics' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
