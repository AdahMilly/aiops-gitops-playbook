import { correlate, CorrelationFinding } from "./correlationEngine";

import { findRootCause, RootCauseAnalysis } from "./rootCauseEngine";

import { predict, Prediction } from "./predictionEngine";

import { recommend, Recommendation } from "./recommendationEngine";

import { scoreIncident, IncidentScore } from "./incidentScoringEngine";

import { buildTimeline, TimelineEntry } from "./timelineEngine";

import { mapIncidents } from "../incident/incidentMapper";

import {
  deduplicateIncidents,
  IncidentGroup,
} from "./incidentDeduplicationEngine";

interface GenerateIncidentReportInput {
  health: any;
  telemetry: any;
}

export interface IncidentReport {
  generatedAt: string;

  summary: {
    score: number;
    level: IncidentScore["level"];
    healthy: boolean;
  };

  health: any;

  trends: any;

  rootCause: RootCauseAnalysis | null;

  incidentGroups: IncidentGroup[];

  correlations: CorrelationFinding[];

  predictions: Prediction[];

  recommendations: Recommendation[];

  timeline: TimelineEntry[];
}

export function generateIncidentReport(
  input: GenerateIncidentReportInput,
): IncidentReport {
  const incidents = mapIncidents(input.telemetry.events ?? []);

  const correlations = correlate({
    health: input.health,

    metrics: input.telemetry.metrics,

    trends: input.telemetry.trends,

    logs: input.telemetry.logs ?? [],

    traces: input.telemetry.traces ?? [],

    incidents,
  });

  const actionableCorrelations = correlations.filter(
    (finding) => finding.issue !== "System Healthy",
  );

  const incidentGroups = deduplicateIncidents(actionableCorrelations);

  const rootCause = findRootCause(correlations);

  const predictions = predict({
    health: input.health,

    trends: input.telemetry.trends,

    correlations,

    rootCause,
  });

  const recommendations = recommend(rootCause, incidentGroups, predictions);

  const score = scoreIncident({
    health: input.health,

    correlations,

    predictions,

    trends: input.telemetry.trends,

    rootCause,
  });

  const timeline = buildTimeline({
    health: input.health,

    correlations,

    predictions,

    incidents,
  });

  return {
    generatedAt: new Date().toISOString(),

    summary: {
      score: score.score,

      level: score.level,

      healthy: input.health.healthy,
    },

    health: input.health,

    trends: input.telemetry.trends,

    rootCause,

    incidentGroups,

    correlations,

    predictions,

    recommendations,

    timeline,
  };
}
