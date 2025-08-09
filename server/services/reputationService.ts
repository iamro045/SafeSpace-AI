import { storage } from "../storage";

export class ReputationService {
  // Reputation scoring rules
  private readonly REPUTATION_RULES = {
    INITIAL_SCORE: 5.0,
    MIN_SCORE: 0.0,
    MAX_SCORE: 5.0,
    
    // Penalties for violations
    HATE_SPEECH_PENALTY: -1.0,
    SPAM_PENALTY: -0.5,
    INAPPROPRIATE_PENALTY: -0.7,
    REPETITIVE_PENALTY: -0.3,
    NUDITY_PENALTY: -1.2,
    VIOLENCE_PENALTY: -1.0,
    MANUAL_REJECTION_PENALTY: -0.8,
    
    // Bonuses for good content
    APPROVED_CONTENT_BONUS: 0.1,
    MANUAL_APPROVAL_BONUS: 0.2,
    
    // Multipliers based on confidence
    HIGH_CONFIDENCE_MULTIPLIER: 1.5, // >= 0.9
    MEDIUM_CONFIDENCE_MULTIPLIER: 1.0, // 0.7-0.9
    LOW_CONFIDENCE_MULTIPLIER: 0.5, // < 0.7
  };

  // Adjust reputation for content violations
  async adjustReputationForViolation(
    userId: string,
    violationTypes: string[],
    confidence: number
  ): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user) return;

    let totalPenalty = 0;

    // Calculate penalty based on violation types
    for (const violationType of violationTypes) {
      switch (violationType) {
        case "hate_speech":
          totalPenalty += this.REPUTATION_RULES.HATE_SPEECH_PENALTY;
          break;
        case "spam":
          totalPenalty += this.REPUTATION_RULES.SPAM_PENALTY;
          break;
        case "inappropriate":
          totalPenalty += this.REPUTATION_RULES.INAPPROPRIATE_PENALTY;
          break;
        case "repetitive":
        case "excessive_caps":
          totalPenalty += this.REPUTATION_RULES.REPETITIVE_PENALTY;
          break;
        case "nudity":
          totalPenalty += this.REPUTATION_RULES.NUDITY_PENALTY;
          break;
        case "violence":
          totalPenalty += this.REPUTATION_RULES.VIOLENCE_PENALTY;
          break;
        case "manual_rejection":
          totalPenalty += this.REPUTATION_RULES.MANUAL_REJECTION_PENALTY;
          break;
        default:
          totalPenalty += -0.3; // Default penalty
      }
    }

    // Apply confidence multiplier
    let multiplier = this.REPUTATION_RULES.LOW_CONFIDENCE_MULTIPLIER;
    if (confidence >= 0.9) {
      multiplier = this.REPUTATION_RULES.HIGH_CONFIDENCE_MULTIPLIER;
    } else if (confidence >= 0.7) {
      multiplier = this.REPUTATION_RULES.MEDIUM_CONFIDENCE_MULTIPLIER;
    }

    totalPenalty *= multiplier;

    // Calculate new score
    const currentScore = user.reputationScore || this.REPUTATION_RULES.INITIAL_SCORE;
    const newScore = Math.max(
      this.REPUTATION_RULES.MIN_SCORE,
      Math.min(this.REPUTATION_RULES.MAX_SCORE, currentScore + totalPenalty)
    );

    // Update user reputation
    await storage.updateUserReputation(userId, newScore);

    // Check if user should be banned (score below 1.0)
    if (newScore < 1.0 && !user.isBanned) {
      await storage.updateUser(userId, { isBanned: true });
      
      // Log ban action
      await storage.createModerationAction({
        contentId: userId,
        contentType: "post", // Using post as placeholder
        moderatorId: null,
        action: "ban_user",
        reason: `User banned due to low reputation score: ${newScore.toFixed(1)}`,
        isAutomatic: true,
        aiModel: "Reputation System",
        confidence: 1.0,
        details: { 
          automaticBan: true, 
          reputationScore: newScore,
          violationTypes,
        },
      });
    }
  }

  // Adjust reputation for good content
  async adjustReputationForGoodContent(userId: string, isManualApproval: boolean = false): Promise<void> {
    const user = await storage.getUser(userId);
    if (!user) return;

    const bonus = isManualApproval
      ? this.REPUTATION_RULES.MANUAL_APPROVAL_BONUS
      : this.REPUTATION_RULES.APPROVED_CONTENT_BONUS;

    const currentScore = user.reputationScore || this.REPUTATION_RULES.INITIAL_SCORE;
    const newScore = Math.min(this.REPUTATION_RULES.MAX_SCORE, currentScore + bonus);

    await storage.updateUserReputation(userId, newScore);
  }

  // Get reputation insights
  async getReputationInsights(): Promise<{
    distribution: { range: string; count: number; label: string }[];
    lowReputationUsers: any[];
    averageScore: number;
  }> {
    const allUsers = await storage.getAllUsers();
    const activeUsers = allUsers.filter(user => user.isActive && !user.isBanned);

    // Calculate distribution
    const distribution = [
      {
        range: "1-2",
        label: "Low (1-2)",
        count: activeUsers.filter(u => u.reputationScore! >= 1.0 && u.reputationScore! < 2.0).length,
      },
      {
        range: "2-4",
        label: "Medium (2-4)",
        count: activeUsers.filter(u => u.reputationScore! >= 2.0 && u.reputationScore! < 4.0).length,
      },
      {
        range: "4-5",
        label: "High (4-5)",
        count: activeUsers.filter(u => u.reputationScore! >= 4.0).length,
      },
    ];

    // Get low reputation users
    const lowReputationUsers = await storage.getUsersWithLowReputation(2.5);
    const enrichedLowRepUsers = await Promise.all(
      lowReputationUsers.slice(0, 10).map(async (user) => {
        const recentActions = await storage.getModerationActionsByModerator(user.id);
        const violationCount = recentActions.filter(
          action => action.action === "reject" && 
          action.createdAt! > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        ).length;
        
        return {
          ...user,
          recentViolations: violationCount,
        };
      })
    );

    // Calculate average score
    const totalScore = activeUsers.reduce((sum, user) => sum + (user.reputationScore || 5.0), 0);
    const averageScore = activeUsers.length > 0 ? totalScore / activeUsers.length : 5.0;

    return {
      distribution,
      lowReputationUsers: enrichedLowRepUsers,
      averageScore,
    };
  }

  // Get reputation thresholds and rules for frontend
  getReputationConfig(): any {
    return {
      thresholds: {
        ban: 1.0,
        warning: 2.0,
        good: 4.0,
        excellent: 4.8,
      },
      scoreRange: {
        min: this.REPUTATION_RULES.MIN_SCORE,
        max: this.REPUTATION_RULES.MAX_SCORE,
        initial: this.REPUTATION_RULES.INITIAL_SCORE,
      },
      penalties: {
        hate_speech: this.REPUTATION_RULES.HATE_SPEECH_PENALTY,
        spam: this.REPUTATION_RULES.SPAM_PENALTY,
        inappropriate: this.REPUTATION_RULES.INAPPROPRIATE_PENALTY,
        nudity: this.REPUTATION_RULES.NUDITY_PENALTY,
        violence: this.REPUTATION_RULES.VIOLENCE_PENALTY,
      },
      bonuses: {
        approved_content: this.REPUTATION_RULES.APPROVED_CONTENT_BONUS,
        manual_approval: this.REPUTATION_RULES.MANUAL_APPROVAL_BONUS,
      },
    };
  }
}

export const reputationService = new ReputationService();
