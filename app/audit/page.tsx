"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Shield } from "lucide-react";

interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  profiles?: { name: string; email: string };
}

export default function AuditPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      return;
    }
    // Fetch audit logs would go here - for now just show placeholder
    setLoading(false);
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          System audit trail and activity history
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Activity Log
          </CardTitle>
          <CardDescription>Track all system changes and user actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Shield className="h-10 w-10 mx-auto mb-4 opacity-50" />
            <p>Audit logs are visible to administrators only.</p>
            <p className="text-xs mt-2">All actions are logged with timestamps and user attribution.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
