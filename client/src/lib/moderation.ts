import { ModerationAction, Post, Comment } from './types';

export function getModerationStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'text-green-600 bg-green-100';
    case 'rejected':
      return 'text-red-600 bg-red-100';
    case 'flagged':
      return 'text-orange-600 bg-orange-100';
    case 'pending':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

export function getModerationActionIcon(action: string): string {
  switch (action) {
    case 'approve':
      return 'fas fa-check';
    case 'reject':
      return 'fas fa-times';
    case 'flag':
      return 'fas fa-flag';
    case 'ban_user':
      return 'fas fa-ban';
    default:
      return 'fas fa-question';
  }
}

export function getModerationActionColor(action: string): string {
  switch (action) {
    case 'approve':
      return 'text-green-600';
    case 'reject':
      return 'text-red-600';
    case 'flag':
      return 'text-orange-600';
    case 'ban_user':
      return 'text-red-800';
    default:
      return 'text-gray-600';
  }
}

export function formatModerationReason(reason: string | null | undefined): string {
  if (!reason) return 'No reason provided';
  
  // Clean up AI-generated reasons
  const cleanedReason = reason
    .replace(/^(Detected|Requires review:)\s*/i, '')
    .replace(/\s*\(.*?\)\s*$/, '') // Remove confidence scores in parentheses
    .trim();
    
  return cleanedReason.charAt(0).toUpperCase() + cleanedReason.slice(1);
}

export function getContentTypeIcon(contentType: string): string {
  switch (contentType) {
    case 'text':
      return 'fas fa-comment';
    case 'image':
      return 'fas fa-image';
    case 'video':
      return 'fas fa-video';
    default:
      return 'fas fa-file';
  }
}

export function getViolationTypeIcon(violationType: string): string {
  switch (violationType) {
    case 'hate_speech':
      return 'fas fa-exclamation-triangle';
    case 'spam':
      return 'fas fa-envelope';
    case 'inappropriate':
      return 'fas fa-eye-slash';
    case 'nudity':
      return 'fas fa-user-times';
    case 'violence':
      return 'fas fa-fist-raised';
    case 'repetitive':
      return 'fas fa-redo';
    case 'excessive_caps':
      return 'fas fa-font';
    default:
      return 'fas fa-flag';
  }
}

export function formatConfidenceScore(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined) return 'N/A';
  return `${Math.round(confidence * 100)}%`;
}

export function getReputationColor(score: number): string {
  if (score < 1.0) return 'text-red-600 bg-red-100';
  if (score < 2.0) return 'text-orange-600 bg-orange-100';
  if (score < 4.0) return 'text-yellow-600 bg-yellow-100';
  return 'text-green-600 bg-green-100';
}

export function getReputationLabel(score: number): string {
  if (score < 1.0) return 'Critical';
  if (score < 2.0) return 'Low';
  if (score < 4.0) return 'Medium';
  if (score < 4.8) return 'Good';
  return 'Excellent';
}

export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

export function isHighRiskContent(content: Post | Comment): boolean {
  return (
    content.moderationStatus === 'flagged' && 
    content.aiConfidence !== null && 
    content.aiConfidence > 0.8
  ) || (
    content.aiFlags && 
    content.aiFlags.some(flag => ['hate_speech', 'nudity', 'violence'].includes(flag))
  );
}

export function shouldAutoBlock(confidence: number, violationTypes: string[]): boolean {
  const highRiskTypes = ['hate_speech', 'nudity', 'violence'];
  const hasHighRiskViolation = violationTypes.some(type => highRiskTypes.includes(type));
  
  return confidence >= 0.9 || (confidence >= 0.8 && hasHighRiskViolation);
}
