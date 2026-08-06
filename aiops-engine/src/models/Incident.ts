export type IncidentSeverity = "Low" | "Medium" | "High" | "Critical";

export type IncidentCategory =
  | "Infrastructure"
  | "Application"
  | "Networking"
  | "Observability"
  | "Performance"
  | "Security"
  | "Unknown";

export interface Incident {
  id: string;

  title: string;

  category: IncidentCategory;

  severity: IncidentSeverity;

  confidence: number;

  rootCause?: string;

  symptoms: string[];

  evidence: string[];

  recommendations: string[];

  automation?: string;

  affectedPods: string[];

  affectedServices: string[];

  source: string[];

  timestamp?: string;
}
