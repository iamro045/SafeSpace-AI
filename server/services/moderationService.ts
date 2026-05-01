import { storage } from "../storage";
import { aiService, AIDetectionResult } from "./aiService";
import { reputationService } from "./reputationService";
import { appConfig, type EnforcementAction } from "../config";

export type ModerationDecision = {
  action: EnforcementAction;
  moderationStatus: "approved" | "flagged" | "rejected";
  moderationReason: string | null;
  ai: {
    classificationLabel: string;
    confidence: number;
    severityScore: number;
    violationType: string[];
    contributingTerms: string[];
    explanation: string;
    detectedLanguage: string;
  };
};

function moderationStatusRank(status: string | null | undefined): number {
  // Higher rank = more severe; never allow a later moderation pass to downgrade.
  switch (status) {
    case "rejected":
      return 3;
    case "flagged":
      return 2;
    case "approved":
      return 1;
    case "pending":
    default:
      return 0;
  }
}

function shouldApplyDecision(currentStatus: string | null | undefined, nextStatus: string): boolean {
  return moderationStatusRank(nextStatus) >= moderationStatusRank(currentStatus);
}

function decideEnforcement(aiResult: AIDetectionResult): ModerationDecision {
  if (!aiResult.isViolation) {
    return {
      action: "allow",
      moderationStatus: "approved",
      moderationReason: null,
      ai: {
        classificationLabel: aiResult.classificationLabel,
        confidence: aiResult.confidence,
        severityScore: aiResult.severityScore,
        violationType: aiResult.violationType,
        contributingTerms: aiResult.contributingTerms,
        explanation: aiResult.explanation,
        detectedLanguage: aiResult.detectedLanguage,
      },
    };
  }

  const { confidence, severityScore } = aiResult;

  if (confidence >= appConfig.moderation.blockConfidence || severityScore >= appConfig.moderation.blockSeverity) {
    return {
      action: "block",
      moderationStatus: "rejected",
      moderationReason: aiResult.explanation,
      ai: {
        classificationLabel: aiResult.classificationLabel,
        confidence,
        severityScore,
        violationType: aiResult.violationType,
        contributingTerms: aiResult.contributingTerms,
        explanation: aiResult.explanation,
        detectedLanguage: aiResult.detectedLanguage,
      },
    };
  }

  if (confidence >= appConfig.moderation.escalateConfidence || severityScore >= appConfig.moderation.escalateSeverity) {
    return {
      action: "escalate",
      moderationStatus: "flagged",
      moderationReason: `Requires review: ${aiResult.explanation}`,
      ai: {
        classificationLabel: aiResult.classificationLabel,
        confidence,
        severityScore,
        violationType: aiResult.violationType,
        contributingTerms: aiResult.contributingTerms,
        explanation: aiResult.explanation,
        detectedLanguage: aiResult.detectedLanguage,
      },
    };
  }

  if (confidence >= appConfig.moderation.warnConfidence || severityScore >= appConfig.moderation.warnSeverity) {
    return {
      action: "warn",
      moderationStatus: "approved",
      moderationReason: `Warning: ${aiResult.explanation}`,
      ai: {
        classificationLabel: aiResult.classificationLabel,
        confidence,
        severityScore,
        violationType: aiResult.violationType,
        contributingTerms: aiResult.contributingTerms,
        explanation: aiResult.explanation,
        detectedLanguage: aiResult.detectedLanguage,
      },
    };
  }

  return {
    action: "allow",
    moderationStatus: "approved",
    moderationReason: null,
    ai: {
      classificationLabel: aiResult.classificationLabel,
      confidence,
      severityScore,
      violationType: aiResult.violationType,
      contributingTerms: aiResult.contributingTerms,
      explanation: aiResult.explanation,
      detectedLanguage: aiResult.detectedLanguage,
    },
  };
}

export class ModerationService {
  // Moderate text content (posts/comments)
  async moderateTextContent(
    contentId: string,
    content: string,
    contentType: "post" | "comment",
    userId: string,
    language: string = "en"
  ): Promise<ModerationDecision> {
    try {
      // Run AI analysis
      const aiResult = await aiService.analyzeText(content, language);

      const decision = decideEnforcement(aiResult);

      // Avoid downgrading moderation status if multiple passes run (e.g., text + image).
      const current = contentType === "post" ? await storage.getPost(contentId) : await storage.getComment(contentId);
      if (current && !shouldApplyDecision((current as any).moderationStatus, decision.moderationStatus)) {
        return decision;
      }

      if (decision.action === "block") {
        await reputationService.adjustReputationForViolation(userId, aiResult.violationType, aiResult.confidence);
      }

      // Update content moderation status
      if (contentType === "post") {
        await storage.updatePostModerationStatus(
          contentId,
          decision.moderationStatus,
          decision.moderationReason || undefined,
          aiResult.confidence,
          aiResult.violationType
        );
      } else {
        await storage.updateCommentModerationStatus(
          contentId,
          decision.moderationStatus,
          decision.moderationReason || undefined,
          aiResult.confidence,
          aiResult.violationType
        );
      }

      // Log moderation action
      await storage.createModerationAction({
        contentId,
        contentType,
        moderatorId: null, // AI moderation
        action: decision.moderationStatus === "rejected" ? "reject" : decision.moderationStatus === "flagged" ? "flag" : "approve",
        reason: decision.moderationReason,
        isAutomatic: true,
        aiModel: "Text Analysis",
        confidence: aiResult.confidence,
        details: {
          action: decision.action,
          violationType: aiResult.violationType,
          classificationLabel: aiResult.classificationLabel,
          severityScore: aiResult.severityScore,
          contributingTerms: aiResult.contributingTerms,
          detectedLanguage: aiResult.detectedLanguage,
        },
      });

      return decision;
    } catch (error) {
      console.error("Error moderating text content:", error);
      
      // Default to flagged if AI fails
      if (contentType === "post") {
        await storage.updatePostModerationStatus(contentId, "flagged", "AI analysis failed - requires manual review");
      } else {
        await storage.updateCommentModerationStatus(contentId, "flagged", "AI analysis failed - requires manual review");
      }

      return {
        action: "escalate",
        moderationStatus: "flagged",
        moderationReason: "AI analysis failed - requires manual review",
        ai: {
          classificationLabel: "error",
          confidence: 0,
          severityScore: 0,
          violationType: [],
          contributingTerms: [],
          explanation: "AI analysis failed",
          detectedLanguage: language,
        },
      };
    }
  }

  // Moderate image content
  async moderateImageContent(
    contentId: string,
    imageUrl: string,
    contentType: "post" | "comment",
    userId: string
  ): Promise<ModerationDecision> {
    try {
      // Run AI image analysis
      const aiResult = await aiService.analyzeImage(imageUrl);

      const decision = decideEnforcement(aiResult);

      // Prevent a safe image decision from overwriting an existing text-based flag/reject.
      const current = contentType === "post" ? await storage.getPost(contentId) : await storage.getComment(contentId);
      if (current && !shouldApplyDecision((current as any).moderationStatus, decision.moderationStatus)) {
        return decision;
      }

      if (decision.action === "block") {
        // Only adjust reputation if we are actually applying a block.
        await reputationService.adjustReputationForViolation(userId, aiResult.violationType, aiResult.confidence);
      }

      // Update content moderation status
      if (contentType === "post") {
        await storage.updatePostModerationStatus(
          contentId,
          decision.moderationStatus,
          decision.moderationReason || undefined,
          aiResult.confidence,
          aiResult.violationType
        );
      } else {
        await storage.updateCommentModerationStatus(
          contentId,
          decision.moderationStatus,
          decision.moderationReason || undefined,
          aiResult.confidence,
          aiResult.violationType
        );
      }

      // Log moderation action
      await storage.createModerationAction({
        contentId,
        contentType,
        moderatorId: null,
        action: decision.moderationStatus === "rejected" ? "reject" : decision.moderationStatus === "flagged" ? "flag" : "approve",
        reason: decision.moderationReason,
        isAutomatic: true,
        aiModel: "Image Detection",
        confidence: aiResult.confidence,
        details: {
          action: decision.action,
          violationType: aiResult.violationType,
          classificationLabel: aiResult.classificationLabel,
          severityScore: aiResult.severityScore,
          contributingTerms: aiResult.contributingTerms,
          faces: (aiResult as any).faces,
          objects: (aiResult as any).objects,
        },
      });

      return decision;
    } catch (error) {
      console.error("Error moderating image content:", error);
      
      if (contentType === "post") {
        await storage.updatePostModerationStatus(contentId, "flagged", "Image analysis failed - requires manual review");
      } else {
        await storage.updateCommentModerationStatus(contentId, "flagged", "Image analysis failed - requires manual review");
      }

      return {
        action: "escalate",
        moderationStatus: "flagged",
        moderationReason: "Image analysis failed - requires manual review",
        ai: {
          classificationLabel: "error",
          confidence: 0,
          severityScore: 0,
          violationType: [],
          contributingTerms: [],
          explanation: "Image analysis failed",
          detectedLanguage: "n/a",
        },
      };
    }
  }

  // Moderate video content by sampling frames via ffmpeg and reusing image analysis
  async moderateVideoContent(
    contentId: string,
    videoUrl: string,
    contentType: "post" | "comment",
    userId: string
  ): Promise<ModerationDecision> {
    try {
      const aiResult = await aiService.analyzeVideo(videoUrl);
      const decision = decideEnforcement(aiResult);

      const current = contentType === "post" ? await storage.getPost(contentId) : await storage.getComment(contentId);
      if (current && !shouldApplyDecision((current as any).moderationStatus, decision.moderationStatus)) {
        return decision;
      }

      if (decision.action === "block") {
        await reputationService.adjustReputationForViolation(userId, aiResult.violationType, aiResult.confidence);
      }

      if (contentType === "post") {
        await storage.updatePostModerationStatus(
          contentId,
          decision.moderationStatus,
          decision.moderationReason || undefined,
          aiResult.confidence,
          aiResult.violationType
        );
      } else {
        await storage.updateCommentModerationStatus(
          contentId,
          decision.moderationStatus,
          decision.moderationReason || undefined,
          aiResult.confidence,
          aiResult.violationType
        );
      }

      await storage.createModerationAction({
        contentId,
        contentType,
        moderatorId: null,
        action: decision.moderationStatus === "rejected" ? "reject" : decision.moderationStatus === "flagged" ? "flag" : "approve",
        reason: decision.moderationReason,
        isAutomatic: true,
        aiModel: "Video Analysis",
        confidence: aiResult.confidence,
        details: {
          action: decision.action,
          violationType: aiResult.violationType,
          classificationLabel: aiResult.classificationLabel,
          severityScore: aiResult.severityScore,
          contributingTerms: aiResult.contributingTerms,
          framesAnalyzed: (aiResult as any).framesAnalyzed,
          frameSummaries: (aiResult as any).frameSummaries,
        },
      });

      return decision;
    } catch (error) {
      console.error("Error moderating video content:", error);

      if (contentType === "post") {
        await storage.updatePostModerationStatus(contentId, "flagged", "Video analysis failed - requires manual review");
      } else {
        await storage.updateCommentModerationStatus(contentId, "flagged", "Video analysis failed - requires manual review");
      }

      return {
        action: "escalate",
        moderationStatus: "flagged",
        moderationReason: "Video analysis failed - requires manual review",
        ai: {
          classificationLabel: "error",
          confidence: 0,
          severityScore: 0,
          violationType: [],
          contributingTerms: [],
          explanation: "Video analysis failed",
          detectedLanguage: "n/a",
        },
      };
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
        const latestAction = await storage.getLatestModerationActionForContent(post.id, "post");
        const details = latestAction?.details && typeof latestAction.details === "object" ? (latestAction.details as any) : null;
        const aiDetails = latestAction
          ? {
              actionId: latestAction.id,
              isAutomatic: !!latestAction.isAutomatic,
              aiModel: latestAction.aiModel,
              confidence: latestAction.confidence,
              reason: latestAction.reason,
              createdAt: latestAction.createdAt,
              classificationLabel: details?.classificationLabel,
              severityScore: details?.severityScore,
              detectedLanguage: details?.detectedLanguage,
              contributingTerms: details?.contributingTerms,
              violationType: details?.violationType,
            }
          : null;
        return { ...post, user, aiDetails };
      })
    );

    const commentsWithUsers = await Promise.all(
      allComments.map(async (comment) => {
        const user = await storage.getUser(comment.userId);
        const post = await storage.getPost(comment.postId);
        const latestAction = await storage.getLatestModerationActionForContent(comment.id, "comment");
        const details = latestAction?.details && typeof latestAction.details === "object" ? (latestAction.details as any) : null;
        const aiDetails = latestAction
          ? {
              actionId: latestAction.id,
              isAutomatic: !!latestAction.isAutomatic,
              aiModel: latestAction.aiModel,
              confidence: latestAction.confidence,
              reason: latestAction.reason,
              createdAt: latestAction.createdAt,
              classificationLabel: details?.classificationLabel,
              severityScore: details?.severityScore,
              detectedLanguage: details?.detectedLanguage,
              contributingTerms: details?.contributingTerms,
              violationType: details?.violationType,
            }
          : null;
        return { ...comment, user, post, aiDetails };
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
