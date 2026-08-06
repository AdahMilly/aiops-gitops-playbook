export interface EventFinding {
  severity: "Low" | "Medium" | "High" | "Critical";
  reason: string;
  message: string;
  pod?: string;
  count: number;
  firstSeen?: Date;
  lastSeen?: Date;
}

export function analyzeEvents(events: any[]): EventFinding[] {
  return events.map((event) => {
    const reason = event.reason;
    const message = event.message;

    let severity: EventFinding["severity"] = "Low";

    switch (reason) {
      case "NodeNotReady":
      case "FailedScheduling":
      case "FailedMount":
      case "Unhealthy":
        severity = "Critical";
        break;

      case "BackOff":
      case "CrashLoopBackOff":
      case "Failed":
        severity = "High";
        break;

      case "TaintManagerEviction":
        severity = "Medium";
        break;

      default:
        severity = event.type === "Warning" ? "High" : "Low";
    }

    return {
      severity,
      reason,
      message,
      pod: event.involvedObject?.name,
      count: event.count ?? 1,
      firstSeen: event.firstTimestamp,
      lastSeen: event.lastTimestamp,
    };
  });
}
