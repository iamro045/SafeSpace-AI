import { useQuery } from "@tanstack/react-query";
import StatsCard from "@/components/analytics/stats-card";
import DetectionInsights from "@/components/analytics/detection-insights";
import ContentQueue from "@/components/moderation/content-queue";
import ModerationActions from "@/components/moderation/moderation-action";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DashboardAnalytics, PendingContent } from "@/lib/types";

export default function Dashboard() {
  const { toast } = useToast();

  // Fetch dashboard analytics
  const { data: analytics, isLoading, error } = useQuery<DashboardAnalytics>({
    queryKey: ['/api/analytics/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch pending content
  const { data: pendingContent, refetch: refetchPending } = useQuery<PendingContent>({
    queryKey: ['/api/moderation/pending'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Handle moderation actions
  const handleModerationAction = async (contentId: string, contentType: 'post' | 'comment', action: 'approve' | 'reject') => {
    try {
      await apiRequest('POST', '/api/moderation/action', {
        contentId,
        contentType,
        action,
        reason: action === 'reject' ? 'Manual review rejection' : 'Manual review approval'
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

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Dashboard</h3>
          <p className="text-red-600">Failed to load dashboard data. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = analytics?.stats || {
    totalProcessed: 0,
    totalFlagged: 0,
    totalBlocked: 0,
    activeUsers: 0
  };

  const recentActions = analytics?.recentActions || [];
  const detectionInsights = analytics?.detectionInsights || [];
  const languageDistribution = analytics?.languageDistribution || { en: 70, hi: 20, ta: 5, other: 5 };

  return (
    <div className="p-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Content Processed"
          value={stats.totalProcessed}
          change={{ value: "12% from yesterday", trend: "up", color: "green" }}
          icon="fas fa-file-text"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Flagged Content"
          value={stats.totalFlagged}
          change={{ value: "8% from yesterday", trend: "up", color: "orange" }}
          icon="fas fa-exclamation-triangle"
          iconColor="text-orange-500"
        />
        <StatsCard
          title="Blocked Content"
          value={stats.totalBlocked}
          change={{ value: "3% from yesterday", trend: "down", color: "green" }}
          icon="fas fa-ban"
          iconColor="text-red-600"
        />
        <StatsCard
          title="Active Users"
          value={stats.activeUsers}
          change={{ value: "5% from yesterday", trend: "up", color: "green" }}
          icon="fas fa-users"
          iconColor="text-green-600"
        />
      </div>

      {/* Content Review Queue & AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ContentQueue
          pendingContent={pendingContent || { posts: [], comments: [] }}
          onAction={handleModerationAction}
        />
        <DetectionInsights
          insights={detectionInsights}
          languageDistribution={languageDistribution}
        />
      </div>

      {/* Recent Actions & User Reputation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModerationActions actions={recentActions} />
        
        {/* User Reputation Insights */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">User Reputation Insights</h3>
              <div className="flex space-x-2">
                <button className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                  7d
                </button>
                <button className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md">
                  30d
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {/* Top Violators */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Users Requiring Attention</h4>
                <div className="space-y-3">
                  {analytics?.reputationInsights?.lowReputationUsers?.slice(0, 2).map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center space-x-3">
                        <img 
                          src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.username}&background=ef4444&color=ffffff`}
                          alt="User Profile" 
                          className="w-6 h-6 rounded-full object-cover" 
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">@{user.username}</p>
                          <p className="text-xs text-gray-600">{user.recentViolations || 0} violations this week</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">
                          {user.reputationScore?.toFixed(1) || '0.0'}/5.0
                        </span>
                        <button className="text-gray-400 hover:text-gray-600">
                          <i className="fas fa-external-link-alt text-xs"></i>
                        </button>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-4 text-gray-500">
                      <i className="fas fa-check-circle text-2xl mb-2 text-green-500"></i>
                      <p className="text-sm">No users requiring attention</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Reputation Distribution */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Reputation Distribution</h4>
                <div className="grid grid-cols-3 gap-3">
                  {analytics?.reputationInsights?.distribution?.map((dist) => (
                    <div key={dist.range} className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className={`text-lg font-bold ${
                        dist.range === '1-2' ? 'text-red-600' :
                        dist.range === '2-4' ? 'text-orange-500' : 'text-green-600'
                      }`}>
                        {dist.count}
                      </p>
                      <p className="text-xs text-gray-600">{dist.label}</p>
                    </div>
                  )) || (
                    <>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-lg font-bold text-red-600">0</p>
                        <p className="text-xs text-gray-600">Low (1-2)</p>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <p className="text-lg font-bold text-orange-500">0</p>
                        <p className="text-xs text-gray-600">Medium (2-4)</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-lg font-bold text-green-600">0</p>
                        <p className="text-xs text-gray-600">High (4-5)</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
