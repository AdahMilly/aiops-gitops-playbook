export interface EventCorrelationFinding {
  severity: "Low" | "Medium" | "High" | "Critical";
  issue: string;
  evidence: string[];
}

export function correlateEvents(events: any[]) {
  const findings: EventCorrelationFinding[] = [];

  for (const event of events) {
    if (event.type === "Warning") {
      findings.push({
        severity: "High",
        issue: event.reason,
        evidence: [event.message],
      });
    }

    if (event.reason === "NodeNotReady") {
      findings.push({
        severity: "Critical",
        issue: "Cluster node unavailable",
        evidence: [event.message, `Pod: ${event.involvedObject?.name}`],
      });
    }

    if (event.reason === "OOMKilled") {
      findings.push({
        severity: "Critical",
        issue: "Container killed by OOM",
        evidence: [event.message],
      });
    }

    if (event.reason === "BackOff") {
      findings.push({
        severity: "Critical",
        issue: "CrashLoopBackOff detected",
        evidence: [event.message],
      });
    }

    if (event.reason === "FailedScheduling") {
      findings.push({
        severity: "High",
        issue: "Pod scheduling failure",
        evidence: [event.message],
      });
    }
  }

  return findings;
}
