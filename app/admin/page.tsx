"use client";

import { useEffect, useState, useCallback } from "react";
import { getServiceInfo, getServiceHealth } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Server,
  Database,
  Shield,
  ArrowRightLeft,
  Activity,
  RefreshCw,
  AlertTriangle,
  Users,
  Bell,
  Cpu,
  CircleDot,
  Clock,
} from "lucide-react";

const serviceIcons: Record<string, React.ReactNode> = {
  "incidents-api": <AlertTriangle className="h-5 w-5" />,
  "users-api": <Users className="h-5 w-5" />,
  "notifications-api": <Bell className="h-5 w-5" />,
};

const serviceDescriptions: Record<string, string> = {
  "incidents-api": "Incident lifecycle, comments, timeline",
  "users-api": "Profiles, roles, team management",
  "notifications-api": "Alerts, read tracking, webhooks",
};

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "healthy"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : status === "degraded"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
        : "bg-red-500/10 text-red-400 border-red-500/20";

  return (
    <Badge variant="outline" className={`${variant} gap-1 font-medium`}>
      <CircleDot className="h-2.5 w-2.5 fill-current" />
      {status}
    </Badge>
  );
}

interface HealthService {
  service: string;
  prefix: string;
  status: string;
  latency_ms: number;
}

export default function AdminPage() {
  const [serviceInfo, setServiceInfo] = useState<{
    architecture: string;
    version: string;
    routes: {
      prefix: string;
      service: string;
      description: string;
      url: string;
    }[];
  } | null>(null);
  const [health, setHealth] = useState<{
    architecture: string;
    status: string;
    services: HealthService[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [info, healthData] = await Promise.all([
        getServiceInfo().catch(() => null),
        getServiceHealth().catch(() => null),
      ]);
      if (info) setServiceInfo(info);
      if (healthData)
        setHealth(
          healthData as {
            architecture: string;
            status: string;
            services: HealthService[];
          },
        );
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const services = health?.services || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Architecture</h1>
          <p className="text-muted-foreground text-sm">
            Microservice topology and health
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
          disabled={loading}
          className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <Card>
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Service Topology
          </CardTitle>
          <CardDescription>
            Request flow: Client to Edge Functions to PostgreSQL
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3 px-6 py-3 rounded-lg border-2 border-dashed border-border bg-muted/20">
              <Activity className="h-5 w-5 text-primary" />
              <div className="text-center">
                <p className="font-semibold text-sm">Next.js Client</p>
                <p className="text-xs text-muted-foreground">
                  Frontend Application
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-border" />
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground -mt-1" />
              <p className="text-[10px] text-muted-foreground font-mono mt-1">
                REST / JSON
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
              {services.map((svc) => (
                <div
                  key={svc.service}
                  className="flex flex-col items-center px-4 py-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 mb-1">
                    {serviceIcons[svc.service] || (
                      <Server className="h-5 w-5" />
                    )}
                    <span className="font-semibold text-xs">{svc.service}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1">
                    {serviceDescriptions[svc.service]}
                  </p>
                  <StatusBadge status={svc.status} />
                  {svc.latency_ms > 0 && (
                    <span className="text-xs font-mono text-muted-foreground mt-1">
                      {svc.latency_ms}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-border" />
              <Database className="h-4 w-4 text-muted-foreground -mt-1" />
            </div>
            <div className="px-8 py-3 rounded-xl border-2 border-accent/30 bg-accent/5">
              <div className="flex items-center gap-3">
                <Database className="h-6 w-6 text-accent" />
                <div className="text-center">
                  <p className="font-bold">PostgreSQL</p>
                  <p className="text-xs text-muted-foreground">
                    Supabase + Row Level Security
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {serviceInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Direct Service Routes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Route
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Service
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {serviceInfo.routes.map((route, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2.5 px-3">
                        <code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-xs">
                          {route.prefix}
                        </code>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs">
                        {route.service}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {route.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-accent" /> Tables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {[
              "teams",
              "profiles",
              "incidents",
              "incident_comments",
              "incident_timeline",
              "notifications",
              "audit_logs",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2 text-xs">
                <div className="h-2 w-2 rounded-full bg-accent" />
                <code className="font-mono">{t}</code>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" /> RLS Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>All tables have RLS enabled.</p>
            <p>
              Role-based CRUD: admin (full), engineer (create/update), viewer
              (read-only).
            </p>
            <p>Notifications scoped to owner user only.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" /> Runtime
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>Deno Edge Functions with TypeScript.</p>
            <p>Auto-scaling, global edge deployment.</p>
            <p>JWT auth sent directly to each service function.</p>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        <Clock className="h-3 w-3 inline mr-1" />
        Last refreshed: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
}
