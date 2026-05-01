import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PendingContent } from "@/lib/types";
import { formatTimeAgo } from "@/lib/moderation";

interface HeaderProps {
  user: any;
  onLogout: () => void;
}

interface LiveNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "warning" | "info" | "success";
  isRead: boolean;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [time, setTime] = useState(new Date());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const prevItemIds = useRef<Set<string>>(new Set());
  const currentUser = user || {};

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live pending/flagged content — same endpoint the Content Review page uses
  const { data: pendingContent } = useQuery<PendingContent>({
    queryKey: ["/api/moderation/pending"],
    refetchInterval: 10000,
  });

  // Build dynamic notifications from pending posts + comments
  const liveNotifications: LiveNotification[] = [
    ...(pendingContent?.posts ?? []).map((post) => ({
      id: `post-${post.id}`,
      title:
        post.moderationStatus === "flagged"
          ? "Flagged post needs review"
          : "Post pending moderation",
      message: post.content.slice(0, 80) + (post.content.length > 80 ? "…" : ""),
      time: formatTimeAgo(post.createdAt),
      type: (post.moderationStatus === "flagged" ? "warning" : "info") as
        | "warning"
        | "info"
        | "success",
      isRead: readIds.has(`post-${post.id}`),
    })),
    ...(pendingContent?.comments ?? []).map((comment) => ({
      id: `comment-${comment.id}`,
      title:
        comment.moderationStatus === "flagged"
          ? "Flagged comment needs review"
          : "Comment pending moderation",
      message:
        comment.content.slice(0, 80) + (comment.content.length > 80 ? "…" : ""),
      time: formatTimeAgo(comment.createdAt),
      type: (comment.moderationStatus === "flagged" ? "warning" : "info") as
        | "warning"
        | "info"
        | "success",
      isRead: readIds.has(`comment-${comment.id}`),
    })),
  ];

  // When new items arrive that we haven't seen before, unmark them so they appear unread
  useEffect(() => {
    const newIds = new Set(liveNotifications.map((n) => n.id));
    // Any id that wasn't in the previous set is brand new — keep it unread
    const brandNew = [...newIds].filter((id) => !prevItemIds.current.has(id));
    if (brandNew.length > 0) {
      setReadIds((prev) => {
        const next = new Set(prev);
        brandNew.forEach((id) => next.delete(id)); // ensure new items count as unread
        return next;
      });
    }
    prevItemIds.current = newIds;
  }, [pendingContent]);

  const unreadCount = liveNotifications.filter((n) => !n.isRead).length;

  const handleOpenNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    // Mark all current notifications as read when opening
    if (next) {
      setReadIds(new Set(liveNotifications.map((n) => n.id)));
    }
  };

  const getCurrentPageTitle = () => {
    const path = window.location.pathname;
    switch (path) {
      case "/":
        return "Dashboard Overview";
      case "/content-review":
        return "Content Review Queue";
      case "/users":
        return "User Management";
      case "/analytics":
        return "Analytics & Reports";
      case "/social-demo":
        return "Social Media Demo";
      case "/settings":
        return "System Settings";
      default:
        return "Dashboard Overview";
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "warning":
        return "fas fa-exclamation-triangle text-orange-500";
      case "success":
        return "fas fa-check-circle text-green-500";
      default:
        return "fas fa-info-circle text-blue-500";
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
              Live updates active •{" "}
              {time.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Real-time Status */}
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-700 rounded-full">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Live Monitoring</span>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                className="relative p-2 text-gray-500 hover:text-gray-700 transition-colors"
                onClick={handleOpenNotifications}
                data-testid="button-notifications"
                aria-label={`Notifications — ${unreadCount} unread`}
              >
                <i className="fas fa-bell text-lg"></i>
                {/* Badge — only shown when there are unread items */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 animate-bounce">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white shadow-2xl rounded-lg border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Notifications
                      </h3>
                      <div className="flex items-center gap-2">
                        {liveNotifications.length > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {liveNotifications.length} item
                            {liveNotifications.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        <button
                          className="text-gray-400 hover:text-gray-600"
                          onClick={() => setShowNotifications(false)}
                          data-testid="button-close-notifications"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {liveNotifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <i className="fas fa-check-circle text-3xl text-green-400 mb-3 block"></i>
                        <p className="text-sm font-medium">All clear!</p>
                        <p className="text-xs mt-1">No content pending review.</p>
                      </div>
                    ) : (
                      liveNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`p-4 hover:bg-gray-50 border-b border-gray-100 transition-colors ${!notification.isRead ? "bg-blue-50/40" : ""
                            }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-0.5">
                              <i className={`fas ${getNotificationIcon(notification.type).replace("fas ", "")} text-sm`}
                                style={{ color: notification.type === "warning" ? "#f97316" : notification.type === "success" ? "#22c55e" : "#3b82f6" }}
                              ></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-gray-900 leading-snug">
                                  {notification.title}
                                </p>
                                {!notification.isRead && (
                                  <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                                {notification.message}
                              </p>
                              <span className="text-xs text-gray-400 mt-1 block">
                                {notification.time}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {liveNotifications.length > 0 && (
                    <div className="p-3 border-t border-gray-100 text-center">
                      <a
                        href="/content-review"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View all in Content Review{" "}
                        <i className="fas fa-arrow-right text-xs ml-1"></i>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center space-x-3">
              <img
                src={
                  currentUser.profileImageUrl ||
                  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=32&h=32"
                }
                alt="Admin Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {currentUser.firstName || ""} {currentUser.lastName || ""}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {currentUser.role || "admin"}
                </p>
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
