"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getIncident, updateIncident, addIncidentComment, getUsers } from "@/lib/api-client";
import { Incident, User, IncidentComment, IncidentTimelineEvent } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  AlertTriangle,
  UserCircle,
  Clock,
  MessageSquare,
  Activity,
  CheckCircle2,
  Loader2,
  Edit,
} from "lucide-react";

const STATUSES = ["open", "investigating", "identified", "monitoring", "resolved", "closed"];
const SEVERITIES = ["low", "medium", "high", "critical"];

function TimelineEvent({ event }: { event: IncidentTimelineEvent }) {
  const isStatusChange = event.event_type === "status_changed";
  const isCreated = event.event_type === "created";

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`h-2 w-2 rounded-full ${isCreated ? "bg-primary" : isStatusChange ? "bg-accent" : "bg-muted-foreground"}`} />
        <div className="flex-1 w-px bg-border" />
      </div>
      <div className="pb-6">
        <p className="text-xs text-muted-foreground">
          {new Date(event.created_at).toLocaleString()}
        </p>
        <p className="text-sm font-medium mt-0.5">{event.description}</p>
        {event.profiles && (
          <p className="text-xs text-muted-foreground mt-1">
            by {event.profiles.name}
          </p>
        )}
      </div>
    </div>
  );
}

function CommentCard({ comment }: { comment: IncidentComment }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
            {comment.profiles?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <span className="text-sm font-medium">{comment.profiles?.name || "Unknown"}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(comment.created_at).toLocaleString()}
        </p>
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
      {comment.is_internal && (
        <Badge variant="secondary" className="mt-2 text-[10px]">
          Internal
        </Badge>
      )}
    </div>
  );
}

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const incidentId = params.id as string;

  useEffect(() => {
    loadIncident();
    getUsers({ limit: 100 }).then((res) => setUsers(res.data || [])).catch(() => {});
  }, [incidentId]);

  const loadIncident = async () => {
    setLoading(true);
    try {
      const res = await getIncident(incidentId);
      setIncident(res.data);
    } catch {
      setIncident(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!incident) return;
    setUpdating(true);
    try {
      await updateIncident(incident.id, { status: newStatus });
      await loadIncident();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleSeverityChange = async (newSeverity: string) => {
    if (!incident) return;
    setUpdating(true);
    try {
      await updateIncident(incident.id, { severity: newSeverity });
      await loadIncident();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignment = async (userId: string) => {
    if (!incident) return;
    setUpdating(true);
    try {
      await updateIncident(incident.id, { assigned_to: userId || null });
      await loadIncident();
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !incident) return;

    setSubmittingComment(true);
    try {
      await addIncidentComment(incident.id, commentText.trim());
      setCommentText("");
      await loadIncident();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-5 w-5 animate-pulse text-primary" />
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

  const severityClass = `severity-${incident.severity}`;
  const statusClass = `status-${incident.status.replace("_", "-")}`;
  const assignee = incident.profiles_incidents_assigned_to_fkey;
  const creator = incident.profiles;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/incidents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`p-2 rounded-lg ${severityClass}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold">{incident.title}</h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge className={`${severityClass} capitalize`}>{incident.severity}</Badge>
              <Badge className={`${statusClass} capitalize`}>{incident.status}</Badge>
              <span className="mx-2">•</span>
              <Clock className="h-3.5 w-3.5" />
              <span>Created {new Date(incident.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <Link href={`/incidents/${incident.id}/edit`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Edit className="h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                {incident.description || "No description provided."}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {incident.comments && incident.comments.length > 0 ? (
                <div className="space-y-4">
                  {incident.comments.map((comment) => (
                    <CommentCard key={comment.id} comment={comment} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet
                </p>
              )}

              <Separator />

              <form onSubmit={handleAddComment} className="space-y-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                />
                <Button type="submit" size="sm" disabled={submittingComment || !commentText.trim()}>
                  {submittingComment && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Add Comment
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={incident.status}
                  onValueChange={handleStatusChange}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Severity</Label>
                <Select
                  value={incident.severity}
                  onValueChange={handleSeverityChange}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Assigned To</Label>
                <Select
                  value={incident.assigned_to || "none"}
                  onValueChange={(v) => handleAssignment(v === "none" ? "" : v)}
                  disabled={updating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {creator?.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-medium">{creator?.name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">Creator</p>
                </div>
              </div>
              {assignee && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                    {assignee.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{assignee.name}</p>
                    <p className="text-xs text-muted-foreground">Assignee</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incident.timeline && incident.timeline.length > 0 ? (
                <div className="relative">
                  {incident.timeline.map((event) => (
                    <TimelineEvent key={event.id} event={event} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No events recorded
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
