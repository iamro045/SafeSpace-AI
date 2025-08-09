import { storage } from "../storage";
import { aiService, AIDetectionResult } from "./aiService";
import { reputationService } from "./reputationService";

export class ModerationService {
  // Moderate text content (posts/comments)
  async moderateTextContent(
    contentId: string,
    content: string,
    contentType: "post" | "comment",
    userId: string,
    language: string = "en"
  ): Promise<void> {
    try {
      // Run AI analysis
      const aiResult = await aiService.analyzeText(content, language);
      
      // Determine moderation action based on AI result
      let moderationStatus = "approved";
      let moderationReason = null;
      
      if (aiResult.isViolation) {
        if (aiResult.confidence >= 0.9) {
          // High confidence - auto-block
          moderationStatus = "rejected";
          moderationReason = aiResult.explanation;
          
          // Update user reputation
          await reputationService.adjustReputationForViolation(userId, aiResult.violationType, aiResult.confidence);
          
        } else if (aiResult.confidence >= 0.7) {
          // Medium confidence - flag for review
          moderationStatus = "flagged";
          moderationReason = `Requires review: ${aiResult.explanation}`;
        }
      }

      // Update content moderation status
      if (contentType === "post") {
        await storage.updatePostModerationStatus(
          contentId,
          moderationStatus,
          moderationReason,
          aiResult.confidence,
          aiResult.violationType
        );
      } else {
        await storage.updateCommentModerationStatus(
          contentId,
          moderationStatus,
          moderationReason,
          aiResult.confidence,
          aiResult.violationType
        );
      }

      // Log moderation action
      await storage.createModerationAction({
        contentId,
        contentType,
        moderatorId: null, // AI moderation
        action: moderationStatus === "rejected" ? "reject" : moderationStatus === "flagged" ? "flag" : "approve",
        reason: moderationReason,
        isAutomatic: true,
        aiModel: "Text Analysis",
        confidence: aiResult.confidence,
        details: {
          violationType: aiResult.violationType,
          detectedLanguage: aiResult.detectedLanguage,
        },
      });

    } catch (error) {
      console.error("Error moderating text content:", error);
      
      // Default to flagged if AI fails
      if (contentType === "post") {
        await storage.updatePostModerationStatus(contentId, "flagged", "AI analysis failed - requires manual review");
      } else {
        await storage.updateCommentModerationStatus(contentId, "flagged", "AI analysis failed - requires manual review");
      }
    }
  }

  // Moderate image content
  async moderateImageContent(
    contentId: string,
    imageUrl: string,
    contentType: "post" | "comment",
    userId: string
  ): Promise<void> {
    try {
      // Run AI image analysis
      const aiResult = await aiService.analyzeImage(imageUrl);
      
      let moderationStatus = "approved";
      let moderationReason = null;
      
      if (aiResult.isViolation) {
        if (aiResult.confidence >= 0.85) {
          moderationStatus = "rejected";
          moderationReason = aiResult.explanation;
          
          // Update user reputation for image violations
          await reputationService.adjustReputationForViolation(userId, aiResult.violationType, aiResult.confidence);
          
        } else if (aiResult.confidence >= 0.6) {
          moderationStatus = "flagged";
          moderationReason = `Requires review: ${aiResult.explanation}`;
        }
      }

      // Update content moderation status
      if (contentType === "post") {
        await storage.updatePostModerationStatus(
          contentId,
          moderationStatus,
          moderationReason,
          aiResult.confidence,
          aiResult.violationType
        );
      } else {
        await storage.updateCommentModerationStatus(
          contentId,
          moderationStatus,
          moderationReason,
          aiResult.confidence,
          aiResult.violationType
        );
      }

      // Log moderation action
      await storage.createModerationAction({
        contentId,
        contentType,
        moderatorId: null,
        action: moderationStatus === "rejected" ? "reject" : moderationStatus === "flagged" ? "flag" : "approve",
        reason: moderationReason,
        isAutomatic: true,
        aiModel: "Image Detection",
        confidence: aiResult.confidence,
        details: {
          violationType: aiResult.violationType,
          faces: (aiResult as any).faces,
          objects: (aiResult as any).objects,
        },
      });

    } catch (error) {
      console.error("Error moderating image content:", error);
      
      if (contentType === "post") {
        await storage.updatePostModerationStatus(contentId, "flagged", "Image analysis failed - requires manual review");
      } else {
        await storage.updateCommentModerationStatus(contentId, "flagged", "Image analysis failed - requires manual review");
      }
    }
  }

  // Manual moderation action by admin/moderator
  async manualModerationAction(
    contentId: string,
    contentType: "post" | "comment",
    action: "approve" | "reject" | "flag",
    moderatorId: string,
    reason?: string
  ): Promise<void> {
    try {
      const moderationStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "flagged";
      
      // Get content to find the user
      let userId: string | null = null;
      if (contentType === "post") {
        const post = await storage.getPost(contentId);
        userId = post?.userId || null;
        await storage.updatePostModerationStatus(contentId, moderationStatus, reason);
      } else {
        const comment = await storage.getComment(contentId);
        userId = comment?.userId || null;
        await storage.updateCommentModerationStatus(contentId, moderationStatus, reason);
      }

      // Adjust user reputation for manual rejections
      if (action === "reject" && userId) {
        await reputationService.adjustReputationForViolation(userId, ["manual_rejection"], 1.0);
      } else if (action === "approve" && userId) {
        await reputationService.adjustReputationForGoodContent(userId);
      }

      // Log manual moderation action
      await storage.createModerationAction({
        contentId,
        contentType,
        moderatorId,
        action,
        reason: reason || `Manual ${action} by moderator`,
        isAutomatic: false,
        aiModel: null,
        confidence: null,
        details: { manualReview: true },
      });

    } catch (error) {
      console.error("Error in manual moderation action:", error);
      throw error;
    }
  }

  // Get pending content for moderation queue
  async getPendingContent(): Promise<{
    posts: any[];
    comments: any[];
  }> {
    const pendingPosts = await storage.getPostsForModeration("pending");
    const flaggedPosts = await storage.getPostsForModeration("flagged");
    
    const pendingComments = await storage.getCommentsForModeration("pending");
    const flaggedComments = await storage.getCommentsForModeration("flagged");

    // Combine and enrich with user data
    const allPosts = [...pendingPosts, ...flaggedPosts];
    const allComments = [...pendingComments, ...flaggedComments];

    const postsWithUsers = await Promise.all(
      allPosts.map(async (post) => {
        const user = await storage.getUser(post.userId);
        return { ...post, user };
      })
    );

    const commentsWithUsers = await Promise.all(
      allComments.map(async (comment) => {
        const user = await storage.getUser(comment.userId);
        const post = await storage.getPost(comment.postId);
        return { ...comment, user, post };
      })
    );

    return {
      posts: postsWithUsers,
      comments: commentsWithUsers,
    };
  }

  // Get moderation statistics
  async getModerationStats(): Promise<{
    totalProcessed: number;
    totalFlagged: number;
    totalBlocked: number;
    activeUsers: number;
    recentActions: any[];
  }> {
    const stats = await storage.getContentStats();
    const recentActions = await storage.getModerationActions(10);

    // Enrich recent actions with content and user data
    const enrichedActions = await Promise.all(
      recentActions.map(async (action) => {
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

        return { ...action, content, user };
      })
    );

    return {
      ...stats,
      recentActions: enrichedActions,
    };
  }
}

export const moderationService = new ModerationService();
