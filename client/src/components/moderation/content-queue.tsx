import { formatTimeAgo, getModerationStatusColor, getContentTypeIcon, formatModerationReason, formatConfidenceScore } from "@/lib/moderation";
import { PendingContent } from "@/lib/types";

interface ContentQueueProps {
  pendingContent: PendingContent;
  onAction: (contentId: string, contentType: 'post' | 'comment', action: 'approve' | 'reject') => void;
}

export default function ContentQueue({ pendingContent, onAction }: ContentQueueProps) {
  const allContent = [
    ...pendingContent.posts.map(post => ({ ...post, type: 'post' as const })),
    ...pendingContent.comments.map(comment => ({ ...comment, type: 'comment' as const }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Pending Reviews</h3>
          <span className="bg-orange-500 text-white text-sm px-3 py-1 rounded-full">
            {allContent.length}
          </span>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {allContent.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-check-circle text-4xl mb-4 text-green-500"></i>
              <p>No content pending review</p>
            </div>
          ) : (
            allContent.map((content) => (
              <div key={`${content.type}-${content.id}`} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    content.moderationStatus === 'flagged' ? 'bg-orange-100' : 'bg-yellow-100'
                  }`}>
                    <i className={`${getContentTypeIcon(content.type === 'post' ? content.contentType : 'comment')} ${
                      content.moderationStatus === 'flagged' ? 'text-orange-600' : 'text-yellow-600'
                    }`}></i>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {content.type === 'post' ? 'Post' : 'Comment'} - User @{content.user?.username || 'unknown'}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(content.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1 line-clamp-2">
                    {content.content}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatModerationReason(content.moderationReason)} 
                    {content.aiConfidence && (
                      <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">
                        Confidence: {formatConfidenceScore(content.aiConfidence)}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center space-x-2 mt-3">
                    <span className={`text-xs px-2 py-1 rounded ${getModerationStatusColor(content.moderationStatus)}`}>
                      {content.moderationStatus.charAt(0).toUpperCase() + content.moderationStatus.slice(1)}
                    </span>
                    {content.language && content.language !== 'en' && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                        {content.language.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2 mt-3">
                    <button 
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                      onClick={() => onAction(content.id, content.type as 'post' | 'comment', 'approve')}
                      data-testid={`button-approve-${content.id}`}
                    >
                      <i className="fas fa-check mr-1"></i> Approve
                    </button>
                    <button 
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700 transition-colors"
                      onClick={() => onAction(content.id, content.type as 'post' | 'comment', 'reject')}
                      data-testid={`button-reject-${content.id}`}
                    >
                      <i className="fas fa-times mr-1"></i> Block
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {allContent.length > 0 && (
          <div className="mt-4 text-center">
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View All Pending Reviews <i className="fas fa-arrow-right ml-1"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
