"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getIncidentStats, getIncidents } from "@/lib/api-client";
import { IncidentStats, Incident } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ElementType;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="p-2 rounded-lg bg-secondary">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IncidentRow({ incident }: { incident: Incident }) {
  const severityClass = `severity-${incident.severity}`;
  const statusClass = `status-${incident.status.replace("_", "-")}`;

  return (
    <Link href={`/incidents/${incident.id}`}>
      <div className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-secondary/50 transition-colors group">
        <div className={`p-2 rounded-lg ${severityClass}`}>
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{incident.title}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(incident.created_at).toLocaleString()}
          </p>
        </div>
        <Badge className={`${severityClass} capitalize text-[11px]`}>
          {incident.severity}
        </Badge>
        <Badge className={`${statusClass} capitalize text-[11px]`}>
          {incident.status}
        </Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [recent, setRecent] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getIncidentStats().then(setStats).catch(() => null),
      getIncidents({ limit: 10, sort_by: "updated_at" }).then((res) => setRecent(res.data || [])).catch(() => []),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-5 w-5 animate-pulse text-primary" />
      </div>
    );
  }

  const recentIncidents = Array.isArray(recent) ? recent : [];
  const activeIncidents = recentIncidents.filter(
    (i) => !["resolved", "closed"].includes(i.status)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Overview of incidents and system health
          </p>
        </div>
        <Link href="/incidents/new">
          <Button className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            New Incident
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Incidents"
          value={stats?.total || 0}
          icon={Activity}
        />
        <StatCard
          title="Active"
          value={stats?.open || 0}
          description="Open or investigating"
          icon={AlertTriangle}
        />
        <StatCard
          title="Resolved"
          value={stats?.resolved || 0}
          icon={CheckCircle2}
        />
        <StatCard
          title="Critical"
          value={stats?.by_severity?.critical || 0}
          icon={AlertCircle}
        />
      </div>
      {stats?.by_severity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incidents by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {(["critical", "high", "medium", "low"] as const).map((sev) => (
                <div key={sev} className="text-center">
                  <div className={`severity-${sev} rounded-lg py-3 text-2xl font-bold`}>
                    {stats.by_severity[sev] || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 capitalize">{sev}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Active Incidents</CardTitle>
              <CardDescription>Currently open or under investigation</CardDescription>
            </div>
            <Link href="/incidents?status=open">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-2">
          {activeIncidents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No active incidents
            </div>
          ) : (
            <div className="space-y-1">
              {activeIncidents.slice(0, 5).map((incident) => (
                <IncidentRow key={incident.id} incident={incident} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 px-2">
          <div className="space-y-1">
            {recentIncidents.slice(0, 5).map((incident) => (
              <IncidentRow key={incident.id} incident={incident} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
