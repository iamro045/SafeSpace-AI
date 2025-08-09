import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreatePost from "@/components/social/create-post";
import PostCard from "@/components/social/post-card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function SocialDemo() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("feed");

  // Fetch posts for the demo
  const { data: posts, refetch: refetchPosts, isLoading } = useQuery({
    queryKey: ['/api/posts'],
    refetchInterval: 10000, // Refresh every 10 seconds to show live moderation
  });

  // Handle post creation
  const handleCreatePost = async (content: string, contentType: string, imageUrl?: string) => {
    try {
      await apiRequest('POST', '/api/posts', {
        content,
        contentType,
        imageUrl,
        language: 'en'
      });

      toast({
        title: "Post created",
        description: "Your post has been submitted for review.",
      });

      refetchPosts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create post.",
        variant: "destructive",
      });
    }
  };

  // Handle comment creation
  const handleCreateComment = async (postId: string, content: string) => {
    try {
      await apiRequest('POST', `/api/posts/${postId}/comments`, {
        content,
        language: 'en'
      });

      toast({
        title: "Comment added",
        description: "Your comment has been submitted for review.",
      });

      refetchPosts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment.",
        variant: "destructive",
      });
    }
  };

  // Filter posts based on selected tab
  const filteredPosts = posts?.filter(post => {
    switch (selectedTab) {
      case 'approved':
        return post.moderationStatus === 'approved';
      case 'pending':
        return post.moderationStatus === 'pending' || post.moderationStatus === 'flagged';
      case 'blocked':
        return post.moderationStatus === 'rejected';
      default:
        return true; // Show all posts for feed
    }
  }) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="h-20 bg-gray-200 rounded"></div>
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
        <h1 className="text-2xl font-bold text-gray-900">Social Media Demo</h1>
        <p className="text-gray-600">
          Experience real-time content moderation in action. Create posts and see how AI detects and flags content.
        </p>
      </div>

      {/* Demo Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {posts?.length || 0}
            </div>
            <div className="text-sm text-gray-600">Total Posts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {posts?.filter(p => p.moderationStatus === 'approved').length || 0}
            </div>
            <div className="text-sm text-gray-600">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-500">
              {posts?.filter(p => p.moderationStatus === 'pending' || p.moderationStatus === 'flagged').length || 0}
            </div>
            <div className="text-sm text-gray-600">Under Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {posts?.filter(p => p.moderationStatus === 'rejected').length || 0}
            </div>
            <div className="text-sm text-gray-600">Blocked</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-3">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create a Post</CardTitle>
              <p className="text-sm text-gray-600">
                Try posting different types of content to see how the AI moderation system responds.
              </p>
            </CardHeader>
            <CardContent>
              <CreatePost onCreatePost={handleCreatePost} />
            </CardContent>
          </Card>

          {/* Post Filters */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="feed" data-testid="tab-all-posts">
                All Posts ({posts?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="approved" data-testid="tab-approved-posts">
                Approved ({posts?.filter(p => p.moderationStatus === 'approved').length || 0})
              </TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending-posts">
                Review ({posts?.filter(p => p.moderationStatus === 'pending' || p.moderationStatus === 'flagged').length || 0})
              </TabsTrigger>
              <TabsTrigger value="blocked" data-testid="tab-blocked-posts">
                Blocked ({posts?.filter(p => p.moderationStatus === 'rejected').length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              <div className="space-y-4">
                {filteredPosts.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <i className={`fas ${
                        selectedTab === 'approved' ? 'fa-check-circle text-green-500' :
                        selectedTab === 'pending' ? 'fa-clock text-orange-500' :
                        selectedTab === 'blocked' ? 'fa-ban text-red-500' : 'fa-comments text-blue-500'
                      } text-6xl mb-4`}></i>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {selectedTab === 'feed' ? 'No Posts Yet' :
                         selectedTab === 'approved' ? 'No Approved Posts' :
                         selectedTab === 'pending' ? 'No Posts Under Review' :
                         'No Blocked Posts'}
                      </h3>
                      <p className="text-gray-600">
                        {selectedTab === 'feed' ? 'Create your first post to get started!' :
                         selectedTab === 'approved' ? 'No posts have been approved yet.' :
                         selectedTab === 'pending' ? 'All posts have been reviewed.' :
                         'No posts have been blocked by the AI moderation system.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onComment={handleCreateComment}
                      showModerationStatus={true}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Live Moderation Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live Moderation</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Text Analysis</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Image Detection</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Language Support</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">EN, HI</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demo Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Try These Examples</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="font-medium text-green-800 mb-1">Safe Content</p>
                  <p className="text-green-700">"Just had an amazing lunch at the new restaurant downtown!"</p>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="font-medium text-orange-800 mb-1">Potentially Flagged</p>
                  <p className="text-orange-700">"This is such stupid weather today, I hate it so much!"</p>
                </div>
                
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="font-medium text-red-800 mb-1">Likely Blocked</p>
                  <p className="text-red-700">"I hate everyone and want them to disappear forever!"</p>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="font-medium text-blue-800 mb-1">Multi-language Test</p>
                  <p className="text-blue-700">"यह बहुत अच्छा है! (This is very good!)"</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Moderation Features */}
          <Card>
            <CardHeader>
              <CardTitle>AI Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <i className="fas fa-language text-blue-500"></i>
                  <div>
                    <p className="text-sm font-medium">Multi-language Detection</p>
                    <p className="text-xs text-gray-500">English, Hindi, and more</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <i className="fas fa-brain text-purple-500"></i>
                  <div>
                    <p className="text-sm font-medium">Sentiment Analysis</p>
                    <p className="text-xs text-gray-500">Detects toxic and harmful content</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <i className="fas fa-image text-green-500"></i>
                  <div>
                    <p className="text-sm font-medium">Image Moderation</p>
                    <p className="text-xs text-gray-500">NSFW and inappropriate content</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <i className="fas fa-clock text-orange-500"></i>
                  <div>
                    <p className="text-sm font-medium">Real-time Processing</p>
                    <p className="text-xs text-gray-500">Instant content analysis</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <i className="fas fa-shield-alt text-red-500"></i>
                  <div>
                    <p className="text-sm font-medium">User Reputation</p>
                    <p className="text-xs text-gray-500">Behavioral scoring system</p>
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
