import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatTimeAgo, getModerationStatusColor, getContentTypeIcon, formatModerationReason, formatConfidenceScore } from "@/lib/moderation";
import type { PendingContent, ModerationAction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  downloadTextAsFile,
  exportTableToPdf,
  rowsToCsv,
  type ExportFormat,
} from "@/lib/export";

export default function ContentReview() {
  const { toast } = useToast();
  const [selectedFilter, setSelectedFilter] = useState("all");

  const handleExportRecentActions = (format: ExportFormat) => {
    const exportedAt = new Date().toISOString();
    const rows = (recentActions || []).map((a) => ({
      id: a.id,
      contentType: a.contentType,
      action: a.action,
      isAutomatic: a.isAutomatic,
      confidence: typeof a.confidence === "number" ? a.confidence : "",
      reason: a.reason || "",
      createdAt: a.createdAt,
    }));

    const columns = ["id", "contentType", "action", "isAutomatic", "confidence", "reason", "createdAt"];

    if (format === "csv") {
      const parts = [
        "# Moderation Actions Report",
        `# exportedAt: ${exportedAt}`,
        rowsToCsv(rows as any, columns).trimEnd(),
        "",
      ];
      downloadTextAsFile(parts.join("\n"), "moderation-actions-report.csv", "text/csv;charset=utf-8");
      return;
    }

    exportTableToPdf({
      title: "Moderation Actions Report",
      filename: "moderation-actions-report.pdf",
      tables: [
        {
          headerLabel: `exportedAt: ${exportedAt}`,
          columns,
          rows: rows as any,
        },
      ],
    });
  };

  // Fetch pending content
  const { data: pendingContent, refetch: refetchPending, isLoading } = useQuery<PendingContent>({
    queryKey: ['/api/moderation/pending'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch recent actions
  const { data: recentActions } = useQuery<ModerationAction[]>({
    queryKey: ['/api/moderation/actions'],
    refetchInterval: 10000,
  });

  // Handle moderation actions
  const handleModerationAction = async (contentId: string, contentType: 'post' | 'comment', action: 'approve' | 'reject', reason?: string) => {
    try {
      await apiRequest('POST', '/api/moderation/action', {
        contentId,
        contentType,
        action,
        reason: reason || `Manual ${action} by moderator`
      });

      toast({
        title: "Action completed",
        description: `Content ${action === 'approve' ? 'approved' : 'blocked'} successfully.`,
      });

      refetchPending();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete moderation action.",
        variant: "destructive",
      });
    }
  };

  const allContent = [
    ...(pendingContent?.posts?.map(post => ({ ...post, type: 'post' as const })) || []),
    ...(pendingContent?.comments?.map(comment => ({ ...comment, type: 'comment' as const })) || [])
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredContent = selectedFilter === "all" ? allContent : 
    allContent.filter(content => content.moderationStatus === selectedFilter);

  const getAiTheme = (content: any) => {
    const flags = content.aiFlags || [];
    const label = content.aiDetails?.classificationLabel || "";
    
    if (flags.includes('spam') || label === 'spam') {
      return {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        icon: 'text-purple-600',
        textStrong: 'text-purple-800',
        text: 'text-purple-700',
        badge: 'bg-purple-600 hover:bg-purple-700 text-white border-transparent'
      };
    }
    
    if (content.moderationStatus === 'flagged') {
      return {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        icon: 'text-orange-600',
        textStrong: 'text-orange-800',
        text: 'text-orange-700',
        badge: 'bg-orange-500 hover:bg-orange-600 text-white border-transparent'
      };
    }

    if (content.moderationStatus === 'approved') {
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-green-600',
        textStrong: 'text-green-800',
        text: 'text-green-700',
        badge: 'bg-green-600 hover:bg-green-700 text-white border-transparent'
      };
    }

    if (content.moderationStatus === 'pending') {
      return {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        icon: 'text-yellow-600',
        textStrong: 'text-yellow-800',
        text: 'text-yellow-700',
        badge: 'bg-yellow-600 hover:bg-yellow-700 text-white border-transparent'
      };
    }

    // Default to Red for rejected or general violations
    return {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: 'text-red-600',
      textStrong: 'text-red-800',
      text: 'text-red-700',
      badge: 'bg-red-600 hover:bg-red-700 text-white border-transparent'
    };
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-20 bg-gray-200 rounded mb-4"></div>
                <div className="flex space-x-2">
                  <div className="h-8 w-16 bg-gray-200 rounded"></div>
                  <div className="h-8 w-16 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Review Queue</h1>
            <p className="text-gray-600">Review and moderate flagged content</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="bg-orange-100 text-orange-700">
              {filteredContent.length} items pending
            </Badge>
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={selectedFilter} onValueChange={setSelectedFilter} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" data-testid="filter-all">
              All ({allContent.length})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="filter-pending">
              Pending ({allContent.filter(c => c.moderationStatus === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="flagged" data-testid="filter-flagged">
              Flagged ({allContent.filter(c => c.moderationStatus === 'flagged').length})
            </TabsTrigger>
            <TabsTrigger value="high-risk" data-testid="filter-high-risk">
              High Risk ({allContent.filter(c => c.aiConfidence && c.aiConfidence > 0.8).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedFilter} className="mt-6">
            {filteredContent.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <i className="fas fa-check-circle text-6xl text-green-500 mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Content to Review</h3>
                  <p className="text-gray-600">All content has been reviewed or no content matches the selected filter.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredContent.map((content) => (
                  <Card key={`${content.type}-${content.id}`} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            content.moderationStatus === 'flagged' ? 'bg-orange-100' : 'bg-yellow-100'
                          }`}>
                            <i className={`${getContentTypeIcon(content.type === 'post' ? content.contentType || 'text' : 'comment')} ${
                              content.moderationStatus === 'flagged' ? 'text-orange-600' : 'text-yellow-600'
                            }`}></i>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {content.type === 'post' ? 'Post' : 'Comment'} by @{content.user?.username || 'unknown'}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {formatTimeAgo(content.createdAt)} • 
                              {content.user && (
                                <span className="ml-1">
                                  Reputation: {content.user.reputationScore?.toFixed(1) || '5.0'}/5.0
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {(() => {
                            const theme = getAiTheme(content);
                            return (
                              <>
                                <Badge className={getModerationStatusColor(content.moderationStatus)}>
                                  {content.moderationStatus.charAt(0).toUpperCase() + content.moderationStatus.slice(1)}
                                </Badge>
                                {content.aiConfidence && (
                                  <Badge className={theme.badge}>
                                    {formatConfidenceScore(content.aiConfidence)} confidence
                                  </Badge>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Content Preview */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-gray-800 whitespace-pre-wrap line-clamp-3">
                          {content.content}
                        </p>
                        {content.type === 'post' && content.imageUrl && (
                          <div className="mt-3">
                            <img 
                              src={content.imageUrl} 
                              alt="Content" 
                              className="max-w-xs max-h-48 rounded-lg border object-cover"
                            />
                          </div>
                        )}
                      </div>

                      {/* AI Analysis Results */}
                      {content.moderationReason && (() => {
                        const theme = getAiTheme(content);
                        return (
                          <div className={`${theme.bg} border ${theme.border} rounded-lg p-3 mb-4`}>
                            <div className="flex items-start space-x-2">
                              <i className={`fas fa-exclamation-triangle ${theme.icon} mt-0.5`}></i>
                              <div>
                                <p className={`font-medium ${theme.textStrong}`}>AI Detection Result</p>
                                <p className={`text-sm ${theme.text} mt-1`}>
                                  {formatModerationReason(content.moderationReason)}
                                </p>
                                {content.aiDetails && (
                                  <div className={`text-xs ${theme.text} mt-2 space-y-1`}>
                                    {content.aiDetails.classificationLabel && (
                                      <p>
                                        Label: <span className="font-medium">{content.aiDetails.classificationLabel}</span>
                                        {typeof content.aiDetails.severityScore === 'number' && (
                                          <span> • Severity {(content.aiDetails.severityScore * 100).toFixed(0)}%</span>
                                        )}
                                      </p>
                                    )}
                                    {Array.isArray(content.aiDetails.contributingTerms) && content.aiDetails.contributingTerms.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {content.aiDetails.contributingTerms.slice(0, 8).map((t: string, idx: number) => (
                                          <Badge key={`${t}-${idx}`} variant="outline" className={`text-[10px] ${theme.text}`}>
                                            {t}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {content.aiFlags && content.aiFlags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {content.aiFlags.map((flag: string, index: number) => (
                                      <Badge key={index} className={`text-xs ${theme.badge}`}>
                                        {flag.replace('_', ' ')}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Additional Context */}
                      {content.type === 'comment' && content.post && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                          <p className="text-sm text-blue-800">
                            <strong>Comment on post:</strong> {content.post.content.substring(0, 100)}...
                          </p>
                        </div>
                      )}

                      {/* Language Info */}
                      <div className="flex items-center space-x-2 mb-4">
                        {content.language && content.language !== 'en' && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            Language: {content.language.toUpperCase()}
                          </Badge>
                        )}
                        {content.type === 'post' && content.contentType && (
                          <Badge variant="outline">
                            Type: {content.contentType}
                          </Badge>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleModerationAction(content.id, content.type as 'post' | 'comment', 'approve')}
                            data-testid={`button-approve-${content.id}`}
                          >
                            <i className="fas fa-check mr-2"></i>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleModerationAction(content.id, content.type as 'post' | 'comment', 'reject', 'Content violates community guidelines')}
                            data-testid={`button-reject-${content.id}`}
                          >
                            <i className="fas fa-times mr-2"></i>
                            Block
                          </Button>
                        </div>
                        <Button variant="outline" size="sm" data-testid={`button-view-user-${content.user?.id}`}>
                          <i className="fas fa-user mr-2"></i>
                          View User
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Recent Actions Summary */}
      {recentActions && recentActions.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Moderation Actions
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-export-content-review-actions">
                    <i className="fas fa-download mr-2"></i>
                    Export Report
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExportRecentActions("csv")}>
                    Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportRecentActions("pdf")}>
                    Download PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recentActions.slice(0, 5).map((action) => (
                <div key={action.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      action.action === 'approve' ? 'bg-green-100 text-green-600' :
                      action.action === 'reject' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      <i className={`fas ${
                        action.action === 'approve' ? 'fa-check' :
                        action.action === 'reject' ? 'fa-times' : 'fa-flag'
                      } text-sm`}></i>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {action.action.charAt(0).toUpperCase() + action.action.slice(1)}d {action.contentType} from @{action.user?.username || 'unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTimeAgo(action.createdAt)} • {action.isAutomatic ? 'AI' : 'Manual'}
                      </p>
                    </div>
                  </div>
                  {action.confidence && (
                    <Badge variant="outline" className="text-xs">
                      {Math.round(action.confidence * 100)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
