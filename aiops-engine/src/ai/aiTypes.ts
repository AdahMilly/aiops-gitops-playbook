import type { IncidentReport } from "../engines/generateIncidentReport";

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

  generatedAt: string;
}