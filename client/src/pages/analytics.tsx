import { useQuery } from "@tanstack/react-query";
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
import StatsCard from "@/components/analytics/stats-card";
import DetectionInsights from "@/components/analytics/detection-insights";
import type { DashboardAnalytics, ModerationAction } from "@/lib/types";
import {
  downloadTextAsFile,
  exportTableToPdf,
  rowsToCsv,
  type ExportFormat,
} from "@/lib/export";

export default function Analytics() {
  const widthClassFromPercent = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const step = Math.round(clamped / 5) * 5;
    const map: Record<number, string> = {
      0: "w-0",
      5: "w-[5%]",
      10: "w-[10%]",
      15: "w-[15%]",
      20: "w-[20%]",
      25: "w-1/4",
      30: "w-[30%]",
      35: "w-[35%]",
      40: "w-2/5",
      45: "w-[45%]",
      50: "w-1/2",
      55: "w-[55%]",
      60: "w-3/5",
      65: "w-[65%]",
      70: "w-[70%]",
      75: "w-3/4",
      80: "w-4/5",
      85: "w-[85%]",
      90: "w-[90%]",
      95: "w-[95%]",
      100: "w-full",
    };
    return map[step] || "w-full";
  };

  const barHeights = [
    "h-6",
    "h-8",
    "h-10",
    "h-12",
    "h-14",
    "h-16",
    "h-18",
    "h-20",
  ] as const;

  // Fetch dashboard analytics
  const { data: analytics, isLoading } = useQuery<DashboardAnalytics>({
    queryKey: ['/api/analytics/dashboard'],
  });

  // Fetch moderation actions
  const { data: actions } = useQuery<ModerationAction[]>({
    queryKey: ['/api/moderation/actions'],
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
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

  const detectionInsights = analytics?.detectionInsights || [];
  const languageDistribution = analytics?.languageDistribution || { en: 70, hi: 20, ta: 5, other: 5 };

  const handleExportReport = (format: ExportFormat) => {
    const exportedAt = new Date().toISOString();

    const statsRows = [
      { metric: "totalProcessed", value: stats.totalProcessed },
      { metric: "totalFlagged", value: stats.totalFlagged },
      { metric: "totalBlocked", value: stats.totalBlocked },
      { metric: "activeUsers", value: stats.activeUsers },
      { metric: "exportedAt", value: exportedAt },
    ];

    const insightRows = detectionInsights.map((i: any) => ({
      type: i.type,
      count: i.count,
      percentage: i.percentage,
    }));

    const actionRows = (actions || []).map((a) => ({
      id: a.id,
      contentType: a.contentType,
      action: a.action,
      isAutomatic: a.isAutomatic,
      confidence: typeof a.confidence === "number" ? a.confidence : "",
      createdAt: a.createdAt,
    }));

    if (format === "csv") {
      const parts = [
        "# Analytics Report",
        "# Stats",
        rowsToCsv(statsRows as any, ["metric", "value"]).trimEnd(),
        "",
        "# Detection Insights",
        rowsToCsv(insightRows as any, ["type", "count", "percentage"]).trimEnd(),
        "",
        "# Moderation Actions",
        rowsToCsv(actionRows as any, ["id", "contentType", "action", "isAutomatic", "confidence", "createdAt"]).trimEnd(),
        "",
      ];
      downloadTextAsFile(parts.join("\n"), "analytics-report.csv", "text/csv;charset=utf-8");
      return;
    }

    exportTableToPdf({
      title: "Analytics Report",
      filename: "analytics-report.pdf",
      tables: [
        {
          headerLabel: "Stats",
          columns: ["metric", "value"],
          rows: statsRows as any,
        },
        {
          headerLabel: "Detection Insights",
          columns: ["type", "count", "percentage"],
          rows: insightRows as any,
        },
        {
          headerLabel: "Moderation Actions",
          columns: ["id", "contentType", "action", "isAutomatic", "confidence", "createdAt"],
          rows: actionRows as any,
        },
      ],
    });
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600">Comprehensive analytics and insights for content moderation</p>
        </div>
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export-analytics">
                <i className="fas fa-download mr-2"></i>
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportReport("csv")}>
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportReport("pdf")}>
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" data-testid="button-refresh-data">
            <i className="fas fa-sync mr-2"></i>
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Content Processed"
          value={stats.totalProcessed}
          change={{ value: "12% from last week", trend: "up", color: "green" }}
          icon="fas fa-file-text"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Flagged for Review"
          value={stats.totalFlagged}
          change={{ value: "8% from last week", trend: "up", color: "orange" }}
          icon="fas fa-flag"
          iconColor="text-orange-500"
        />
        <StatsCard
          title="Blocked Content"
          value={stats.totalBlocked}
          change={{ value: "15% from last week", trend: "up", color: "red" }}
          icon="fas fa-ban"
          iconColor="text-red-600"
        />
        <StatsCard
          title="Active Users"
          value={stats.activeUsers}
          change={{ value: "5% from last week", trend: "up", color: "green" }}
          icon="fas fa-users"
          iconColor="text-green-600"
        />
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="ai-performance" data-testid="tab-ai-performance">AI Performance</TabsTrigger>
          <TabsTrigger value="user-behavior" data-testid="tab-user-behavior">User Behavior</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DetectionInsights
              insights={detectionInsights}
              languageDistribution={languageDistribution}
            />
            
            {/* Content Moderation Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Moderation Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {actions?.slice(0, 10).map((action, index) => (
                    <div key={action.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                      <div className={`w-3 h-3 rounded-full ${
                        action.action === 'approve' ? 'bg-green-500' :
                        action.action === 'reject' ? 'bg-red-500' : 'bg-orange-500'
                      }`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {action.action.charAt(0).toUpperCase() + action.action.slice(1)}d {action.contentType}
                        </p>
                        <p className="text-xs text-gray-500">
                          {action.isAutomatic ? 'AI' : 'Manual'} • {action.confidence ? `${Math.round(action.confidence * 100)}% confidence` : 'Manual review'}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(action.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-chart-line text-4xl mb-4"></i>
                      <p>No activity data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai-performance" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* AI Model Accuracy */}
            <Card>
              <CardHeader>
                <CardTitle>AI Model Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Text Analysis</span>
                      <span className="text-sm text-gray-600">94.2% accuracy</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full w-[94.2%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Image Detection</span>
                      <span className="text-sm text-gray-600">91.8% accuracy</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full w-[91.8%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Multi-language</span>
                      <span className="text-sm text-gray-600">87.5% accuracy</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full w-[87.5%]"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* False Positive/Negative Rates */}
            <Card>
              <CardHeader>
                <CardTitle>Error Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">5.8%</p>
                    <p className="text-sm text-gray-600">False Positives</p>
                    <p className="text-xs text-gray-500 mt-1">Good content flagged</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">2.4%</p>
                    <p className="text-sm text-gray-600">False Negatives</p>
                    <p className="text-xs text-gray-500 mt-1">Bad content missed</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">0.8s</p>
                    <p className="text-sm text-gray-600">Avg Response</p>
                    <p className="text-xs text-gray-500 mt-1">Processing time</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">99.2%</p>
                    <p className="text-sm text-gray-600">Uptime</p>
                    <p className="text-xs text-gray-500 mt-1">System availability</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="user-behavior" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* User Reputation Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>User Reputation Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.reputationInsights?.distribution?.map((dist) => (
                    <div key={dist.range}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{dist.label}</span>
                        <span className="text-sm text-gray-600">{dist.count} users</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`${
                            dist.range === '1-2' ? 'bg-red-500' :
                            dist.range === '2-4' ? 'bg-orange-500' : 'bg-green-500'
                          } h-2 rounded-full ${widthClassFromPercent((dist.count / (analytics?.stats?.activeUsers || 1)) * 100)}`}
                        ></div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      <p>No reputation data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Most Active Violators */}
            <Card>
              <CardHeader>
                <CardTitle>Users Requiring Attention</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.reputationInsights?.lowReputationUsers?.slice(0, 5).map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <img
                          src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                          alt={user.username}
                          className="w-8 h-8 rounded-full"
                        />
                        <div>
                          <p className="text-sm font-medium">@{user.username}</p>
                          <p className="text-xs text-gray-500">
                            {user.recentViolations || 0} violations
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive">
                        {user.reputationScore?.toFixed(1) || '0.0'}/5.0
                      </Badge>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-check-circle text-2xl mb-2 text-green-500"></i>
                      <p>No users requiring attention</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <div className="grid grid-cols-1 gap-6">
            {/* Content Volume Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Content Volume Trends (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {[...Array(30)].map((_, i) => {
                    const heightClass = barHeights[Math.floor(Math.random() * barHeights.length)];
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <div className={`w-full bg-blue-500 rounded-t ${heightClass}`} title={`Day ${i + 1}`}></div>
                        {i % 5 === 0 && (
                          <span className="text-xs text-gray-500 mt-1">
                            {i + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>1 day ago</span>
                  <span>30 days ago</span>
                </div>
              </CardContent>
            </Card>

            {/* Violation Type Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Violation Type Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { type: 'Hate Speech', trend: '+15%', color: 'red' },
                    { type: 'Spam', trend: '-8%', color: 'green' },
                    { type: 'Inappropriate Content', trend: '+3%', color: 'orange' },
                    { type: 'Violence', trend: '-12%', color: 'green' },
                  ].map((item) => (
                    <div key={item.type} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.type}</span>
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm ${
                          item.color === 'red' ? 'text-red-600' :
                          item.color === 'green' ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {item.trend}
                        </span>
                        <i className={`fas ${
                          item.trend.startsWith('+') ? 'fa-arrow-up' : 'fa-arrow-down'
                        } text-xs ${
                          item.color === 'red' ? 'text-red-600' :
                          item.color === 'green' ? 'text-green-600' : 'text-orange-600'
                        }`}></i>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
