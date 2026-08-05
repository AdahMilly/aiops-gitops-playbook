import { collectTelemetry } from "./collectors/telemetryCollector";

import { analyze } from "./analyzers/healthAnalyzer";
import { analyzeEvents } from "./analyzers/eventAnalyzer";
import { detectRootCause } from "./analyzers/rootCauseAnalyzer";

import { correlate } from "./engines/correlationEngine";
import { correlateEvents } from "./engines/eventCorrelationEngine";
import { predict } from "./engines/predictionEngine";
import { scoreIncident } from "./engines/incidentScoringEngine";
import { recommend } from "./engines/recommendationEngine";
import { buildIncidentReport } from "./engines/reportEngine";
import { classifyIncident } from "./engines/classificationEngine";
import { buildTimeline } from "./timeline/incidentTimeline";

async function main() {
  console.log("Collecting telemetry...");

  const telemetry = await collectTelemetry();

  console.log("TELEMETRY");
  console.dir(telemetry, { depth: null });

  const health = analyze(telemetry);

  console.log("HEALTH");
  console.dir(health, { depth: null });

  console.log("TRENDS");
  console.dir(telemetry.trends, { depth: null });

  const eventFindings = analyzeEvents(telemetry.events);

  console.log("EVENT ANALYSIS");
  console.dir(eventFindings, { depth: null });

  const causes = detectRootCause(
    health,
    telemetry.trends,
    telemetry.logs,
    telemetry.traces,
  );

  console.log("ROOT CAUSES");
  console.dir(causes, { depth: null });

  const metricCorrelations = correlate({
    health,
    metrics: telemetry.metrics,
    trends: telemetry.trends,
    logs: telemetry.logs,
    traces: telemetry.traces,
    events: eventFindings,
  });

  const eventCorrelations = correlateEvents(telemetry.events);

  const correlations = [...metricCorrelations, ...eventCorrelations];

  console.log("CORRELATIONS");
  console.dir(correlations, { depth: null });

  const predictions = predict({
    health,
    trends: telemetry.trends,
    correlations,
  });

  console.log("PREDICTIONS");
  console.dir(predictions, { depth: null });

  const incident = scoreIncident({
    health,
    correlations,
    predictions,
  });

  console.log("INCIDENT SCORE");
  console.dir(incident, { depth: null });

  const recommendations = recommend(causes, correlations, predictions);

  console.log("RECOMMENDATIONS");
  console.dir(recommendations, { depth: null });

  const classification = classifyIncident({
    causes,
    correlations,
    events: eventFindings,
  });

  console.log("\nINCIDENT CLASSIFICATION");
  console.dir(classification, { depth: null });

  const report = buildIncidentReport({
    telemetry,
    health,
    causes,
    correlations,
    predictions,
    recommendations,
    incident,
  });

  console.dir(report, { depth: null });

  const timeline = buildTimeline(
    telemetry,
    health,
    correlations,
    predictions
);

console.log("\nINCIDENT TIMELINE");
console.table(timeline);

  console.log("PIPELINE COMPLETE");
}

main().catch(console.error);
