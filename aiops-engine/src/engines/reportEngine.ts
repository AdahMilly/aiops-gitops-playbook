export function buildIncidentReport(data: {
  telemetry: any;
  health: any;
  causes: any[];
  correlations: any[];
  predictions: any[];
  recommendations: any[];
  incident: any;
}) {
  return {
    generatedAt: new Date().toISOString(),

    summary: {
      score: data.incident.score,
      level: data.incident.level,
      healthy: data.health.healthy,
    },

    health: data.health,

    trends: data.telemetry.trends,

    rootCauses: data.causes,

    correlations: data.correlations,

    predictions: data.predictions,

    recommendations: data.recommendations,

    events: data.telemetry.events,
  };
}
