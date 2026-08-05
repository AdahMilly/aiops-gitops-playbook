export interface CorrelationFinding {
  severity: "Low" | "Medium" | "High" | "Critical";
  issue: string;
  evidence: string[];
}

export function correlate(data: {
  health: any;
  metrics: {
    cpu: number;
    memory: number;
  };
  trends: any;
  logs: any[];
  traces: any[];
  events: any[];
}) {
  const findings: CorrelationFinding[] = [];

  const cpu = Number.parseFloat(data.health.cpu);
  const memory = Number.parseFloat(data.health.memory);

  const cpuTrend = data.trends.cpu?.trend;
  const memoryTrend = data.trends.memory?.trend;

  const traceCount = data.traces.length;

  const logCount = data.logs.reduce(
    (sum: number, log: any) => sum + (log.values?.length ?? 0),
    0,
  );

  if (cpu > 80 && cpuTrend === "rising") {
    findings.push({
      severity: "Critical",
      issue: "CPU saturation",
      evidence: [`CPU usage ${cpu.toFixed(2)}%`, "CPU trend is rising"],
    });
  }

  if (memory > 400 && memoryTrend === "rising") {
    findings.push({
      severity: "Critical",
      issue: "Possible memory leak",
      evidence: [`Memory ${memory.toFixed(2)} MB`, "Memory trend is rising"],
    });
  }

  if (logCount > 100) {
    findings.push({
      severity: "Medium",
      issue: "Large number of application logs",
      evidence: [`${logCount} recent log entries`],
    });
  }

  const slowTraces = data.traces.filter((t: any) => (t.durationMs ?? 0) > 1000);

  if (slowTraces.length > 0) {
    findings.push({
      severity: "High",
      issue: "Slow application requests",
      evidence: [`${slowTraces.length} traces exceeded 1 second`],
    });
  }

  if (traceCount === 0) {
    findings.push({
      severity: "Medium",
      issue: "Tracing unavailable",
      evidence: ["No recent traces returned by Tempo"],
    });
  }

  const hasCritical = findings.some(
    (f) => f.severity === "Critical" || f.severity === "High",
  );

  if (!hasCritical && findings.length === 0) {
    findings.push({
      severity: "Low",
      issue: "System operating normally",
      evidence: [
        "CPU normal",
        "Memory normal",
        "Tracing available",
        "No abnormal trends",
      ],
    });
  }

  for (const event of data.events) {
  findings.push({
    severity: event.severity,
    issue: event.reason,
    evidence: [
      event.message,
      `Occurrences: ${event.count}`,
      `Pod: ${event.pod}`,
    ],
  });
}
  return findings;
}
