export type EnforcementAction = "allow" | "warn" | "block" | "escalate";

function readInt(envValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(envValue ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readFloat(envValue: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(envValue ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(envValue: string | undefined, fallback: boolean): boolean {
  if (envValue === undefined) return fallback;
  const normalized = envValue.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
}

export const appConfig = {
  content: {
    textCharLimit: readInt(process.env.TEXT_CHAR_LIMIT, 500),
    commentCharLimit: readInt(process.env.COMMENT_CHAR_LIMIT, 300),
  },
  uploads: {
    maxImageBytes: readInt(process.env.MAX_IMAGE_BYTES, 2 * 1024 * 1024),
    allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxVideoBytes: readInt(process.env.MAX_VIDEO_BYTES, 250 * 1024 * 1024),
    allowedVideoMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    maxDatasetBytes: readInt(process.env.MAX_DATASET_BYTES, 50 * 1024 * 1024),
  },
  moderation: {
    // Confidence thresholds for enforcement.
    warnConfidence: readFloat(process.env.MODERATION_WARN_CONFIDENCE, 0.6),
    escalateConfidence: readFloat(process.env.MODERATION_ESCALATE_CONFIDENCE, 0.75),
    blockConfidence: readFloat(process.env.MODERATION_BLOCK_CONFIDENCE, 0.98),

    // Severity thresholds (0..1) for enforcement.
    warnSeverity: readFloat(process.env.MODERATION_WARN_SEVERITY, 0.35),
    escalateSeverity: readFloat(process.env.MODERATION_ESCALATE_SEVERITY, 0.55),
    blockSeverity: readFloat(process.env.MODERATION_BLOCK_SEVERITY, 0.75),

    // If true, store blocked/escalated content as rejected/flagged records for audit.
    storeBlockedContent: readBoolean(process.env.STORE_BLOCKED_CONTENT, true),
  },
  reputation: {
    deprioritizeBelow: readFloat(process.env.REP_DEPRIORITIZE_BELOW, 2.0),
    hideBelow: readFloat(process.env.REP_HIDE_BELOW, 1.0),
  },
} as const;
