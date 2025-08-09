import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getReputationColor, getReputationLabel } from "@/lib/moderation";
import { ReputationInsights } from "@/lib/types";

interface ReputationCardProps {
  insights?: ReputationInsights;
}

export default function ReputationCard({ insights }: ReputationCardProps) {
  if (!insights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reputation Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-chart-bar text-4xl mb-4"></i>
            <p>No reputation data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reputation Insights</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Average Score */}
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">
              {insights.averageScore.toFixed(1)}/5.0
            </div>
            <div className="text-sm text-gray-600">Platform Average</div>
          </div>

          {/* Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Score Distribution</h4>
            <div className="space-y-3">
              {insights.distribution.map((dist) => (
                <div key={dist.range}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{dist.label}</span>
                    <span className="text-sm text-gray-600">{dist.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        dist.range === '1-2' ? 'bg-red-500' :
                        dist.range === '2-4' ? 'bg-orange-500' : 'bg-green-500'
                      }`}
                      style={{ 
                        width: `${((dist.count / insights.distribution.reduce((sum, d) => sum + d.count, 0)) * 100).toFixed(1)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Problem Users */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Users Requiring Attention</h4>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {insights.lowReputationUsers.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <i className="fas fa-check-circle text-2xl mb-2 text-green-500"></i>
                  <p className="text-sm">No users requiring attention</p>
                </div>
              ) : (
                insights.lowReputationUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-3">
                      <img
                        src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.username}&background=ef4444&color=ffffff`}
                        alt="User Profile"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">@{user.username}</p>
                        <p className="text-xs text-gray-600">
                          {user.recentViolations || 0} violations this week
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getReputationColor(user.reputationScore)}>
                        {user.reputationScore.toFixed(1)}/5.0
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {getReputationLabel(user.reputationScore)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reputation Thresholds */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">System Thresholds</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Ban Threshold</span>
                <Badge variant="destructive" className="text-xs">≤ 1.0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Warning Level</span>
                <Badge className="bg-orange-100 text-orange-700 text-xs">≤ 2.0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Good Standing</span>
                <Badge className="bg-green-100 text-green-700 text-xs">≥ 4.0</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
