"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getNotifications, markNotificationRead, markAllRead, deleteNotification } from "@/lib/api-client";
import { Notification } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CheckCheck,
  Trash2,
  AlertTriangle,
  UserPlus,
  MessageSquare,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  incident_created: <AlertTriangle className="h-4 w-4" />,
  incident_assigned: <UserPlus className="h-4 w-4" />,
  incident_updated: <AlertTriangle className="h-4 w-4" />,
  incident_resolved: <CheckCircle2 className="h-4 w-4" />,
  comment_added: <MessageSquare className="h-4 w-4" />,
};

function NotificationCard({ notification, onRead, onDelete }: {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
}) {
  const Icon = typeIcons[notification.type] || <Bell className="h-4 w-4" />;

  return (
    <Card className={`transition-colors ${notification.is_read ? "opacity-60" : "border-primary/30 bg-primary/5"}`}>
      <CardContent className="pt-4">
        <div className="flex gap-4">
          <div className={`p-2 rounded-lg ${notification.is_read ? "bg-muted" : "bg-primary/10"}`}>
            {Icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`font-medium text-sm ${notification.is_read ? "" : "text-foreground"}`}>
                  {notification.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
              </div>
              <p className="text-[11px] text-muted-foreground whitespace-nowrap">
                {new Date(notification.created_at).toLocaleDateString()}
              </p>
            </div>
            {notification.incidents && (
              <Link href={`/incidents/${notification.incidents.id}`} className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
                View incident
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {!notification.is_read && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRead}>
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getNotifications({ limit: 50, unread_only: unreadOnly });
      setNotifications(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount} unread
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={unreadOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            {unreadOnly ? "Show All" : "Unread Only"}
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Bell className="h-5 w-5 animate-pulse text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {unreadOnly ? "No unread notifications" : "No notifications"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onRead={() => handleMarkRead(notification.id)}
              onDelete={() => handleDelete(notification.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
