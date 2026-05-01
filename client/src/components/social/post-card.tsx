import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatTimeAgo, getModerationStatusColor, formatModerationReason, formatConfidenceScore, getReputationColor } from "@/lib/moderation";
import { Post } from "@/lib/types";

interface PostCardProps {
  post: Post;
  onComment: (postId: string, content: string) => Promise<void>;
  showModerationStatus?: boolean;
}

export default function PostCard({ post, onComment, showModerationStatus = false }: PostCardProps) {
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    setIsSubmittingComment(true);
    try {
      await onComment(post.id, commentContent);
      setCommentContent("");
      setShowCommentForm(false);
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getModerationIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'fas fa-check-circle text-green-600';
      case 'rejected':
        return 'fas fa-ban text-red-600';
      case 'flagged':
        return 'fas fa-flag text-orange-600';
      case 'pending':
        return 'fas fa-clock text-yellow-600';
      default:
        return 'fas fa-question-circle text-gray-600';
    }
  };

  const getModerationMessage = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Content approved and visible to all users';
      case 'rejected':
        return 'Content blocked due to policy violations';
      case 'flagged':
        return 'Content flagged and under review';
      case 'pending':
        return 'Content pending AI analysis and review';
      default:
        return 'Moderation status unknown';
    }
  };

  return (
    <Card className={`transition-all duration-200 ${
      post.moderationStatus === 'rejected' ? 'opacity-60 border-red-200' :
      post.moderationStatus === 'flagged' ? 'border-orange-200' :
      post.moderationStatus === 'approved' ? 'border-green-200' :
      'border-gray-200'
    }`}>
      <CardContent className="p-6">
        {/* Post Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <img
              src={post.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${post.user?.username || 'User'}&background=random`}
              alt={`${post.user?.username || 'User'} profile`}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <h3 className="font-semibold text-gray-900">
                {post.user?.firstName} {post.user?.lastName}
              </h3>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-500">@{post.user?.username}</p>
                <span className="text-gray-300">•</span>
                <span className="text-sm text-gray-500">{formatTimeAgo(post.createdAt)}</span>
                {post.user?.reputationScore && (
                  <>
                    <span className="text-gray-300">•</span>
                    <Badge className={`text-xs ${getReputationColor(post.user.reputationScore)}`}>
                      {post.user.reputationScore.toFixed(1)}/5.0
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {post.language && post.language !== 'en' && (
              <Badge variant="outline" className="text-xs">
                {post.language.toUpperCase()}
              </Badge>
            )}
            {showModerationStatus && (
              <div className="flex items-center space-x-2">
                <i className={getModerationIcon(post.moderationStatus)}></i>
                <Badge className={getModerationStatusColor(post.moderationStatus)}>
                  {post.moderationStatus.charAt(0).toUpperCase() + post.moderationStatus.slice(1)}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Post Content */}
        <div className="mb-4">
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {post.content}
          </p>
          
          {/* Image Content */}
          {post.imageUrl && (
            <div className="mt-4">
              <img
                src={post.imageUrl}
                alt="Post content"
                className="max-w-full h-auto rounded-lg border shadow-sm max-h-96 object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Video Content */}
          {post.videoUrl && (
            <div className="mt-4">
              <video
                src={post.videoUrl}
                controls
                className="max-w-full h-auto rounded-lg border shadow-sm max-h-96"
                onError={(e) => {
                  const target = e.target as HTMLVideoElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Moderation Status Info */}
        {showModerationStatus && (() => {
          const isSpam = post.aiFlags?.includes('spam');
          let boxClasses = '';
          let textStrong = '';
          let textSub = '';
          let badgeConf = '';
          let badgeBg = '';
          
          if (isSpam) {
            boxClasses = 'bg-purple-50 border border-purple-200';
            textStrong = 'text-purple-800';
            textSub = 'text-purple-700';
            badgeConf = 'bg-purple-200 text-purple-800';
            badgeBg = 'bg-purple-600 hover:bg-purple-700 text-white border-transparent';
          } else if (post.moderationStatus === 'rejected') {
            boxClasses = 'bg-red-50 border border-red-200';
            textStrong = 'text-red-800';
            textSub = 'text-red-700';
            badgeConf = 'bg-red-200 text-red-800';
            badgeBg = 'bg-red-600 hover:bg-red-700 text-white border-transparent';
          } else if (post.moderationStatus === 'flagged') {
            boxClasses = 'bg-orange-50 border border-orange-200';
            textStrong = 'text-orange-800';
            textSub = 'text-orange-700';
            badgeConf = 'bg-orange-200 text-orange-800';
            badgeBg = 'bg-orange-500 hover:bg-orange-600 text-white border-transparent';
          } else if (post.moderationStatus === 'approved') {
            boxClasses = 'bg-green-50 border border-green-200';
            textStrong = 'text-green-800';
            textSub = 'text-green-700';
            badgeConf = 'bg-green-200 text-green-800';
            badgeBg = 'bg-green-600 hover:bg-green-700 text-white border-transparent';
          } else {
            boxClasses = 'bg-yellow-50 border border-yellow-200';
            textStrong = 'text-yellow-800';
            textSub = 'text-yellow-700';
            badgeConf = 'bg-gray-200 text-gray-700';
            badgeBg = 'bg-yellow-600 hover:bg-yellow-700 text-white border-transparent';
          }

          return (
          <div className={`p-3 rounded-lg mb-4 ${boxClasses}`}>
            <div className="flex items-start space-x-2">
              <i className={getModerationIcon(post.moderationStatus)}></i>
              <div className="flex-1">
                <p className={`text-sm font-medium ${textStrong}`}>
                  {getModerationMessage(post.moderationStatus)}
                </p>
                
                {post.moderationReason && (
                  <p className={`text-sm mt-1 ${textSub}`}>
                    <strong>Reason:</strong> {formatModerationReason(post.moderationReason)}
                  </p>
                )}
                
                <div className="flex items-center space-x-3 mt-2">
                  {post.aiConfidence && (
                    <span className={`text-xs px-2 py-1 rounded ${badgeConf}`}>
                      AI Confidence: {formatConfidenceScore(post.aiConfidence)}
                    </span>
                  )}
                  
                  {post.aiFlags && post.aiFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.aiFlags.map((flag, index) => (
                        <Badge key={index} className={`text-xs ${badgeBg}`}>
                          {flag.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );})()}

        {/* Post Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-blue-600">
              <i className="fas fa-heart mr-2"></i>
              Like
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-600 hover:text-blue-600"
              onClick={() => setShowCommentForm(!showCommentForm)}
              data-testid={`button-comment-${post.id}`}
            >
              <i className="fas fa-comment mr-2"></i>
              Comment ({post.commentCount || 0})
            </Button>
            
            <Button variant="ghost" size="sm" className="text-gray-600 hover:text-blue-600">
              <i className="fas fa-share mr-2"></i>
              Share
            </Button>
          </div>
          
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Badge variant="outline" className="text-xs">
              {post.contentType}
            </Badge>
            {post.isModerated && (
              <i className="fas fa-shield-alt text-blue-500" title="Content has been moderated"></i>
            )}
          </div>
        </div>

        {/* Comment Form */}
        {showCommentForm && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <form onSubmit={handleSubmitComment} className="space-y-3">
              <Textarea
                placeholder="Write a comment..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                rows={3}
                data-testid={`textarea-comment-${post.id}`}
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Comments are also moderated by AI
                </p>
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowCommentForm(false);
                      setCommentContent("");
                    }}
                    data-testid={`button-cancel-comment-${post.id}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!commentContent.trim() || isSubmittingComment}
                    className="bg-primary hover:bg-primary/90"
                    data-testid={`button-submit-comment-${post.id}`}
                  >
                    {isSubmittingComment ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Posting...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane mr-2"></i>
                        Post Comment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Display Comments */}
        {post.comments && post.comments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Comments</h4>
            {post.comments.slice(0, 3).map((comment) => (
              <div key={comment.id} className="flex space-x-3 p-3 bg-gray-50 rounded-lg">
                <img
                  src={comment.user?.profileImageUrl || `https://ui-avatars.com/api/?name=${comment.user?.username || 'User'}&background=random`}
                  alt={`${comment.user?.username || 'User'} profile`}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      @{comment.user?.username}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(comment.createdAt)}
                    </span>
                    {showModerationStatus && (
                      <Badge className={`text-xs ${getModerationStatusColor(comment.moderationStatus)}`}>
                        {comment.moderationStatus}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-800">{comment.content}</p>
                  {showModerationStatus && comment.moderationReason && (
                    <p className="text-xs text-red-600 mt-1">
                      {formatModerationReason(comment.moderationReason)}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {post.comments.length > 3 && (
              <Button variant="ghost" size="sm" className="text-blue-600">
                View all {post.comments.length} comments
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
