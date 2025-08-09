import { useState } from "react";

interface HeaderProps {
  user: any;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    {
      id: '1',
      title: 'High-risk content detected',
      message: 'Deepfake video flagged for immediate review',
      time: '5 minutes ago',
      type: 'warning'
    },
    {
      id: '2',
      title: 'User reputation alert',
      message: 'User @alex_m score dropped below threshold',
      time: '12 minutes ago',
      type: 'info'
    },
    {
      id: '3',
      title: 'AI Model Update',
      message: 'Text analysis model updated to v2.1',
      time: '1 hour ago',
      type: 'success'
    }
  ];

  const getCurrentPageTitle = () => {
    const path = window.location.pathname;
    switch (path) {
      case '/':
        return 'Dashboard Overview';
      case '/content-review':
        return 'Content Review Queue';
      case '/users':
        return 'User Management';
      case '/analytics':
        return 'Analytics & Reports';
      case '/social-demo':
        return 'Social Media Demo';
      case '/settings':
        return 'System Settings';
      default:
        return 'Dashboard Overview';
    }
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {getCurrentPageTitle()}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Last updated: 2 minutes ago
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Real-time Status */}
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-700 rounded-full">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Live Monitoring</span>
            </div>
            
            {/* Notifications */}
            <div className="relative">
              <button 
                className="relative p-2 text-gray-500 hover:text-gray-700"
                onClick={() => setShowNotifications(!showNotifications)}
                data-testid="button-notifications"
              >
                <i className="fas fa-bell text-lg"></i>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white shadow-2xl rounded-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                      <button 
                        className="text-gray-400 hover:text-gray-600"
                        onClick={() => setShowNotifications(false)}
                        data-testid="button-close-notifications"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notification) => (
                      <div key={notification.id} className="p-4 hover:bg-gray-50 border-b border-gray-100">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            <i className={`fas fa-exclamation-triangle ${
                              notification.type === 'warning' ? 'text-yellow-500' :
                              notification.type === 'success' ? 'text-green-500' : 'text-blue-500'
                            }`}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <span className="text-xs text-gray-500 mt-1">
                              {notification.time}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center space-x-3">
              <img 
                src={user.profileImageUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=32&h=32'} 
                alt="Admin Profile" 
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
              <button
                onClick={onLogout}
                className="text-gray-400 hover:text-gray-600 ml-2"
                title="Logout"
                data-testid="button-logout"
              >
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop for notifications */}
      {showNotifications && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowNotifications(false)}
        ></div>
      )}
    </>
  );
}
