"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  Bell,
  ClipboardList,
  Activity,
  LogOut,
  Menu,
  X,
  Server,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { getUnreadCount } from "@/lib/api-client";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/notifications", label: "Notifications", icon: Bell, showBadge: true },
  { href: "/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/audit", label: "Audit Log", icon: ClipboardList, adminOnly: true },
  { href: "/admin", label: "Architecture", icon: Server },
];

function NavItem({
  item,
  active,
  unread,
  onClick,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  unread: number;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      }`}
    >
      <Icon
        className={`h-4 w-4 flex-shrink-0 transition-colors ${
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        }`}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.showBadge && unread > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      {active && <ChevronRight className="h-3.5 w-3.5 text-primary/50" />}
    </Link>
  );
}

function Sidebar({
  open,
  onClose,
  unread,
}: {
  open: boolean;
  onClose: () => void;
  unread: number;
}) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = profile?.role === "admin";

  const filteredNav = navItems.filter((item) => !item.adminOnly || isAdmin);

  const isActive = (item: (typeof navItems)[number]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border/60 bg-card transition-transform duration-200 ease-in-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border/60 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight">Incident Command</p>
            <p className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Platform
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Navigation
          </div>
          <div className="space-y-0.5">
            {filteredNav.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={isActive(item)}
                unread={unread}
                onClick={onClose}
              />
            ))}
          </div>
        </nav>

        {/* User profile */}
        <div className="border-t border-border/60 p-3">
          {profile ? (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary ring-1 ring-primary/20">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{profile.name}</p>
                <p className="truncate text-[11px] capitalize text-muted-foreground">
                  {profile.role}
                </p>
              </div>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}

function Header({
  onMenuClick,
  unread,
}: {
  onMenuClick: () => void;
  unread: number;
}) {
  const pathname = usePathname();

  const currentPage = navItems.find((item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)
  );

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1">
        {currentPage && (
          <h2 className="text-sm font-semibold text-muted-foreground">
            {currentPage.label}
          </h2>
        )}
      </div>

      <Link href="/notifications">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          )}
        </Button>
      </Link>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname.startsWith("/auth");

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getUnreadCount();
      setUnread(res.count);
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Auth redirect
  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthPage) {
      router.replace("/auth/login");
    }
  }, [user, loading, isAuthPage, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
            <Shield className="h-6 w-6 animate-pulse text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Loading Incident Command...</p>
        </div>
      </div>
    );
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unread={unread}
      />
      <div className="flex min-h-screen flex-col md:pl-64">
        <Header onMenuClick={() => setSidebarOpen(true)} unread={unread} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
