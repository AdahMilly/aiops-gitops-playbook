import type { IncidentReport } from "../engines/generateIncidentReport";

export type AIIncidentSeverity =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export type AIIncidentCategory =
  | "Kubernetes"
  | "Application"
  | "Infrastructure"
  | "Database"
  | "Network"
  | "Security"
  | "Unknown";

export interface AIAnalysisInput {
  incidentReport: IncidentReport;
}

export interface AIAnalysisResult {
  summary: string;
  diagnosis: string;
  rootCauseExplanation: string;
  impact: string;
  riskExplanation: string;
  nextActions: string[];
  confidence: number;
  evidenceUsed: string[];
  limitations: string[];
  severity?: AIIncidentSeverity;
  category?: AIIncidentCategory;
  analysisMode?: "ai" | "deterministic";
  generatedAt: string;
}