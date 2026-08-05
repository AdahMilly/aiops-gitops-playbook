export interface TimelineEvent {
  timestamp: Date;
  source: "Metrics" | "Logs" | "Traces" | "Kubernetes";
  severity: "Info" | "Warning" | "Critical";
  title: string;
  description: string;
}
export function buildTimeline(
  telemetry: any,
  health: any,
  correlations: any[],
  predictions: any[],
) {
  const timeline: TimelineEvent[] = [];

  timeline.push({
    timestamp: new Date(telemetry.timestamp),
    source: "Metrics",
    severity: health.healthy ? "Info" : "Warning",
    title: "Health Check",
    description: `CPU ${health.cpu}, Memory ${health.memory}`,
  });

  for (const event of telemetry.events) {
    timeline.push({
      timestamp: new Date(event.lastTimestamp),
      source: "Kubernetes",
      severity: event.type === "Warning" ? "Critical" : "Info",
      title: event.reason,
      description: event.message,
    });
  }

  for (const finding of correlations) {
    timeline.push({
      timestamp: new Date(),
      source: "Metrics",
      severity: finding.severity === "Critical" ? "Critical" : "Warning",
      title: finding.issue,
      description: finding.evidence.join(", "),
    });
  }

  for (const prediction of predictions) {
    timeline.push({
      timestamp: new Date(),
      source: "Metrics",
      severity: prediction.risk === "Critical" ? "Critical" : "Info",
      title: "Prediction",
      description: prediction.message,
    });
  }

  return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}