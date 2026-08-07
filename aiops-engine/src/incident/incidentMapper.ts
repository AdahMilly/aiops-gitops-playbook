import { Incident } from "../models/Incident";

export function mapIncidents(events: any[] = []): Incident[] {
  return events.map((event, index): Incident => {
    const reason = event.reason ?? "Unknown Event";
    const message = String(event.message ?? "");

    const status = determineStatus(event);

    return {
      id: `${reason}-${event.involvedObject?.name ?? "unknown"}-${index}`,

      title: reason,

      category: inferCategory(reason),

      severity: mapSeverity(event.type),

      confidence: status === "Active" ? 90 : 60,

      status,

      rootCause: reason,

      symptoms: [message],

      evidence: [
        message,
        event.involvedObject?.kind
          ? `${event.involvedObject.kind}: ${event.involvedObject.name}`
          : "",
      ].filter(Boolean),

      recommendations: [],

      affectedPods:
        event.involvedObject?.kind === "Pod" && event.involvedObject?.name
          ? [event.involvedObject.name]
          : [],

      affectedServices:
        event.involvedObject?.kind === "Service" && event.involvedObject?.name
          ? [event.involvedObject.name]
          : [],

      source: ["Kubernetes"],

      timestamp: event.timestamp ?? event.lastTimestamp ?? event.firstTimestamp,
    };
  });
}

function determineStatus(event: any): "Active" | "Historical" {
  const reason = String(event.reason ?? "").toLowerCase();
  const message = String(event.message ?? "").toLowerCase();

  if (
    reason.includes("crashloopbackoff") ||
    reason.includes("failedscheduling") ||
    reason.includes("imagepullbackoff") ||
    reason.includes("errimagepull") ||
    reason.includes("oomkilled")
  ) {
    return "Active";
  }

  if (
    reason.includes("nodenotready") ||
    message.includes("node is not ready")
  ) {
    return "Historical";
  }

  if (
    message.includes("liveness probe failed") ||
    message.includes("readiness probe failed")
  ) {
    return "Historical";
  }

  if (reason.includes("taintmanagereviction")) {
    return "Historical";
  }

  return "Historical";
}

function mapSeverity(type?: string): Incident["severity"] {
  if (type === "Warning") {
    return "High";
  }

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
