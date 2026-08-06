import { Incident } from "../models/Incident";
import { CorrelationFinding } from "./correlationEngine";
import { Prediction } from "./predictionEngine";

export interface TimelineEntry {
  timestamp: string;

  source:
    | "Metrics"
    | "Logs"
    | "Tracing"
    | "Kubernetes"
    | "Prediction"
    | "Analysis";

  severity: "Info" | "Warning" | "Critical";

  title: string;

  description: string;
}

interface TimelineInput {
  health: any;
  incidents: Incident[];
  correlations: CorrelationFinding[];
  predictions: Prediction[];
}

export function buildTimeline(data: TimelineInput): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];

  data.incidents.forEach((incident) => {
    timeline.push({
      timestamp: incident.timestamp ?? new Date().toISOString(),
      source: "Kubernetes",
      severity: convertSeverity(incident.severity),
      title: incident.title,
      description:
        incident.evidence.join(", ") ||
        incident.recommendations.join(", ") ||
        incident.symptoms.join(", ") ||
        "No additional details",
    });
  });

  timeline.push({
    timestamp: new Date().toISOString(),
    source: "Metrics",
    severity: data.health.healthy ? "Info" : "Warning",
    title: "Health Snapshot",
    description: `CPU ${data.health.cpu}, Memory ${data.health.memory}`,
  });

  data.correlations.forEach((finding) => {
    timeline.push({
      timestamp: new Date().toISOString(),
      source: "Analysis",
      severity: convertSeverity(finding.severity),
      title: finding.issue,
      description: finding.evidence.join(", "),
    });
  });

  data.predictions.forEach((prediction) => {
    timeline.push({
      timestamp: new Date().toISOString(),
      source: "Prediction",
      severity: convertSeverity(prediction.risk),
      title: "Prediction",
      description: prediction.message,
    });
  });

  timeline.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return deduplicateTimeline(timeline);
}

function convertSeverity(severity: string): TimelineEntry["severity"] {
  switch (severity.toLowerCase()) {
    case "critical":
      return "Critical";

    case "high":
      return "Warning";

    case "warning":
      return "Warning";

    case "medium":
      return "Warning";

    case "low":
      return "Info";

    case "normal":
      return "Info";

    case "info":
      return "Info";

    default:
      return "Info";
  }
}

function deduplicateTimeline(timeline: TimelineEntry[]): TimelineEntry[] {
  const seen = new Set<string>();

  return timeline.filter((entry) => {
    const key = [entry.source, entry.title, entry.description].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
