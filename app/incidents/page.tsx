"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getIncidents, getTeams, getUsers } from "@/lib/api-client";
import { Incident, Team, User, IncidentFilters, IncidentStatus, Severity } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  UserCircle,
} from "lucide-react";

const STATUSES = ["open", "investigating", "identified", "monitoring", "resolved", "closed"];
const SEVERITIES = ["critical", "high", "medium", "low"];

function IncidentCard({ incident }: { incident: Incident }) {
  const severityClass = `severity-${incident.severity}`;
  const statusClass = `status-${incident.status.replace("_", "-")}`;
  const assignee = incident.profiles_incidents_assigned_to_fkey;

  return (
    <Link href={`/incidents/${incident.id}`}>
      <Card className="hover:border-primary/40 transition-colors hover:shadow-lg hover:shadow-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded ${severityClass}`}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <h3 className="font-semibold text-sm truncate">{incident.title}</h3>
              </div>
              {incident.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {incident.description}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${severityClass} text-[10px] capitalize`}>
                  {incident.severity}
                </Badge>
                <Badge className={`${statusClass} text-[10px] capitalize`}>
                  {incident.status}
                </Badge>
                {assignee && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <UserCircle className="h-3 w-3" />
                    {assignee.name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground flex-shrink-0">
              <p>{new Date(incident.created_at).toLocaleDateString()}</p>
              <p>{new Date(incident.created_at).toLocaleTimeString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function IncidentsListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const page = parseInt(searchParams.get("page") || "1");
  const status = searchParams.get("status") || undefined;
  const severity = searchParams.get("severity") || undefined;
  const team_id = searchParams.get("team_id") || undefined;
  const assigned_to = searchParams.get("assigned_to") || undefined;
  const q = searchParams.get("q") || undefined;

  useEffect(() => {
    getTeams().then((res) => setTeams(res.data || [])).catch(() => {});
    getUsers({ limit: 100 }).then((res) => setUsers(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const filters: IncidentFilters = {
      page,
      limit: 15,
      status: status as IncidentStatus,
      severity: severity as Severity,
      team_id,
      assigned_to,
      q
    };
    getIncidents(filters)
      .then((res) => {
        setIncidents(res.data || []);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.total_pages);
      })
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  }, [page, status, severity, team_id, assigned_to, q]);

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    if (!updates.page) params.set("page", "1");
    router.push(`/incidents?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push("/incidents");
  };

  const hasFilters = status || severity || team_id || assigned_to;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incidents</h1>
          <p className="text-muted-foreground text-sm">{total} total incidents</p>
        </div>
        <Link href="/incidents/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Incident
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search incidents..."
                className="pl-9"
                defaultValue={q}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) updateParams({ q: value });
                  else updateParams({ q: undefined });
                }}
              />
            </div>

            <Select value={status || "all"} onValueChange={(v) => updateParams({ status: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severity || "all"} onValueChange={(v) => updateParams({ severity: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={team_id || "all"} onValueChange={(v) => updateParams({ team_id: v === "all" ? undefined : v })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Incidents Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <AlertTriangle className="h-5 w-5 animate-pulse text-primary" />
        </div>
      ) : incidents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No incidents found</p>
            <Link href="/incidents/new">
              <Button variant="link" className="mt-2">Create your first incident</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incidents.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function IncidentsListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><AlertTriangle className="h-5 w-5 animate-pulse text-primary" /></div>}>
      <IncidentsListContent />
    </Suspense>
  );
}
