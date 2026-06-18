"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getIncident, updateIncident, getTeams, getUsers } from "@/lib/api-client";
import { Incident, Team, User } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";

const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["open", "investigating", "identified", "monitoring", "resolved", "closed"];

export default function EditIncidentPage() {
  const params = useParams();
  const router = useRouter();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [status, setStatus] = useState("open");
  const [teamId, setTeamId] = useState("none");
  const [assignedTo, setAssignedTo] = useState("none");

  const incidentId = params.id as string;

  useEffect(() => {
    Promise.all([
      getIncident(incidentId),
      getTeams().catch(() => ({ data: [] })),
      getUsers({ limit: 100 }).catch(() => ({ data: [], pagination: { page: 1, limit: 100, total: 0, total_pages: 0 } })),
    ]).then(([res, teamsRes, usersRes]) => {
      const inc = res.data;
      setIncident(inc);
      setTitle(inc.title);
      setDescription(inc.description || "");
      setSeverity(inc.severity);
      setStatus(inc.status);
      setTeamId(inc.team_id || "none");
      setAssignedTo(inc.assigned_to || "none");
      setTeams(teamsRes.data || []);
      setUsers(usersRes.data || []);
    }).catch(() => {
      setError("Failed to load incident");
    }).finally(() => setLoading(false));
  }, [incidentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await updateIncident(incidentId, {
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
        status,
        assigned_to: assignedTo === "none" ? null : assignedTo,
      });
      router.push(`/incidents/${incidentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update incident");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Incident not found</p>
        <Link href="/incidents">
          <Button variant="link" className="mt-2">Back to incidents</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link href={`/incidents/${incidentId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Incident</h1>
          <p className="text-muted-foreground text-sm">Update incident details</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Incident Details</CardTitle>
          <CardDescription>Modify the incident information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief summary of the incident"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the incident..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Team</Label>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Assign To</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Link href={`/incidents/${incidentId}`}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
