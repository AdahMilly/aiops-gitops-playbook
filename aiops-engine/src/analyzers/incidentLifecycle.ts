export type IncidentStatus = "Active" | "Historical" | "Resolved";

export type IncidentCategory =
  | "Infrastructure"
  | "Kubernetes"
  | "Application"
  | "Metrics"
  | "Analysis";

export interface Incident {
  id: string;

  issue: string;

  category: IncidentCategory;

  severity: "Low" | "Medium" | "High" | "Critical";

  status: IncidentStatus;

  firstSeen: string;

  lastSeen: string;

  resolvedAt?: string;

  durationMs?: number;

  occurrences: number;

  evidence: string[];

  source: string;
}

export interface IncidentLifecycleResult {
  incidents: Incident[];

  activeIncidents: Incident[];

  historicalIncidents: Incident[];

  resolvedIncidents: Incident[];
}
