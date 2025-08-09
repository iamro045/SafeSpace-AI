import { formatTimeAgo, getModerationActionIcon, getModerationActionColor, formatModerationReason, getContentTypeIcon } from "@/lib/moderation";
import { ModerationAction } from "@/lib/types";

interface ModerationActionsProps {
  actions: ModerationAction[];
}

export default function ModerationActions({ actions }: ModerationActionsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Actions</h3>
          <button className="text-blue-600 hover:text-blue-800 text-sm" data-testid="button-export-actions">
            <i className="fas fa-download mr-1"></i> Export
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {actions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <i className="fas fa-history text-4xl mb-4"></i>
              <p>No recent moderation actions</p>
            </div>
          ) : (
            actions.map((action) => (
              <div key={action.id} className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    action.action === 'approve' ? 'bg-green-100' : 
                    action.action === 'reject' ? 'bg-red-100' : 
                    action.action === 'flag' ? 'bg-orange-100' : 'bg-red-200'
                  }`}>
                    <i className={`${getModerationActionIcon(action.action)} ${getModerationActionColor(action.action)} text-sm`}></i>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-900">
                      Content {action.action === 'approve' ? 'approved' : action.action === 'reject' ? 'blocked' : action.action === 'flag' ? 'flagged' : 'action taken'} from @{action.user?.username || 'unknown'}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(action.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {action.reason ? formatModerationReason(action.reason) : 'No reason provided'}
                    {action.isAutomatic ? ' • Auto-moderated by AI' : ' • Manual review'}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      action.action === 'approve' ? 'bg-green-100 text-green-700' :
                      action.action === 'reject' ? 'bg-red-100 text-red-700' : 
                      action.action === 'flag' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <i className={`${getContentTypeIcon(action.contentType === 'post' ? 'text' : 'comment')} mr-1`}></i>
                      {action.contentType.charAt(0).toUpperCase() + action.contentType.slice(1)}
                    </span>
                    {action.confidence && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                        Confidence: {Math.round(action.confidence * 100)}%
                      </span>
                    )}
                    {action.isAutomatic && (
                      <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded">
                        AI: {action.aiModel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
