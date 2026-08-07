import { Incident } from "../models/Incident";

export interface CorrelationFinding {
  severity: "Low" | "Medium" | "High" | "Critical";
  issue: string;
  evidence: string[];
}

interface Trend {
  trend: string;
  anomaly: boolean;
}

interface CorrelationInput {
  health: {
    cpu: string;
    memory: string;
    healthy: boolean;
  };

  metrics: {
    cpu: number;
    memory: number;
  };

  trends: {
    cpu: Trend;
    memory: Trend;
  };

  logs: {
    values?: string[][];
  }[];

  traces: {
    durationMs: number;
  }[];

  incidents: Incident[];
}

export function correlate(data: CorrelationInput): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];

  const cpu = Number.parseFloat(data.health.cpu);
  const memory = Number.parseFloat(data.health.memory);

  const cpuTrend = data.trends.cpu.trend;
  const memoryTrend = data.trends.memory.trend;

  const cpuAnomaly = data.trends.cpu.anomaly;
  const memoryAnomaly = data.trends.memory.anomaly;

  const traceCount = data.traces.length;

  const logCount = data.logs.reduce(
    (sum, log) => sum + (log.values?.length ?? 0),
    0,
  );

  if (cpu > 80 && cpuTrend === "rising") {
    findings.push({
      severity: "Critical",
      issue: "CPU Saturation",
      evidence: [`CPU usage ${cpu.toFixed(2)}%`, "CPU trend is rising"],
    });
  }

  if (memory > 400 && memoryTrend === "rising") {
    findings.push({
      severity: "Critical",
      issue: "Possible Memory Leak",
      evidence: [`Memory ${memory.toFixed(2)} MB`, "Memory trend is rising"],
    });
  }

  if (cpuAnomaly) {
    findings.push({
      severity: "Medium",
      issue: "CPU Anomaly",
      evidence: ["CPU trend contains abnormal spikes"],
    });
  }

  if (memoryAnomaly) {
    findings.push({
      severity: "Medium",
      issue: "Memory Anomaly",
      evidence: ["Memory trend contains abnormal spikes"],
    });
  }

  if (logCount > 100) {
    findings.push({
      severity: "Medium",
      issue: "Log Explosion",
      evidence: [`${logCount} recent log entries`],
    });
  }

  const slowTraces = data.traces.filter((trace) => trace.durationMs > 1000);

  if (slowTraces.length > 0) {
    findings.push({
      severity: "High",
      issue: "Slow Requests",
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

  const activeIncidents = data.incidents.filter(
    (incident) => incident.status === "Active",
  );

  for (const incident of activeIncidents) {
    findings.push({
      severity: incident.severity,

      issue: incident.title,

      evidence:
        incident.evidence.length > 0
          ? incident.evidence
          : incident.symptoms.length > 0
            ? incident.symptoms
            : ["No evidence available"],
    });
  }

  const unique = findings.filter(
    (item, index, self) =>
      index ===
      self.findIndex(
        (finding) =>
          finding.issue === item.issue && finding.severity === item.severity,
      ),
  );

  if (
    unique.length === 0 &&
    data.health.healthy &&
    !cpuAnomaly &&
    !memoryAnomaly
  ) {
    unique.push({
      severity: "Low",
      issue: "System Healthy",
      evidence: [
        "CPU normal",
        "Memory normal",
        "Tracing available",
        "No abnormal trends",
        "No active incidents",
      ],
    });
  }

  return unique;
}
