"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUsers, getTeams, updateUser, createTeam } from "@/lib/api-client";
import { User, Team } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users as UsersIcon,
  Shield,
  UserCog,
  Plus,
  Search,
} from "lucide-react";

const ROLES = ["admin", "engineer", "viewer"];

function UserRow({ user, teams, onRoleChange, onTeamChange }: {
  user: User;
  teams: Team[];
  onRoleChange: (userId: string, role: string) => void;
  onTeamChange: (userId: string, teamId: string | null) => void;
}) {
  const team = user.team || teams.find(t => t.id === user.team_id);

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      <Select value={user.role} onValueChange={(v) => onRoleChange(user.id, v)}>
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r} className="capitalize">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={user.team_id || "none"} onValueChange={(v) => onTeamChange(user.id, v === "none" ? null : v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="No team" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No team</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant={user.is_active ? "default" : "secondary"} className="text-[11px]">
        {user.is_active ? "Active" : "Inactive"}
      </Badge>
    </div>
  );
}

export default function UsersPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newTeamOpen, setNewTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      return;
    }
    loadData();
  }, [isAdmin, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, teamsRes] = await Promise.all([
        getUsers({ limit: 100 }),
        getTeams(),
      ]);
      setUsers(usersRes.data || []);
      setTeams(teamsRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateUser(userId, { role });
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: role as User["role"] } : u)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleTeamChange = async (userId: string, teamId: string | null) => {
    try {
      await updateUser(userId, { team_id: teamId });
      setUsers(users.map((u) => (u.id === userId ? { ...u, team_id: teamId || undefined } : u)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      await createTeam({ name: newTeamName.trim() });
      setNewTeamName("");
      setNewTeamOpen(false);
      const teamsRes = await getTeams();
      setTeams(teamsRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAdmin) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const admins = filteredUsers.filter((u) => u.role === "admin");
  const engineers = filteredUsers.filter((u) => u.role === "engineer");
  const viewers = filteredUsers.filter((u) => u.role === "viewer");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground text-sm">{users.length} users registered</p>
        </div>
        <Dialog open={newTeamOpen} onOpenChange={setNewTeamOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g., Platform Engineering"
                />
              </div>
              <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
                Create Team
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Teams Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <UsersIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Shield className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{admins.length}</p>
                <p className="text-xs text-muted-foreground">Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <UserCog className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{engineers.length}</p>
                <p className="text-xs text-muted-foreground">Engineers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{viewers.length}</p>
                <p className="text-xs text-muted-foreground">Viewers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
          <CardDescription>Manage roles and team assignments</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No users found</div>
          ) : (
            <div>
              {filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  teams={teams}
                  onRoleChange={handleRoleChange}
                  onTeamChange={handleTeamChange}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
