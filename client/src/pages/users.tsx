import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getReputationColor, getReputationLabel, formatTimeAgo } from "@/lib/moderation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReputationCard from "@/components/users/reputation-card";

export default function Users() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Fetch users
  const { data: users, refetch: refetchUsers, isLoading } = useQuery({
    queryKey: ['/api/users'],
  });

  // Fetch reputation insights
  const { data: reputationInsights } = useQuery({
    queryKey: ['/api/reputation/insights'],
  });

  // Handle user actions
  const handleUserAction = async (userId: string, action: 'ban' | 'unban' | 'warning') => {
    try {
      const updates = action === 'ban' ? { isBanned: true } :
                     action === 'unban' ? { isBanned: false } :
                     {}; // warning would be handled differently

      await apiRequest('PATCH', `/api/users/${userId}`, updates);

      toast({
        title: "Action completed",
        description: `User ${action}ned successfully.`,
      });

      refetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const filteredUsers = (users || []).filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    switch (selectedFilter) {
      case 'banned':
        return matchesSearch && user.isBanned;
      case 'low-reputation':
        return matchesSearch && user.reputationScore < 2.0;
      case 'high-reputation':
        return matchesSearch && user.reputationScore >= 4.0;
      default:
        return matchesSearch;
    }
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">User Management</h1>
        <p className="text-gray-600">Manage users, monitor reputation scores, and enforce community guidelines</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{users?.length || 0}</p>
              </div>
              <i className="fas fa-users text-blue-600 text-2xl"></i>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Banned Users</p>
                <p className="text-2xl font-bold text-red-600">
                  {users?.filter(u => u.isBanned).length || 0}
                </p>
              </div>
              <i className="fas fa-ban text-red-600 text-2xl"></i>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Low Reputation</p>
                <p className="text-2xl font-bold text-orange-500">
                  {users?.filter(u => u.reputationScore < 2.0).length || 0}
                </p>
              </div>
              <i className="fas fa-exclamation-triangle text-orange-500 text-2xl"></i>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Score</p>
                <p className="text-2xl font-bold text-green-600">
                  {reputationInsights?.averageScore?.toFixed(1) || '5.0'}
                </p>
              </div>
              <i className="fas fa-star text-green-600 text-2xl"></i>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Directory</CardTitle>
                <div className="flex items-center space-x-4">
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    data-testid="input-search-users"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={selectedFilter} onValueChange={setSelectedFilter}>
                <div className="px-6 pb-4">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all" data-testid="filter-all-users">
                      All ({users?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="banned" data-testid="filter-banned">
                      Banned ({users?.filter(u => u.isBanned).length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="low-reputation" data-testid="filter-low-rep">
                      Low Rep ({users?.filter(u => u.reputationScore < 2.0).length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="high-reputation" data-testid="filter-high-rep">
                      High Rep ({users?.filter(u => u.reputationScore >= 4.0).length || 0})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value={selectedFilter} className="m-0">
                  <div className="max-h-96 overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <i className="fas fa-search text-4xl mb-4"></i>
                        <p>No users found matching the current filters</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {filteredUsers.map((user) => (
                          <div key={user.id} className="p-6 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <img
                                  src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${user.username}&background=random`}
                                  alt={`${user.username} profile`}
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                                <div>
                                  <h3 className="font-semibold text-gray-900">
                                    {user.firstName} {user.lastName}
                                  </h3>
                                  <p className="text-sm text-gray-500">@{user.username}</p>
                                  <p className="text-xs text-gray-400">{user.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <div className="flex items-center space-x-2">
                                    <Badge className={getReputationColor(user.reputationScore)}>
                                      {user.reputationScore.toFixed(1)}/5.0
                                    </Badge>
                                    <span className="text-xs text-gray-500">
                                      {getReputationLabel(user.reputationScore)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">
                                    Joined {formatTimeAgo(user.createdAt)}
                                  </p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {user.isBanned ? (
                                    <>
                                      <Badge variant="destructive">Banned</Badge>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUserAction(user.id, 'unban')}
                                        data-testid={`button-unban-${user.id}`}
                                      >
                                        <i className="fas fa-unlock mr-2"></i>
                                        Unban
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Badge variant="outline" className="text-green-700 bg-green-50">
                                        Active
                                      </Badge>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleUserAction(user.id, 'ban')}
                                        data-testid={`button-ban-${user.id}`}
                                      >
                                        <i className="fas fa-ban mr-2"></i>
                                        Ban
                                      </Button>
                                    </>
                                  )}
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {user.role}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Reputation Insights Sidebar */}
        <div className="space-y-6">
          <ReputationCard insights={reputationInsights} />
          
          {/* AI Model Status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Text Analysis</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Active</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Image Detection</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600">Active</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Video Analysis</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-yellow-600">Loading</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
