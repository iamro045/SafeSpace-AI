import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { PendingContent } from "@/lib/types";

interface SidebarProps {
  user: any;
}

export default function Sidebar({ user }: SidebarProps) {
  const [location] = useLocation();

  const { data: pending } = useQuery<PendingContent>({
    queryKey: ["/api/moderation/pending"],
    refetchInterval: 5000,
  });

  const pendingCount = (pending?.posts?.length || 0) + (pending?.comments?.length || 0);

  const navigationItems = [
    { path: '/', label: 'Dashboard', icon: 'fas fa-chart-line' },
    { path: '/content-review', label: 'Content Review', icon: 'fas fa-flag' },
    { path: '/users', label: 'User Management', icon: 'fas fa-users' },
    { path: '/analytics', label: 'Analytics', icon: 'fas fa-chart-bar' },
    { path: '/social-demo', label: 'Social Demo', icon: 'fas fa-share-alt' },
    { path: '/settings', label: 'Settings', icon: 'fas fa-cog' },
  ];

  const aiModels = [
    { name: 'Text Analysis', status: 'active' },
    { name: 'Image Detection', status: 'active' },
    { name: 'Video Analysis', status: 'loading' },
  ];

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'loading':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-shield-alt text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">SafeSpace AI</h1>
            <p className="text-sm text-gray-500">Content Moderation</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="p-4 space-y-2">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <i className={`${item.icon} w-5`}></i>
                <span>{item.label}</span>
                {item.path === "/content-review" && pendingCount > 0 && (
                  <span className="ml-auto bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            AI Models
          </p>
          <div className="space-y-1 text-sm">
            {aiModels.map((model) => (
              <div key={model.name} className="flex items-center justify-between px-3 py-1">
                <span className="text-gray-600">{model.name}</span>
                <div 
                  className={`w-2 h-2 rounded-full ${getStatusIndicator(model.status)}`}
                  title={model.status}
                  data-testid={`ai-model-${model.name.toLowerCase().replace(' ', '-')}`}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
