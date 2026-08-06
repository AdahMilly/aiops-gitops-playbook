import { Incident } from "../models/Incident";

export function mapIncidents(events: any[]): Incident[] {
  return events.map(
    (event, index): Incident => ({
      id: `${event.reason ?? "event"}-${index}`,

      title: event.reason ?? "Unknown Event",

      category: inferCategory(event.reason),

      severity: mapSeverity(event.type),

      confidence: 90,

      rootCause: event.reason,

      symptoms: [event.message],

      evidence: [
        event.message,
        event.involvedObject?.kind
          ? `${event.involvedObject.kind}: ${event.involvedObject.name}`
          : "",
      ].filter(Boolean),

      recommendations: [],

      affectedPods:
        event.involvedObject?.kind === "Pod" ? [event.involvedObject.name] : [],

      affectedServices:
        event.involvedObject?.kind === "Service"
          ? [event.involvedObject.name]
          : [],

      source: ["Kubernetes"],
    }),
  );
}

function mapSeverity(type?: string): Incident["severity"] {
  if (type === "Warning") return "High";
  return "Low";
}

function inferCategory(reason?: string): Incident["category"] {
  switch (reason) {
    case "NodeNotReady":
      return "Infrastructure";

    case "OOMKilled":
      return "Performance";

    case "BackOff":
    case "CrashLoopBackOff":
      return "Application";

    case "FailedScheduling":
      return "Infrastructure";

    case "Unhealthy":
      return "Application";

    default:
      return "Unknown";
  }
}
