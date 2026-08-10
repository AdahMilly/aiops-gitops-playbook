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

import { processIncidentLifecycle } from "./incidentLifecycleEngine";
import { IncidentLifecycleResult } from "../analyzers/incidentLifecycle";
import { reconcileHealthState } from "./healthStateEngine";

interface GenerateIncidentReportInput {
  health: any;
  telemetry: any;
  previousIncidents?: import("../analyzers/incidentLifecycle").Incident[];
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
  incidentLifecycle: IncidentLifecycleResult;
}

export function generateIncidentReport(
  input: GenerateIncidentReportInput,
): IncidentReport {

  const incidents = mapIncidents(input.telemetry.events ?? []);

  const incidentLifecycle = processIncidentLifecycle(
    input.health.detailedFindings ?? [],
    input.previousIncidents ?? [],
  );

  const finalHealthState = reconcileHealthState(
    input.health.healthy,
    input.health.status === "Healthy" ? "Healthy" : "Warning",
    incidentLifecycle,
  );

  const finalHealth = {
    ...input.health,

    healthy: finalHealthState.healthy,

    status: finalHealthState.level,

    stateReason: finalHealthState.reason,

    activeIncidentCount: incidentLifecycle.activeIncidents?.length ?? 0,

    detailedFindings: (input.health.detailedFindings ?? []).map(
      (finding: any) => {
        const lifecycleIncident = incidentLifecycle.incidents?.find(
          (incident) =>
            incident.issue === finding.issue &&
            incident.source === finding.source,
        );

        return {
          ...finding,

          status: lifecycleIncident?.status ?? finding.status ?? "Historical",
        };
      },
    ),
  };

  const correlations = correlate({
    health: finalHealth,

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

  const rootCause = findRootCause(actionableCorrelations);

  const predictions = predict({
    health: finalHealth,

    trends: input.telemetry.trends,

    correlations: actionableCorrelations,

    rootCause,
  });

  const recommendations = recommend(rootCause, incidentGroups, predictions);

  const score = scoreIncident({
    health: finalHealth,

    correlations: actionableCorrelations,

    predictions,

    trends: input.telemetry.trends,

    rootCause,
  });

  const timeline = buildTimeline({
    health: finalHealth,

    correlations: actionableCorrelations,

    predictions,

    incidents,
  });

  return {
    generatedAt: new Date().toISOString(),

    summary: {
      score: score.score,
      level: finalHealthState.level,
      healthy: finalHealthState.healthy,
    },

    health: finalHealth,

    trends: input.telemetry.trends,

    rootCause,

    incidentGroups,

    correlations: actionableCorrelations,

    predictions,

    recommendations,

    timeline,

    incidentLifecycle,
  };
}
