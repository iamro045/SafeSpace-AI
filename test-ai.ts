import { aiService, AIDetectionResult } from "./server/services/aiService";
import { appConfig } from "./server/config";

function decideEnforcement(aiResult: AIDetectionResult) {
  if (!aiResult.isViolation) {
    return { action: "allow", moderationStatus: "approved" };
  }

  const { confidence, severityScore } = aiResult;

  if (confidence >= appConfig.moderation.blockConfidence || severityScore >= appConfig.moderation.blockSeverity) {
    return { action: "block", moderationStatus: "rejected" };
  }

  if (confidence >= appConfig.moderation.escalateConfidence || severityScore >= appConfig.moderation.escalateSeverity) {
    return { action: "escalate", moderationStatus: "flagged" };
  }

  if (confidence >= appConfig.moderation.warnConfidence || severityScore >= appConfig.moderation.warnSeverity) {
    return { action: "warn", moderationStatus: "approved" };
  }

  return { action: "allow", moderationStatus: "approved" };
}

async function run() {
  const text1 = "This is such stupid weather today, I hate it so much! Everything is going wrong and I'm so frustrated with this terrible day.";
  const ai1 = await aiService.analyzeText(text1);
  console.log("AI Result 1:", JSON.stringify(ai1, null, 2));
  
  // Actually moderation service requires contentId, userId, etc. But we can just use the private decideEnforcement if it was exported, or just duplicate its logic here to see.
  
  const decision1 = decideEnforcement(ai1);
  console.log("Decision 1:", JSON.stringify(decision1, null, 2));

  const text2 = "I hate everyone and want them to disappear forever! This world is terrible and I wish bad things would happen to all these idiots.";
  const ai2 = await aiService.analyzeText(text2);
  const decision2 = decideEnforcement(ai2);

  const text3 = "Just had an amazing lunch at the new restaurant downtown! The food was incredible and the service was perfect. Highly recommend! 🍕✨";
  const ai3 = await aiService.analyzeText(text3);
  const decision3 = decideEnforcement(ai3);
  console.log("Decision 3 (Safe):", JSON.stringify(decision3, null, 2));
}

run();
